import XCTest
@testable import App

// MARK: - LiveActivityManagerTests

final class LiveActivityManagerTests: XCTestCase {

    // MARK: - Helpers

    private func makeQueueItem(
        uuid: String = UUID().uuidString,
        climbUuid: String = UUID().uuidString,
        climbName: String = "Test Climb",
        difficulty: String = "V5",
        angle: Int = 40
    ) -> SharedQueueItem {
        SharedQueueItem(
            uuid: uuid,
            climbUuid: climbUuid,
            climbName: climbName,
            difficulty: difficulty,
            angle: angle,
            frames: "p1r12p2r13",
            setterUsername: "tester"
        )
    }

    private func makeSampleQueue(count: Int) -> [SharedQueueItem] {
        (0..<count).map { i in
            makeQueueItem(
                uuid: "queue-\(i)",
                climbUuid: "climb-\(i)",
                climbName: "Climb \(i)",
                difficulty: "V\(i + 1)",
                angle: 30 + i * 5
            )
        }
    }

    // MARK: - buildContentState Tests

    func testBuildContentStateFromQueueItems() {
        let items = makeSampleQueue(count: 3)

        let state = LiveActivityManager.buildContentState(items: items, currentIndex: 1)

        XCTAssertNotNil(state)
        XCTAssertEqual(state?.climbName, "Climb 1")
        XCTAssertEqual(state?.climbDifficulty, "V2")
        XCTAssertEqual(state?.angle, 35)
        XCTAssertEqual(state?.currentIndex, 1)
        XCTAssertEqual(state?.totalClimbs, 3)
        XCTAssertEqual(state?.climbUuid, "climb-1")
    }

    func testBuildContentStateHasNextAndPrevious() {
        let items = makeSampleQueue(count: 5)

        let state = LiveActivityManager.buildContentState(items: items, currentIndex: 2)

        XCTAssertNotNil(state)
        XCTAssertTrue(state!.hasNext, "Middle item should have next")
        XCTAssertTrue(state!.hasPrevious, "Middle item should have previous")
    }

    func testBuildContentStateFirstItem() {
        let items = makeSampleQueue(count: 3)

        let state = LiveActivityManager.buildContentState(items: items, currentIndex: 0)

        XCTAssertNotNil(state)
        XCTAssertFalse(state!.hasPrevious, "First item should not have previous")
        XCTAssertTrue(state!.hasNext, "First item of multi-item queue should have next")
        XCTAssertEqual(state?.climbName, "Climb 0")
        XCTAssertEqual(state?.currentIndex, 0)
    }

    func testBuildContentStateLastItem() {
        let items = makeSampleQueue(count: 4)

        let state = LiveActivityManager.buildContentState(items: items, currentIndex: 3)

        XCTAssertNotNil(state)
        XCTAssertTrue(state!.hasPrevious, "Last item should have previous")
        XCTAssertFalse(state!.hasNext, "Last item should not have next")
        XCTAssertEqual(state?.climbName, "Climb 3")
        XCTAssertEqual(state?.currentIndex, 3)
        XCTAssertEqual(state?.totalClimbs, 4)
    }

    func testBuildContentStateSingleItem() {
        let items = makeSampleQueue(count: 1)

        let state = LiveActivityManager.buildContentState(items: items, currentIndex: 0)

        XCTAssertNotNil(state)
        XCTAssertFalse(state!.hasNext, "Single item should not have next")
        XCTAssertFalse(state!.hasPrevious, "Single item should not have previous")
        XCTAssertEqual(state?.totalClimbs, 1)
    }

    func testBuildContentStateEmptyQueue() {
        let state = LiveActivityManager.buildContentState(items: [], currentIndex: 0)

        XCTAssertNil(state, "Should return nil for an empty queue")
    }

    func testBuildContentStateOutOfBoundsPositive() {
        let items = makeSampleQueue(count: 3)

        let state = LiveActivityManager.buildContentState(items: items, currentIndex: 5)

        XCTAssertNil(state, "Should return nil for an out-of-bounds positive index")
    }

    func testBuildContentStateOutOfBoundsNegative() {
        let items = makeSampleQueue(count: 3)

        let state = LiveActivityManager.buildContentState(items: items, currentIndex: -1)

        XCTAssertNil(state, "Should return nil for a negative index")
    }

    func testBuildContentStateOutOfBoundsExactCount() {
        let items = makeSampleQueue(count: 3)

        let state = LiveActivityManager.buildContentState(items: items, currentIndex: 3)

        XCTAssertNil(state, "Should return nil when index equals item count")
    }

    func testBuildContentStateMapsFieldsCorrectly() {
        let item = makeQueueItem(
            climbUuid: "uuid-abc",
            climbName: "Midnight Lightning",
            difficulty: "V8",
            angle: 45
        )

        let state = LiveActivityManager.buildContentState(items: [item], currentIndex: 0)

        XCTAssertNotNil(state)
        XCTAssertEqual(state?.climbName, "Midnight Lightning")
        XCTAssertEqual(state?.climbDifficulty, "V8")
        XCTAssertEqual(state?.angle, 45)
        XCTAssertEqual(state?.climbUuid, "uuid-abc")
        XCTAssertEqual(state?.currentIndex, 0)
        XCTAssertEqual(state?.totalClimbs, 1)
    }
}
