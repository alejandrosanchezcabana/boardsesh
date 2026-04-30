import XCTest
@testable import App

// MARK: - NativeTabBarViewTests

final class NativeTabBarViewTests: XCTestCase {

    private var tabBarView: NativeTabBarView!

    override func setUp() {
        super.setUp()
        tabBarView = NativeTabBarView()
        // Give the view a real frame so Auto Layout constraints resolve correctly.
        tabBarView.frame = CGRect(x: 0, y: 0, width: 390, height: 83)
        tabBarView.layoutIfNeeded()
    }

    override func tearDown() {
        tabBarView = nil
        super.tearDown()
    }

    // MARK: - Helpers

    /// Collect all UIButton instances in the view hierarchy recursively.
    private func allButtons(in view: UIView) -> [UIButton] {
        var result: [UIButton] = []
        for sub in view.subviews {
            if let btn = sub as? UIButton {
                result.append(btn)
            }
            result.append(contentsOf: allButtons(in: sub))
        }
        return result
    }

    /// Find a button whose accessibilityIdentifier matches "tab-<key>".
    private func button(forTab key: String) -> UIButton? {
        allButtons(in: tabBarView).first { $0.accessibilityIdentifier == "tab-\(key)" }
    }

    // MARK: - Test 1: Six buttons exist after init

    func testAllSixButtonsExistAfterInit() {
        let expectedKeys = ["home", "climbs", "library", "feed", "create", "you"]
        for key in expectedKeys {
            XCTAssertNotNil(button(forTab: key), "Expected a button for tab '\(key)'")
        }
        let allTabButtons = expectedKeys.compactMap { button(forTab: $0) }
        XCTAssertEqual(allTabButtons.count, 6, "Expected exactly 6 tab buttons")
    }

    // MARK: - Test 2: setActiveTab highlights the correct button

    func testSetActiveTabHighlightsCorrectButton() {
        tabBarView.setActiveTab("home")

        let homeButton = button(forTab: "home")
        XCTAssertNotNil(homeButton)
        XCTAssertEqual(homeButton?.tintColor, NativeTabBarView.activeColor,
                       "Home button should have active tint color after setActiveTab('home')")

        let expectedKeys = ["climbs", "library", "feed", "create", "you"]
        for key in expectedKeys {
            let btn = button(forTab: key)
            XCTAssertNotNil(btn)
            XCTAssertEqual(btn?.tintColor, NativeTabBarView.inactiveColor,
                           "'\(key)' button should have inactive tint color")
        }
    }

    // MARK: - Test 3: setActiveTab changes the highlight from one tab to another

    func testSetActiveTabChangesHighlight() {
        tabBarView.setActiveTab("home")

        let homeButtonBefore = button(forTab: "home")
        XCTAssertEqual(homeButtonBefore?.tintColor, NativeTabBarView.activeColor)

        tabBarView.setActiveTab("climbs")

        let climbsButton = button(forTab: "climbs")
        XCTAssertEqual(climbsButton?.tintColor, NativeTabBarView.activeColor,
                       "Climbs button should be active after switching to 'climbs'")

        let homeButtonAfter = button(forTab: "home")
        XCTAssertEqual(homeButtonAfter?.tintColor, NativeTabBarView.inactiveColor,
                       "Home button should be inactive after switching away")
    }

    // MARK: - Test 4: setActiveTab with an unknown tab key does not crash

    func testSetActiveTabWithUnknownTabDoesNotCrash() {
        XCTAssertNoThrow(tabBarView.setActiveTab("unknown"),
                         "setActiveTab with an unrecognised key should not crash")
    }

    // MARK: - Test 5: setNotificationBadge shows the badge with correct text

    func testSetNotificationBadgeShowsBadge() {
        tabBarView.setNotificationBadge(5)

        let badge = findNotificationBadge()
        XCTAssertNotNil(badge, "Notification badge label should exist")
        XCTAssertFalse(badge?.isHidden ?? true, "Badge should be visible when count > 0")
        XCTAssertEqual(badge?.text, "5", "Badge text should be '5'")
    }

    // MARK: - Test 6: setNotificationBadge(0) hides the badge

    func testSetNotificationBadgeZeroHidesBadge() {
        tabBarView.setNotificationBadge(3)
        tabBarView.setNotificationBadge(0)

        let badge = findNotificationBadge()
        XCTAssertNotNil(badge)
        XCTAssertTrue(badge?.isHidden ?? false, "Badge should be hidden when count is 0")
    }

    // MARK: - Test 7: setNotificationBadge caps at "99+"

    func testSetNotificationBadgeCapsAt99Plus() {
        tabBarView.setNotificationBadge(100)

        let badge = findNotificationBadge()
        XCTAssertNotNil(badge)
        XCTAssertFalse(badge?.isHidden ?? true)
        XCTAssertEqual(badge?.text, "99+", "Badge should show '99+' for counts over 99")
    }

    // MARK: - Test 8: onTabTapped closure is called with the correct tab key

    func testOnTabTappedClosureCalledWithCorrectKey() {
        var tappedKey: String?
        tabBarView.onTabTapped = { key in
            tappedKey = key
        }

        guard let climbsButton = button(forTab: "climbs") else {
            XCTFail("Climbs button not found")
            return
        }

        climbsButton.sendActions(for: .touchUpInside)

        XCTAssertEqual(tappedKey, "climbs",
                       "onTabTapped should be called with 'climbs' when that button is tapped")
    }

    // MARK: - Private Helpers

    /// Locate the red notification badge UILabel inside the You button.
    private func findNotificationBadge() -> UILabel? {
        guard let youButton = button(forTab: "you") else { return nil }
        for sub in youButton.subviews {
            if let label = sub as? UILabel, label.backgroundColor == UIColor(red: 0.937, green: 0.267, blue: 0.267, alpha: 1.0) {
                return label
            }
        }
        return nil
    }
}
