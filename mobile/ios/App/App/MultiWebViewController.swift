import UIKit
import WebKit
import Capacitor
import os.log

// MARK: - MultiWebViewController

/// Root view controller managing 5 webviews (one per tab) with a native tab bar.
///
/// The "climbs" tab uses the existing Capacitor bridge via `BoardseshViewController`,
/// embedded as a child view controller. The remaining 4 tabs (home, library, feed,
/// notifications) use lightweight `SatelliteBridge` webviews that share a single
/// `WKProcessPool` for cookie/session sharing.
final class MultiWebViewController: UIViewController {

    // MARK: - Tab Configuration

    static let tabOrder = ["home", "climbs", "library", "feed", "notifications"]

    static let tabInitialPaths: [String: String] = [
        "home": "/",
        "climbs": "/",          // Web layer navigates to the actual board URL
        "library": "/playlists",
        "feed": "/feed",
        "notifications": "/notifications",
    ]

    /// Loading priority after the active tab finishes loading.
    /// Note: "climbs" is excluded because Capacitor self-loads from capacitor.config.json.
    private static let deferredLoadOrder = ["feed", "library", "notifications"]

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.boardsesh.app", category: "MultiWebViewController")

    /// Shared process pool for cookie/session sharing across all webviews.
    /// Static so BoardseshViewController can read it during webViewConfiguration().
    static let sharedProcessPool = WKProcessPool()

    /// The native tab bar pinned to the bottom of the screen.
    private(set) var tabBarView: NativeTabBarView!

    /// Currently visible tab key.
    private(set) var activeTab: String = "home"

    /// Maps tab key to its WKWebView instance.
    private var tabWebViews: [String: WKWebView] = [:]

    /// Maps non-climbs tab key to its SatelliteBridge.
    private var satelliteBridges: [String: SatelliteBridge] = [:]

    /// The embedded Capacitor bridge view controller (climbs tab).
    private(set) var capacitorVC: BoardseshViewController!

    /// Base URL read from capacitor.config.json.
    private var serverUrl: String = ""

    /// Tracks which tabs have had their initial page load triggered.
    private var loadedTabs: Set<String> = []

    /// URL queued for navigation before the target webview has loaded.
    private var pendingNavigationURLs: [String: String] = [:]

    /// Universal link received before the webviews are ready.
    var pendingUniversalLinkURL: URL?

    /// Last injected tab bar height, used to avoid redundant CSS variable injection.
    private var lastInjectedTabBarHeight: CGFloat = 0

    /// Whether deferred tab loading has started.
    private var hasDeferredLoadsStarted = false

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = UIColor(red: 0.039, green: 0.039, blue: 0.039, alpha: 1.0) // #0A0A0A

        readServerUrl()
        setupCapacitorVC()
        setupSatelliteWebViews()
        setupTabBar()

        // Load the default active tab (home) immediately.
        loadTab("home")

        // Ensure the tab bar is always on top.
        view.bringSubviewToFront(tabBarView)

        // Memory pressure handling — unload non-visible satellite webviews.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )

