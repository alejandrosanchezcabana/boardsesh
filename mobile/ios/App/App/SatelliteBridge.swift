import UIKit
import WebKit
import os.log

// MARK: - SatelliteBridge

/// Manages a single "satellite" WKWebView (non-Capacitor) for the multi-webview
/// tab architecture. Injects a JavaScript shim that emulates `window.Capacitor`
/// so the web app's `isNativeApp()` detection works, and routes plugin calls
/// from JS back to native singletons.
final class SatelliteBridge: NSObject, WKScriptMessageHandler, WKNavigationDelegate {

    // MARK: - Types

    /// Callback invoked when the satellite webview makes a NativeTabBar plugin call.
    /// Parameters: (methodName, options dictionary).
    typealias TabBarAction = (_ methodName: String, _ options: [String: String]) -> Void

    // MARK: - Properties

    let tabKey: String
    private let logger = Logger(subsystem: "com.boardsesh.app", category: "SatelliteBridge")
    weak var webView: WKWebView?
    var onTabBarAction: TabBarAction?

    /// Called once when the webview finishes its first navigation.
    var onFirstLoadComplete: (() -> Void)?
    private var hasCompletedFirstLoad = false

    // MARK: - Init

    /// - Parameters:
    ///   - tabKey: The tab identifier (e.g. "home", "climbs") injected as
    ///     `window.__BOARDSESH_TAB__` in the JS shim.
    ///   - onTabBarAction: Callback for NativeTabBar plugin calls from JS.
    init(tabKey: String, onTabBarAction: TabBarAction? = nil) {
        self.tabKey = tabKey
        self.onTabBarAction = onTabBarAction
        super.init()
    }

    // MARK: - WebView Factory

    /// Creates a properly configured `WKWebView` with the Capacitor shim injected
    /// and the bridge message handler registered.
    ///
    /// - Parameters:
    ///   - processPool: A shared `WKProcessPool` for cookie sharing across all webviews.
    /// - Returns: A configured `WKWebView` ready to load web content.
    func createWebView(processPool: WKProcessPool) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.processPool = processPool
        config.websiteDataStore = WKWebsiteDataStore.default()

        // Match Capacitor webview settings
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.suppressesIncrementalRendering = false

        let pagePrefs = WKWebpagePreferences()
        pagePrefs.allowsContentJavaScript = true
        pagePrefs.preferredContentMode = .mobile
        config.defaultWebpagePreferences = pagePrefs

        // Inject the Capacitor shim at document start
        let shimScript = WKUserScript(
            source: buildJSShim(),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(shimScript)

        // Register this bridge as the message handler
        config.userContentController.add(self, name: "bridge")

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.isOpaque = false
        wv.underPageBackgroundColor = UIColor(red: 0.039, green: 0.039, blue: 0.039, alpha: 1.0)
        wv.scrollView.backgroundColor = UIColor(red: 0.039, green: 0.039, blue: 0.039, alpha: 1.0)
        wv.navigationDelegate = self
        self.webView = wv

        return wv
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !hasCompletedFirstLoad else { return }
        hasCompletedFirstLoad = true
        logger.debug("First load complete for tab: \(self.tabKey, privacy: .public)")
        onFirstLoadComplete?()
        onFirstLoadComplete = nil
    }

    // NOTE: Cross-tab navigation interception for full page loads (window.location,
    // link clicks) is NOT done via WKNavigationDelegate.decidePolicyFor because it
    // can't distinguish server redirects (which must be followed) from user-initiated
    // cross-tab navigations. Instead, the history.pushState/replaceState interceptor
    // in the JS shim handles client-side navigations, which covers the vast majority
    // of cross-tab navigation cases in this SPA.

    // MARK: - Cleanup

