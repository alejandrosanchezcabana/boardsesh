import Capacitor
import ActivityKit
import os.log

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateActivity", returnType: CAPPluginReturnPromise),
    ]

    private let logger = Logger(subsystem: "com.boardsesh.app", category: "LiveActivityPlugin")

    // MARK: - isAvailable

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) {
            let available = LiveActivityManager.shared.isAvailable
            call.resolve(["available": available])
        } else {
            call.resolve(["available": false])
        }
    }

    // MARK: - startSession

    @objc func startSession(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *) else {
            call.reject("Live Activities require iOS 17.0 or later")
            return
        }

        guard let sessionId = call.getString("sessionId") else {
            call.reject("Missing required parameter: sessionId")
            return
        }

        guard let serverUrl = call.getString("serverUrl") else {
            call.reject("Missing required parameter: serverUrl")
            return
        }

        guard let boardName = call.getString("boardName") else {
            call.reject("Missing required parameter: boardName")
            return
        }

        let layoutId = call.getInt("layoutId") ?? 0
        let sizeId = call.getInt("sizeId") ?? 0
        let setIds = call.getString("setIds") ?? ""
        let authToken = call.getString("authToken")
        let wsUrl = call.getString("wsUrl")

        // Store board details in shared UserDefaults for App Intents
        // and thumbnail URL construction.
        if let defaults = SharedConstants.sharedDefaults {
            defaults.set(sessionId, forKey: SharedConstants.sessionIdKey)
            defaults.set(serverUrl, forKey: SharedConstants.serverUrlKey)
            defaults.set(boardName, forKey: SharedConstants.boardNameKey)
            defaults.set(layoutId, forKey: SharedConstants.layoutIdKey)
            defaults.set(sizeId, forKey: SharedConstants.sizeIdKey)
            defaults.set(setIds, forKey: SharedConstants.setIdsKey)
        }

        // For party mode (real session), connect the WebSocket manager
        // so queue updates flow through to the Live Activity.
        // Set callback BEFORE connect to avoid race where a fast connection
        // fires events before the callback is installed.
        let wsManager = SessionWebSocketManager.shared
        let activityManager = LiveActivityManager.shared

        wsManager.onQueueStateChanged = { [weak self] items, currentIndex in
            guard let self else { return }
            guard let state = LiveActivityManager.buildContentState(
                items: items,
                currentIndex: currentIndex
            ) else {
                self.logger.debug("Queue state changed but no valid content state could be built")
                return
            }
            Task {
                await activityManager.updateActivity(state: state)
            }
        }

        // Connect after callback is set to ensure no events are missed.
        wsManager.connect(serverUrl: serverUrl, sessionId: sessionId, authToken: authToken, wsUrl: wsUrl)

        // Start the Live Activity with an initial "Loading..." state.
        let initialState = ClimbSessionAttributes.ContentState(
            climbName: "Loading...",
            climbDifficulty: "",
            angle: 0,
            currentIndex: 0,
            totalClimbs: 0,
            hasNext: false,
            hasPrevious: false,
            climbUuid: ""
        )

        Task {
            do {
                try await activityManager.startActivity(
                    boardName: boardName,
                    sessionId: sessionId,
                    initialState: initialState
                )
                self.logger.info("Started session \(sessionId, privacy: .public) with Live Activity")
                call.resolve()
            } catch {
                self.logger.error("Failed to start Live Activity: \(error.localizedDescription, privacy: .public)")
                call.reject("Failed to start Live Activity: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - endSession

    @objc func endSession(_ call: CAPPluginCall) {
        let wsManager = SessionWebSocketManager.shared
        wsManager.onQueueStateChanged = nil
        wsManager.disconnect()

        // Clear shared UserDefaults queue state.
        if let defaults = SharedConstants.sharedDefaults {
            defaults.removeObject(forKey: SharedConstants.queueItemsKey)
            defaults.removeObject(forKey: SharedConstants.currentIndexKey)
            defaults.removeObject(forKey: SharedConstants.sessionIdKey)
            defaults.removeObject(forKey: SharedConstants.pendingActionKey)
        }

        if #available(iOS 17.0, *) {
            Task {
                await LiveActivityManager.shared.endAllActivities()
                self.logger.info("Ended session and cleaned up Live Activity")
                call.resolve()
            }
        } else {
            logger.info("Ended session")
            call.resolve()
        }
    }

    // MARK: - updateActivity

    @objc func updateActivity(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *) else {
            call.reject("Live Activities require iOS 17.0 or later")
            return
        }

        let climbName = call.getString("climbName") ?? ""
        let climbDifficulty = call.getString("climbDifficulty") ?? ""
        let angle = call.getInt("angle") ?? 0
        let currentIndex = call.getInt("currentIndex") ?? 0
        let totalClimbs = call.getInt("totalClimbs") ?? 0
        let hasNext = call.getBool("hasNext") ?? false
        let hasPrevious = call.getBool("hasPrevious") ?? false
        let climbUuid = call.getString("climbUuid") ?? ""

        // Parse the queue array from the call and store in shared UserDefaults
        // so App Intents can navigate locally.
        if let defaults = SharedConstants.sharedDefaults {
            var queueItems: [SharedQueueItem] = []

            if let queueArray = call.getArray("queue") as? [JSObject] {
                for item in queueArray {
                    let itemUuid = item["uuid"] as? String ?? ""
                    let itemClimbUuid = item["climbUuid"] as? String ?? ""
                    let itemClimbName = item["climbName"] as? String ?? ""
                    let itemDifficulty = item["difficulty"] as? String ?? ""
                    let itemAngle = item["angle"] as? Int ?? 0
                    let itemFrames = item["frames"] as? String ?? ""
                    let itemSetterUsername = item["setterUsername"] as? String ?? ""

                    queueItems.append(SharedQueueItem(
                        uuid: itemUuid,
                        climbUuid: itemClimbUuid,
                        climbName: itemClimbName,
                        difficulty: itemDifficulty,
                        angle: itemAngle,
                        frames: itemFrames,
                        setterUsername: itemSetterUsername
                    ))
                }
            }

            SharedQueueState.save(items: queueItems, currentIndex: currentIndex, to: defaults)
        }

        // Build and push the new content state to the Live Activity.
        let state = ClimbSessionAttributes.ContentState(
            climbName: climbName,
            climbDifficulty: climbDifficulty,
            angle: angle,
            currentIndex: currentIndex,
            totalClimbs: totalClimbs,
            hasNext: hasNext,
            hasPrevious: hasPrevious,
            climbUuid: climbUuid
        )

        let activityManager = LiveActivityManager.shared

        Task {
            // updateActivity already triggers thumbnail pre-fetch via LiveActivityManager
            await activityManager.updateActivity(state: state)
        }

        call.resolve()
    }
}
