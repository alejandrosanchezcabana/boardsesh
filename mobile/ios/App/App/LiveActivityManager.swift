import ActivityKit
import Foundation
import os.log

// MARK: - LiveActivityManager

@available(iOS 16.1, *)
final class LiveActivityManager {

    // MARK: - Singleton

    static let shared = LiveActivityManager()

    // MARK: - Properties

    private var currentActivity: Activity<ClimbSessionAttributes>?
    private let thumbnailFetcher = ThumbnailFetcher()
    private let logger = Logger(subsystem: "com.boardsesh.app", category: "LiveActivityManager")

    // MARK: - Init

    private init() {}

    // MARK: - Availability

    /// Whether Live Activities are supported and the user has granted permission.
    var isAvailable: Bool {
        ActivityAuthorizationInfo().areActivitiesEnabled
    }

    // MARK: - Start

    /// Starts a new Live Activity for a climbing session.
    ///
    /// Any existing activities (including stale ones from previous sessions)
    /// are ended before the new one is created.
    ///
    /// - Throws: If Live Activities are not available or ActivityKit rejects
    ///   the request (e.g., too many concurrent activities).
    func startActivity(
        boardName: String,
        sessionId: String,
        initialState: ClimbSessionAttributes.ContentState
    ) async throws {
        guard isAvailable else {
            logger.warning("Live Activities are not enabled; skipping start")
            return
        }

        // Clean up any existing activities first.
        await endAllActivities()

        let attributes = ClimbSessionAttributes(boardName: boardName, sessionId: sessionId)
        let content = ActivityContent(state: initialState, staleDate: nil)

        do {
            currentActivity = try Activity.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
            logger.info("Started Live Activity for session \(sessionId, privacy: .public)")
        } catch {
            logger.error("Failed to start Live Activity: \(error.localizedDescription, privacy: .public)")
            throw error
        }
    }

    // MARK: - Update

    /// Updates the current Live Activity with new climb data.
    ///
    /// Also triggers a background thumbnail pre-fetch for adjacent queue items
    /// so the widget extension can display them without delay.
    func updateActivity(state: ClimbSessionAttributes.ContentState) async {
        guard let activity = currentActivity else {
            logger.debug("No active Live Activity to update")
            return
        }

        // Stale date set to 30 minutes. The ping timeout timer refreshes this
        // every 60s while the native WebSocket is healthy, and each JS
        // updateActivity call also resets it. If all update paths fail for
        // 30 minutes, the activity shows "Session ended" as a signal.
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(30 * 60))
        await activity.update(content)
        logger.info("Updated Live Activity: \(state.climbName, privacy: .public) (\(state.currentIndex + 1)/\(state.totalClimbs))")

        // Fire-and-forget thumbnail pre-fetch for the current and adjacent items.
        // Strong capture of thumbnailFetcher is intentional: it's owned by the
        // singleton LiveActivityManager, so it outlives the task.
        Task.detached(priority: .utility) { [thumbnailFetcher] in
            guard let defaults = SharedConstants.sharedDefaults else { return }
            let (items, currentIndex) = SharedQueueState.load(from: defaults)
            await thumbnailFetcher.preFetchAdjacentThumbnails(
                queue: items,
                currentIndex: currentIndex
            )
        }
    }

    // MARK: - Refresh Stale Date

    /// Pushes the stale deadline forward without changing the displayed content.
    /// Call this periodically (e.g. on WebSocket ping) to keep the activity alive.
    func refreshStaleDate() async {
        guard let activity = currentActivity else { return }
        let content = ActivityContent(state: activity.content.state, staleDate: Date().addingTimeInterval(30 * 60))
        await activity.update(content)
    }

    // MARK: - End

    /// Ends all Live Activities, including the tracked one and any stale
    /// activities from previous sessions that may still be visible.
    func endAllActivities() async {
        // End the currently tracked activity.
        if let activity = currentActivity {
            let activityId = activity.id
            await activity.end(nil, dismissalPolicy: .immediate)
            logger.info("Ended tracked Live Activity \(activityId, privacy: .public)")
            currentActivity = nil
        }

        // Also clean up any stale activities that might linger from crashes
        // or previous sessions.
        for activity in Activity<ClimbSessionAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    // MARK: - Content State Builder

    /// Builds a `ContentState` from the current shared queue state.
    ///
    /// Returns `nil` if the queue is empty or the index is out of bounds.
    static func buildContentState(
        items: [SharedQueueItem],
        currentIndex: Int
    ) -> ClimbSessionAttributes.ContentState? {
        guard !items.isEmpty,
              currentIndex >= 0,
              currentIndex < items.count
        else {
            return nil
        }

        let item = items[currentIndex]

        return ClimbSessionAttributes.ContentState(
            climbName: item.climbName,
            climbDifficulty: item.difficulty,
            angle: item.angle,
            currentIndex: currentIndex,
            totalClimbs: items.count,
            hasNext: currentIndex < items.count - 1,
            hasPrevious: currentIndex > 0,
            climbUuid: item.climbUuid
        )
    }
}