    /// Removes the message handler to break the retain cycle.
    /// Call this before discarding the webview.
    func detach() {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "bridge")
        webView = nil
        onTabBarAction = nil
    }

    /// Resets the first-load tracking so `onFirstLoadComplete` can fire again
    /// after a memory-pressure unload/reload cycle.
    func resetLoadState() {
        hasCompletedFirstLoad = false
    }

    // MARK: - Dispatch Events to JS

    /// Dispatches a Capacitor-style event to the satellite webview's registered
    /// JS listeners. Thread-safe: always dispatches to main queue.
    ///
    /// - Parameters:
    ///   - pluginId: The plugin identifier (e.g. "NativeWebSocket").
    ///   - eventName: The event name (e.g. "wsMessage", "connectionStateChanged").
    ///   - data: A JSON-serializable dictionary of event data.
    func dispatchEvent(pluginId: String, eventName: String, data: [String: String]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: data),
              let jsonString = String(data: jsonData, encoding: .utf8)
        else {
            logger.error("Failed to serialize event data for \(eventName, privacy: .public)")
            return
        }

        let js = """
        (function() {
            var key = '\(pluginId):\(eventName)';
            var listeners = (window.__satelliteListeners || {})[key] || [];
            var data = \(jsonString);
            for (var i = 0; i < listeners.length; i++) {
                try { listeners[i](data); } catch(e) { console.error('[SatelliteBridge] listener error:', e); }
            }
        })();
        """

        dispatchJS(js)
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: AnyObject] else {
            logger.warning("Received non-dictionary bridge message")
            return
        }

        guard let pluginId = body["pluginId"] as? String,
              let methodName = body["methodName"] as? String,
              let callbackId = body["callbackId"] as? String
        else {
            logger.warning("Bridge message missing required fields (pluginId, methodName, callbackId)")
            return
        }

        let options = body["options"] as? [String: AnyObject] ?? [:]

        logger.debug("Bridge call: \(pluginId, privacy: .public).\(methodName, privacy: .public) callback=\(callbackId, privacy: .public)")

        switch pluginId {
        case "NativeTabBar":
            handleTabBarCall(methodName: methodName, callbackId: callbackId, options: options)
        case "NativeWebSocket":
            handleWebSocketCall(methodName: methodName, callbackId: callbackId, options: options)
        default:
            logger.warning("Unknown pluginId: \(pluginId, privacy: .public)")
            resolveCallback(callbackId: callbackId, success: false, data: ["error": "Unknown plugin: \(pluginId)"])
        }
    }

    // MARK: - NativeTabBar Routing

    private func handleTabBarCall(methodName: String, callbackId: String, options: [String: AnyObject]) {
        // Convert options to [String: String] for the callback.
        // WKScriptMessageHandler is always called on the main thread.
        var stringOptions: [String: String] = [:]
        for (key, value) in options {
            stringOptions[key] = "\(value)"
        }

        onTabBarAction?(methodName, stringOptions)
        resolveCallback(callbackId: callbackId, success: true, data: [:])
    }

    // MARK: - NativeWebSocket Routing

    private func handleWebSocketCall(methodName: String, callbackId: String, options: [String: AnyObject]) {
        let manager = SessionWebSocketManager.shared

        switch methodName {
        case "getConnectionState":
            // Read-only: any tab can ask whether the climbs-owned connection
            // is currently up. Used by satellites that want to render a
            // "reconnecting…" badge.
            resolveCallback(callbackId: callbackId, success: true, data: [
                "connected": manager.isConnected ? "true" : "false",
                "reconnectAttempt": "\(manager.reconnectAttempt)",
            ])

        case "connect", "disconnect", "updateAuthToken",
             "sendOperation", "subscribe", "unsubscribe",
             "setWebviewActive", "flushBuffer":
            // The climbs tab owns the WebSocket connection and all of its
            // mutations (subscriptions, auth, active-state, send). Satellite
            // tabs are read-only consumers via `boardsesh:ws-message` /
            // `boardsesh:ws-connection-state` events broadcast by
            // WebSocketBroadcaster, so we reject every mutation here. This
            // also matches main, where SessionWebSocketManager no longer
            // exposes these methods — calling them from a satellite would
            // be a no-op at best and a crash at worst.
            logger.warning("Satellite \(self.tabKey, privacy: .public) attempted '\(methodName, privacy: .public)' — rejected (climbs tab owns the connection)")
            resolveCallback(callbackId: callbackId, success: false, data: [
                "error": "Satellite tabs cannot '\(methodName)' the WebSocket; the climbs tab owns the connection lifecycle. Listen for boardsesh:ws-message events instead.",
            ])

        default:
            logger.warning("Unknown NativeWebSocket method: \(methodName, privacy: .public)")
            resolveCallback(callbackId: callbackId, success: false, data: ["error": "Unknown method: \(methodName)"])
        }
    }

    // MARK: - Callback Resolution

    /// Resolves or rejects a JS promise via the `__capacitorCallback` bridge function.
    private func resolveCallback(callbackId: String, success: Bool, data: [String: String]) {
        let resultDict: [String: String] = data
        guard let jsonData = try? JSONSerialization.data(withJSONObject: resultDict),
              let jsonString = String(data: jsonData, encoding: .utf8)
        else {
            let fallback = success ? "{}" : "{\"error\":\"serialization failed\"}"
            let js = "window.__capacitorCallback('\(callbackId)', \(success), \(fallback));"
            dispatchJS(js)
            return
        }

        let js = "window.__capacitorCallback('\(callbackId)', \(success), \(jsonString));"
        dispatchJS(js)
    }

    // MARK: - JS Execution

    /// Evaluates JavaScript in the satellite webview on the main queue.
    private func dispatchJS(_ js: String) {
        let logger = self.logger
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js) { _, error in
                if let error {
                    logger.error("JS eval error: \(error.localizedDescription, privacy: .public)")
                }
            }
        }
    }

    // MARK: - Helpers

    private func parseVariablesFromOptions(_ options: [String: AnyObject]) -> [String: Any] {
        // Variables may arrive as a JSON string or as a dictionary
        if let variablesDict = options["variables"] as? [String: Any] {
            return variablesDict
        }
        if let jsonString = options["variables"] as? String,
           let data = jsonString.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return parsed
        }
        return [:]
    }

    // MARK: - JS Shim

    /// Builds the JavaScript shim that creates `window.Capacitor` and plugin
    /// stubs on the satellite webview. This runs at document start before the
    /// web app's own scripts execute.
    private func buildJSShim() -> String {
        // The shim uses an IIFE to avoid polluting the global scope with
        // helper variables. Only the public API surfaces are attached to window.
        return """
        (function() {
            'use strict';

            // ── Callback infrastructure ──────────────────────────────────
            var pendingCallbacks = {};
            var callbackCounter = 0;

            window.__capacitorCallback = function(callbackId, success, data) {
                var entry = pendingCallbacks[callbackId];
                if (!entry) return;
                delete pendingCallbacks[callbackId];
                if (success) {
                    entry.resolve(data || {});
                } else {
                    entry.reject(data || { error: 'unknown error' });
                }
            };

            function postBridgeMessage(pluginId, methodName, options) {
                return new Promise(function(resolve, reject) {
                    var callbackId = 'cb_' + (++callbackCounter) + '_' + Date.now();
                    pendingCallbacks[callbackId] = { resolve: resolve, reject: reject };
                    window.webkit.messageHandlers.bridge.postMessage({
                        pluginId: pluginId,
                        methodName: methodName,
                        callbackId: callbackId,
                        options: options || {}
                    });
                });
            }

            // ── Event listener infrastructure ────────────────────────────
            window.__satelliteListeners = {};

            function addPluginListener(pluginId, eventName, callback) {
                var key = pluginId + ':' + eventName;
                if (!window.__satelliteListeners[key]) {
                    window.__satelliteListeners[key] = [];
                }
                window.__satelliteListeners[key].push(callback);
                return Promise.resolve({
                    remove: function() {
                        var arr = window.__satelliteListeners[key];
                        if (!arr) return;
                        var idx = arr.indexOf(callback);
                        if (idx !== -1) arr.splice(idx, 1);
                    }
                });
            }

            // ── NativeTabBar stub ────────────────────────────────────────
            var NativeTabBar = {
                setActiveTab: function(opts) {
                    return postBridgeMessage('NativeTabBar', 'setActiveTab', opts);
                },
                setBarsHidden: function(opts) {
                    return postBridgeMessage('NativeTabBar', 'setBarsHidden', opts);
                },
                setNotificationBadge: function(opts) {
                    return postBridgeMessage('NativeTabBar', 'setNotificationBadge', opts);
                },
                navigateTab: function(opts) {
                    return postBridgeMessage('NativeTabBar', 'navigateTab', opts);
                },
                addListener: function(eventName, callback) {
                    return addPluginListener('NativeTabBar', eventName, callback);
                }
            };

            // ── NativeWebSocket stub ─────────────────────────────────────
            var NativeWebSocket = {
                connect: function(opts) {
                    return postBridgeMessage('NativeWebSocket', 'connect', opts);
                },
                disconnect: function(opts) {
                    return postBridgeMessage('NativeWebSocket', 'disconnect', opts);
                },
                sendOperation: function(opts) {
                    return postBridgeMessage('NativeWebSocket', 'sendOperation', opts);
                },
                subscribe: function(opts) {
                    return postBridgeMessage('NativeWebSocket', 'subscribe', opts);
                },
                unsubscribe: function(opts) {
                    return postBridgeMessage('NativeWebSocket', 'unsubscribe', opts);
                },
                updateAuthToken: function(opts) {
                    return postBridgeMessage('NativeWebSocket', 'updateAuthToken', opts);
                },
                setWebviewActive: function(opts) {
                    return postBridgeMessage('NativeWebSocket', 'setWebviewActive', opts);
                },
                flushBuffer: function(opts) {
                    return postBridgeMessage('NativeWebSocket', 'flushBuffer', opts);
                },
                getConnectionState: function(opts) {
                    return postBridgeMessage('NativeWebSocket', 'getConnectionState', opts);
                },
                addListener: function(eventName, callback) {
                    return addPluginListener('NativeWebSocket', eventName, callback);
                }
            };

            // ── Browser stub (for social login and external links) ──────
            var CAPBrowser = {
                open: function(opts) {
                    if (opts && opts.url) {
                        window.open(opts.url, '_blank');
                    }
                    return Promise.resolve();
                },
                close: function() { return Promise.resolve(); },
                addListener: function(eventName, callback) {
                    return addPluginListener('CAPBrowser', eventName, callback);
                }
            };

            // ── LiveActivity stub (no-op on satellite, events only reach climbs tab) ──
            var LiveActivity = {
                isAvailable: function() { return Promise.resolve({ available: false }); },
                startSession: function() { return Promise.resolve(); },
                endSession: function() { return Promise.resolve(); },
                updateActivity: function() { return Promise.resolve(); },
                updateActivityClimb: function() { return Promise.resolve(); },
                addListener: function(eventName, callback) {
                    return addPluginListener('LiveActivity', eventName, callback);
                }
            };

            // ── window.Capacitor ─────────────────────────────────────────
            window.Capacitor = {
                isNativePlatform: function() { return true; },
                getPlatform: function() { return 'ios'; },
                Plugins: {
                    NativeTabBar: NativeTabBar,
                    NativeWebSocket: NativeWebSocket,
                    CAPBrowserPlugin: CAPBrowser,
                    LiveActivity: LiveActivity
                }
            };

            // ── Tab identifier ───────────────────────────────────────────
            window.__BOARDSESH_TAB__ = '\(tabKey)';

            // ── Cross-tab navigation interceptor ────────────────────────
            // Next.js router.push() uses history.pushState under the hood.
            // Intercept it to detect cross-tab navigations and redirect
            // them to the native tab switch instead of navigating in-place.
            var currentTab = '\(tabKey)';

            function getTabForPath(path) {
                if (path === '/') return 'home';
                if (path.match(/\\/create$/)) return 'create';
                if (path.indexOf('/feed') === 0) return 'feed';
                if (path.indexOf('/you') === 0) return 'you';
                if (path.indexOf('/playlists') === 0) return 'library';
                return 'climbs';
            }

            function extractPath(url) {
                if (!url) return null;
                try {
                    // Handle both absolute URLs and relative paths
                    if (url.indexOf('://') !== -1) {
                        return new URL(url).pathname;
                    }
                    // Strip query string and hash
                    return url.split('?')[0].split('#')[0];
                } catch(e) {
                    return null;
                }
            }

            var _origPushState = history.pushState;
            var _origReplaceState = history.replaceState;

            history.pushState = function(state, title, url) {
                var path = extractPath(url);
                if (path) {
                    var targetTab = getTabForPath(path);
                    if (targetTab !== currentTab && targetTab !== 'create') {
                        // Cross-tab navigation: redirect to native tab switch
                        var fullUrl = url;
                        if (url && url.indexOf('://') === -1) {
                            fullUrl = window.location.origin + (url.charAt(0) === '/' ? '' : '/') + url;
                        }
                        postBridgeMessage('NativeTabBar', 'navigateTab', {
                            tab: targetTab,
                            url: fullUrl || url
                        });
                        return; // Do NOT push state in this webview
                    }
                }
                return _origPushState.apply(this, arguments);
            };

            history.replaceState = function(state, title, url) {
                var path = extractPath(url);
                if (path) {
                    var targetTab = getTabForPath(path);
                    if (targetTab !== currentTab && targetTab !== 'create') {
                        var fullUrl = url;
                        if (url && url.indexOf('://') === -1) {
                            fullUrl = window.location.origin + (url.charAt(0) === '/' ? '' : '/') + url;
                        }
                        postBridgeMessage('NativeTabBar', 'navigateTab', {
                            tab: targetTab,
                            url: fullUrl || url
                        });
                        return;
                    }
                }
                return _origReplaceState.apply(this, arguments);
            };
        })();
        """
    }
}