        logger.info("MultiWebViewController loaded — serverUrl: \(self.serverUrl, privacy: .public)")
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        loadPendingUniversalLink()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        injectTabBarHeightIntoAllWebViews()
    }

    // MARK: - Orientation Lock

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation { .portrait }
    override var shouldAutorotate: Bool { false }

    // MARK: - Server URL

    /// Reads the server URL from the bundled `capacitor.config.json`.
    private func readServerUrl() {
        if let configURL = Bundle.main.url(forResource: "capacitor.config", withExtension: "json"),
           let data = try? Data(contentsOf: configURL),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let server = json["server"] as? [String: Any],
           let url = server["url"] as? String,
           !url.isEmpty {
            serverUrl = url
            logger.debug("Read server URL from capacitor.config.json: \(url, privacy: .public)")
            return
        }

        // Fallback to production URL if capacitor.config.json is unreadable.
        serverUrl = "https://www.boardsesh.com"
        logger.error("Could not read server.url from capacitor.config.json — falling back to \(self.serverUrl, privacy: .public)")
    }

    // MARK: - Capacitor VC Setup (Climbs Tab)

    private func setupCapacitorVC() {
        capacitorVC = BoardseshViewController()

        addChild(capacitorVC)
        capacitorVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(capacitorVC.view)

        NSLayoutConstraint.activate([
            capacitorVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            capacitorVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            capacitorVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            capacitorVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        capacitorVC.didMove(toParent: self)

        // Store the Capacitor webview reference once it's available.
        // CAPBridgeViewController creates its webview in loadView(), which fires
        // when we add the view above.
        if let webView = capacitorVC.webView {
            tabWebViews["climbs"] = webView
            // Capacitor starts loading from capacitor.config.json immediately
            // when its view is accessed, so mark it as loaded now.
            loadedTabs.insert("climbs")
            logger.debug("Stored Capacitor webview for climbs tab")
        } else {
            logger.error("BoardseshViewController.webView is nil after setup — climbs tab will not work")
        }

        // Climbs tab starts hidden; home is the default.
        capacitorVC.view.isHidden = true
    }

    // MARK: - Satellite WebView Setup

    private func setupSatelliteWebViews() {
        let satelliteTabKeys = Self.tabOrder.filter { $0 != "climbs" }

        for tabKey in satelliteTabKeys {
            let bridge = SatelliteBridge(tabKey: tabKey)
            bridge.onTabBarAction = { [weak self] methodName, options in
                self?.handleSatelliteTabBarAction(
                    tabKey: tabKey,
                    methodName: methodName,
                    options: options
                )
            }

            let webView = bridge.createWebView(processPool: Self.sharedProcessPool)
            webView.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(webView)

            NSLayoutConstraint.activate([
                webView.topAnchor.constraint(equalTo: view.topAnchor),
                webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            ])

            // Only the home tab is visible initially.
            webView.isHidden = (tabKey != "home")

            tabWebViews[tabKey] = webView
            satelliteBridges[tabKey] = bridge

            // Register satellite webview with the WebSocket broadcaster.
            WebSocketBroadcaster.shared.addSatelliteWebView(webView)

            logger.debug("Created satellite webview for tab: \(tabKey, privacy: .public)")
        }
    }

    // MARK: - Tab Bar Setup

    private func setupTabBar() {
        tabBarView = NativeTabBarView()
        tabBarView.translatesAutoresizingMaskIntoConstraints = false
        tabBarView.onTabTapped = { [weak self] tab in
            self?.handleTabTap(tab)
        }

        view.addSubview(tabBarView)

        NSLayoutConstraint.activate([
            tabBarView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabBarView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tabBarView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            tabBarView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -49),
        ])
    }

    // MARK: - Tab Navigation

    /// Called when the user taps a tab in the native tab bar.
    func handleTabTap(_ tab: String) {
        if tab == "create" {
            // "Create" has no dedicated webview — dispatch the event to the active webview.
            dispatchTabTappedEvent(tab: tab, to: activeTab)
            return
        }

        if tab == activeTab {
            // Same-tab tap: dispatch event (e.g., scroll to top) without switching.
            dispatchTabTappedEvent(tab: tab, to: activeTab)
            return
        }

        switchToTab(tab)
        dispatchTabTappedEvent(tab: tab, to: tab)
    }

    /// Switches the visible webview to the specified tab.
    func switchToTab(_ tab: String) {
        guard tab != activeTab else { return }
        guard Self.tabOrder.contains(tab) else {
            logger.warning("Attempted to switch to unknown tab: \(tab, privacy: .public)")
            return
        }

        // Hide the current tab's webview.
        hideWebView(for: activeTab)

        // Show the target tab's webview.
        showWebView(for: tab)

        let previousTab = activeTab
        activeTab = tab
        tabBarView.setActiveTab(tab)

        // Load the tab if it hasn't been loaded yet.
        loadTab(tab)

        // Bring tab bar to front after showing/hiding webviews.
        view.bringSubviewToFront(tabBarView)

        logger.debug("Switched from \(previousTab, privacy: .public) to \(tab, privacy: .public)")
    }

    /// Navigates a specific tab to the given URL, switching to it if needed.
    func navigateToTab(_ tab: String, url: String) {
        let targetTab = (tab == "create") ? activeTab : tab

        if targetTab != activeTab {
            switchToTab(targetTab)
        }

        guard let webView = tabWebViews[targetTab] else {
            logger.error("No webview for tab \(targetTab, privacy: .public) — cannot navigate to \(url, privacy: .public)")
            return
        }

        if loadedTabs.contains(targetTab) {
            // Webview is loaded: use client-side navigation to preserve React state.
            let escapedUrl = WebSocketBroadcaster.escapeForJavaScript(url)
            let js = "window.dispatchEvent(new CustomEvent('boardsesh:navigate',{detail:{url:\"\(escapedUrl)\"}}));"
            webView.evaluateJavaScript(js) { [logger] _, error in
                if let error = error {
                    logger.error("Client-side navigation failed for \(targetTab, privacy: .public): \(error.localizedDescription, privacy: .public)")
                }
            }
        } else {
            // Webview hasn't loaded yet: queue the URL and use it as the initial load URL.
            pendingNavigationURLs[targetTab] = url
            loadTab(targetTab)
        }
    }

    // MARK: - Tab Path Resolution

    /// Maps a URL path to the appropriate tab key.
    /// Mirrors the web-side `getActiveTab()` logic.
    static func tabForPath(_ path: String) -> String {
        if path == "/" { return "home" }
        if path.hasSuffix("/create") { return "create" }
        if path.hasPrefix("/feed") { return "feed" }
        if path.hasPrefix("/notifications") { return "notifications" }
        if path.hasPrefix("/playlists") || path.hasPrefix("/logbook") {
            return "library"
        }
        return "climbs"
    }

    // MARK: - Tab Loading

    /// Triggers the initial page load for a tab if it hasn't been loaded yet.
    func loadTab(_ tab: String) {
        guard !loadedTabs.contains(tab) else { return }
        loadedTabs.insert(tab)

        if tab == "climbs" {
            // Capacitor handles its own loading from capacitor.config.json.
            logger.debug("Climbs tab marked as loaded (Capacitor self-loads)")
            triggerDeferredLoadsIfNeeded()
            return
        }

        guard let webView = tabWebViews[tab] else {
            logger.error("No webview found for tab \(tab, privacy: .public) — cannot load")
            return
        }

        // Use the pending navigation URL if one was queued, otherwise use the default path.
        let path: String
        if let pendingUrl = pendingNavigationURLs.removeValue(forKey: tab) {
            path = pendingUrl
        } else {
            path = Self.tabInitialPaths[tab] ?? "/"
        }

        let fullUrlString: String
        if path.hasPrefix("http://") || path.hasPrefix("https://") {
            fullUrlString = path
        } else {
            fullUrlString = serverUrl + path
        }

        guard let url = URL(string: fullUrlString) else {
            logger.error("Invalid URL for tab \(tab, privacy: .public): \(fullUrlString, privacy: .public)")
            return
        }

        webView.load(URLRequest(url: url))
        logger.info("Loading tab \(tab, privacy: .public) with URL: \(fullUrlString, privacy: .public)")

        // Observe navigation completion to trigger deferred loads and inject CSS variables.
        if let bridge = satelliteBridges[tab] {
            bridge.onFirstLoadComplete = { [weak self] in
                self?.triggerDeferredLoadsIfNeeded()
                self?.injectTabBarHeightIntoWebView(tab)
            }
        }
    }

    /// Starts loading remaining tabs with staggered delays after the first tab finishes.
    private func triggerDeferredLoadsIfNeeded() {
        guard !hasDeferredLoadsStarted else { return }
        hasDeferredLoadsStarted = true

        logger.debug("Starting deferred tab loading")

        for (index, tab) in Self.deferredLoadOrder.enumerated() {
            guard !loadedTabs.contains(tab) else { continue }
            let delay = 0.5 * Double(index + 1)
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.loadTab(tab)
            }
        }
    }

    // MARK: - Universal Links

    /// Navigates to a pending universal link URL, determining the correct tab.
    func loadPendingUniversalLink() {
        guard let url = pendingUniversalLinkURL else { return }
        pendingUniversalLinkURL = nil

        let path = url.path
        let tab = Self.tabForPath(path)

        logger.info("Handling pending universal link: \(url.absoluteString, privacy: .public) -> tab \(tab, privacy: .public)")

        if tab == "create" {
            // Create has no webview — navigate to the path in the climbs tab.
            navigateToTab("climbs", url: url.absoluteString)
        } else {
            navigateToTab(tab, url: url.absoluteString)
        }
    }

    // MARK: - Memory Pressure

    @objc private func handleMemoryWarning() {
        logger.warning("Memory warning received — unloading non-visible satellite webviews")

        for tab in Self.tabOrder {
            // Keep the active tab and climbs tab alive.
            guard tab != activeTab, tab != "climbs" else { continue }
            guard loadedTabs.contains(tab) else { continue }
            guard let webView = tabWebViews[tab] else { continue }

            // Navigate to about:blank to free page resources.
            if let blankURL = URL(string: "about:blank") {
                webView.load(URLRequest(url: blankURL))
            }

            loadedTabs.remove(tab)
            satelliteBridges[tab]?.resetLoadState()
            logger.debug("Unloaded satellite webview for tab: \(tab, privacy: .public)")
        }
    }

    // MARK: - CSS Variable Injection

    /// Injects the `--native-tab-bar-height` CSS custom property into all loaded webviews.
    private func injectTabBarHeightIntoAllWebViews() {
        guard tabBarView.frame.height > 0 else { return }
        let height = tabBarView.frame.height
        guard height != lastInjectedTabBarHeight else { return }
        lastInjectedTabBarHeight = height

        for tab in Self.tabOrder {
            injectTabBarHeightIntoWebView(tab)
        }
    }

    /// Injects the tab bar height CSS variable into a single webview if loaded.
    private func injectTabBarHeightIntoWebView(_ tab: String) {
        guard tabBarView.frame.height > 0 else { return }
        guard loadedTabs.contains(tab) else { return }
        guard let webView = tabWebViews[tab] else { return }

        let height = tabBarView.frame.height
        let js = "document.documentElement.style.setProperty('--native-tab-bar-height','\(height)px');"
        webView.evaluateJavaScript(js) { [logger] _, error in
            if let error = error {
                logger.debug("CSS variable injection failed for \(tab, privacy: .public): \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    // MARK: - Event Dispatching

    /// Dispatches the `boardsesh:native-tab-tapped` event to a specific tab's webview.
    private func dispatchTabTappedEvent(tab tappedTab: String, to targetTab: String) {
        guard let webView = tabWebViews[targetTab] else {
            logger.debug("No webview for target tab \(targetTab, privacy: .public) — skipping event dispatch")
            return
        }

        let escapedTab = WebSocketBroadcaster.escapeForJavaScript(tappedTab)
        let js = "window.dispatchEvent(new CustomEvent('boardsesh:native-tab-tapped',{detail:{tab:'\(escapedTab)'}}));"
        webView.evaluateJavaScript(js) { [logger] _, error in
            if let error = error {
                logger.debug("Tab tapped event dispatch failed for \(targetTab, privacy: .public): \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    // MARK: - WebView Visibility

    private func hideWebView(for tab: String) {
        if tab == "climbs" {
            capacitorVC.view.isHidden = true
        } else {
            tabWebViews[tab]?.isHidden = true
        }
    }

    private func showWebView(for tab: String) {
        if tab == "climbs" {
            capacitorVC.view.isHidden = false
        } else {
            tabWebViews[tab]?.isHidden = false
        }
    }

    // MARK: - Satellite Plugin Call Forwarding

    /// Handles NativeTabBar calls from satellite webviews.
    /// The SatelliteBridge handles WebSocket calls internally; only tab bar calls
    /// need to route through the controller.
    private func handleSatelliteTabBarAction(
        tabKey: String,
        methodName: String,
        options: [String: String]
    ) {
        switch methodName {
        case "setActiveTab":
            let tab = options["tab"] ?? "home"
            tabBarView.setActiveTab(tab)

        case "setBarsHidden":
            let hidden = options["hidden"] == "1" || options["hidden"] == "true"
            tabBarView.setBarsHidden(hidden)

        case "setNotificationBadge":
            let count = Int(options["count"] ?? "0") ?? 0
            tabBarView.setNotificationBadge(count)

        case "navigateTab":
            let tab = options["tab"] ?? "home"
            let url = options["url"] ?? "/"
            navigateToTab(tab, url: url)

        default:
            logger.debug("Unhandled satellite tab bar call: \(methodName, privacy: .public) from \(tabKey, privacy: .public)")
        }
    }

    // MARK: - Cleanup

    deinit {
        NotificationCenter.default.removeObserver(self)

        // Break WKScriptMessageHandler retain cycles and clean up broadcaster refs.
        for (tab, bridge) in satelliteBridges {
            bridge.detach()
            if let webView = tabWebViews[tab] {
                WebSocketBroadcaster.shared.removeSatelliteWebView(webView)
            }
        }
    }
}
