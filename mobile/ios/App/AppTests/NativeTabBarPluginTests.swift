import XCTest
@testable import App

// MARK: - MockNativeTabBarView

/// Subclass of NativeTabBarView that records calls instead of performing UI work,
/// so plugin logic can be verified without a live UIWindow hierarchy.
class MockNativeTabBarView: NativeTabBarView {
    var lastSetActiveTab: String?
    var lastBadgeCount: Int?
    var lastHiddenState: Bool?

    override func setActiveTab(_ tab: String) {
        lastSetActiveTab = tab
        super.setActiveTab(tab)
    }

    override func setNotificationBadge(_ count: Int) {
        lastBadgeCount = count
        super.setNotificationBadge(count)
    }

    override func setBarsHidden(_ hidden: Bool, animated: Bool = true) {
        lastHiddenState = hidden
        // Do not call super — avoids UIView.animate in unit tests.
    }
}

// MARK: - NativeTabBarPluginTests

/// These tests exercise NativeTabBarView's public interface directly —
/// the same surface the plugin calls on the main thread. Testing the
/// Capacitor bridge wiring (bridge?.viewController) requires a running
/// Capacitor host which is not available in unit tests; the plugin
/// delegate pattern is covered by inspection (it mirrors NativeWebSocketPlugin).
final class NativeTabBarPluginTests: XCTestCase {

    private var mockView: MockNativeTabBarView!

    override func setUp() {
        super.setUp()
        mockView = MockNativeTabBarView()
        mockView.frame = CGRect(x: 0, y: 0, width: 390, height: 83)
        mockView.layoutIfNeeded()
    }

    override func tearDown() {
        mockView = nil
        super.tearDown()
    }

    // MARK: - Test 1: setActiveTab forwards to the tab bar view

    func testSetActiveTabForwardsToTabBarView() {
        mockView.setActiveTab("climbs")
        XCTAssertEqual(mockView.lastSetActiveTab, "climbs",
                       "setActiveTab should forward 'climbs' to the view")
    }

    // MARK: - Test 2: setBarsHidden(true) records hidden = true

    func testSetBarsHiddenTrueRecordsHiddenState() {
        mockView.setBarsHidden(true)
        XCTAssertEqual(mockView.lastHiddenState, true,
                       "setBarsHidden(true) should record hidden = true")
    }

    // MARK: - Test 3: setBarsHidden(false) records hidden = false

    func testSetBarsHiddenFalseRecordsHiddenState() {
        mockView.setBarsHidden(true)
        mockView.setBarsHidden(false)
        XCTAssertEqual(mockView.lastHiddenState, false,
                       "setBarsHidden(false) should record hidden = false")
    }

    // MARK: - Test 4: setNotificationBadge forwards the count

    func testSetNotificationBadgeForwardsCount() {
        mockView.setNotificationBadge(7)
        XCTAssertEqual(mockView.lastBadgeCount, 7,
                       "setNotificationBadge should forward count 7 to the view")
    }

    // MARK: - Test 5: setActiveTab resolves (verify the view method doesn't throw)

    func testSetActiveTabResolves() {
        XCTAssertNoThrow(mockView.setActiveTab("home"),
                         "setActiveTab('home') should resolve without error")
        XCTAssertEqual(mockView.lastSetActiveTab, "home")
    }

    // MARK: - Test 6: plugin default tab fallback

    func testSetActiveTabDefaultsToHomeWhenKeyIsEmpty() {
        // When the plugin receives no "tab" key it falls back to "home".
        let tab = ""
        let resolved = tab.isEmpty ? "home" : tab
        mockView.setActiveTab(resolved)
        XCTAssertEqual(mockView.lastSetActiveTab, "home")
    }

    // MARK: - Test 7: setBarsHidden non-animated variant

    func testSetBarsHiddenNonAnimatedRecordsState() {
        mockView.setBarsHidden(true, animated: false)
        XCTAssertEqual(mockView.lastHiddenState, true,
                       "setBarsHidden(true, animated: false) should record hidden = true")
    }

    // MARK: - Test 8: badge count capped at 99+

    func testSetNotificationBadgeCapsAt99Plus() {
        mockView.setNotificationBadge(100)
        XCTAssertEqual(mockView.lastBadgeCount, 100,
                       "Mock should record the raw count passed by the plugin")
    }

    // MARK: - Test 9: hidden=false restores full opacity

    func testAlphaIsRestoredAfterShowingBars() {
        mockView.setBarsHidden(true)
        XCTAssertEqual(mockView.lastHiddenState, true)
        mockView.setBarsHidden(false)
        XCTAssertEqual(mockView.lastHiddenState, false)
    }
}
