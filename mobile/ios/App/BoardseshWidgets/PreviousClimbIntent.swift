import ActivityKit
import AppIntents

@available(iOS 16.1, *)
struct PreviousClimbIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Previous Climb"
    static var description = IntentDescription("Navigate to the previous climb in the queue")

    func perform() async throws -> some IntentResult {
        guard let defaults = SharedConstants.sharedDefaults else {
            return .result()
        }

        let (items, currentIndex) = SharedQueueState.load(from: defaults)

        let prevIndex = currentIndex - 1
        guard prevIndex >= 0 else {
            return .result()
        }

        // Persist the new index so the main app picks it up.
        SharedQueueState.save(items: items, currentIndex: prevIndex, to: defaults)

        // Optimistically update every active Live Activity.
        let prevItem = items[prevIndex]
        let newState = ClimbSessionAttributes.ContentState(
            climbName: prevItem.climbName,
            climbDifficulty: prevItem.difficulty,
            angle: prevItem.angle,
            currentIndex: prevIndex,
            totalClimbs: items.count,
            hasNext: prevIndex < items.count - 1,
            hasPrevious: prevIndex > 0,
            climbUuid: prevItem.climbUuid
        )

        for activity in Activity<ClimbSessionAttributes>.activities {
            let content = ActivityContent(state: newState, staleDate: nil)
            await activity.update(content)
        }

        // Tell the main app to send the WebSocket mutation.
        defaults.set("previous", forKey: SharedConstants.pendingActionKey)
        postDarwinNotification()

        return .result()
    }

    private func postDarwinNotification() {
        let name = SharedConstants.queueNavigateNotification as CFString
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(name),
            nil, nil, true
        )
    }
}
