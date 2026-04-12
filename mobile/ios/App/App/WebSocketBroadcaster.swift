import Foundation
import WebKit
import os.log

/// Broadcasts WebSocket messages to both the primary Capacitor bridge webview
/// (via the primary delegate) and any satellite `WKWebView` instances.
///
/// There is only one WebSocket connection per app, so this is a singleton.
final class WebSocketBroadcaster: NSObject, WebSocketMessageDelegate {

    static let shared = WebSocketBroadcaster()

    private let logger = Logger(subsystem: "com.boardsesh.app", category: "WebSocketBroadcaster")

    /// Serial queue protecting all mutable state (delegate + satellite references).
    private let queue = DispatchQueue(label: "com.boardsesh.WebSocketBroadcaster.state")

    // MARK: - Primary Delegate

    /// Weak reference to the primary delegate (NativeWebSocketPlugin) that forwards
    /// messages through `notifyListeners` to the Capacitor bridge webview.
    private weak var _primaryDelegate: (any WebSocketMessageDelegate)?

    // MARK: - Satellite WebViews

    /// Auto-zeroing weak set of satellite webviews.
    private let _satellites: NSHashTable<WKWebView> = .weakObjects()

    // MARK: - Init

    private override init() { super.init() }

    // MARK: - Public API

    /// Set (or clear) the primary delegate that receives messages via the
    /// `WebSocketMessageDelegate` protocol.
    func setPrimaryDelegate(_ delegate: (any WebSocketMessageDelegate)?) {
        queue.sync {
            self._primaryDelegate = delegate
        }
    }

    /// Register a satellite webview to receive broadcast messages.
    func addSatelliteWebView(_ webView: WKWebView) {
        queue.sync {
            self._satellites.add(webView)
            self.logger.debug("Added satellite webview — count: \(self._satellites.count)")
        }
    }

    /// Remove a specific satellite webview from the broadcast set.
    func removeSatelliteWebView(_ webView: WKWebView) {
        queue.sync {
            self._satellites.remove(webView)
            self.logger.debug("Removed satellite webview — count: \(self._satellites.count)")
        }
    }

    /// Remove all satellite webviews.
    func removeAllSatellites() {
        queue.sync {
            self._satellites.removeAllObjects()
            self.logger.debug("Removed all satellite webviews")
        }
    }

    // MARK: - WebSocketMessageDelegate

    func didReceiveRawMessage(_ text: String) {
        let (delegate, webViews) = queue.sync {
            (self._primaryDelegate, self._satellites.allObjects)
        }

        // Single main-queue dispatch for both paths to preserve message ordering.
        let escaped = webViews.isEmpty ? nil : Self.escapeForJavaScript(text)
        let js = escaped.map { "window.dispatchEvent(new CustomEvent('boardsesh:ws-message',{detail:{raw:\"\($0)\"}}));" }

        DispatchQueue.main.async { [logger] in
            // Forward to the Capacitor plugin (existing path).
            delegate?.didReceiveRawMessage(text)

            // Deliver to every satellite webview via JavaScript CustomEvent.
            guard let js else { return }
            for webView in webViews {
                webView.evaluateJavaScript(js) { _, error in
                    if let error = error {
                        logger.error("Satellite evaluateJavaScript failed: \(error.localizedDescription)")
                    }
                }
            }
        }
    }

    func connectionStateDidChange(connected: Bool, reconnectAttempt: Int) {
        let (delegate, webViews) = queue.sync {
            (self._primaryDelegate, self._satellites.allObjects)
        }

        // Derive a human-readable state string.
        let state: String
        if connected {
            state = "connected"
        } else if reconnectAttempt > 0 {
            state = "reconnecting"
        } else {
            state = "disconnected"
        }

        let js = webViews.isEmpty ? nil :
            "window.dispatchEvent(new CustomEvent('boardsesh:ws-connection-state',{detail:{state:\"\(state)\",reconnectAttempt:\(reconnectAttempt)}}));"

        DispatchQueue.main.async { [logger] in
            // Forward to the primary delegate (Capacitor plugin).
            delegate?.connectionStateDidChange(connected: connected, reconnectAttempt: reconnectAttempt)

            // Deliver to satellite webviews.
            guard let js else { return }
            for webView in webViews {
                webView.evaluateJavaScript(js) { _, error in
                    if let error = error {
                        logger.error("Satellite evaluateJavaScript (connectionState) failed: \(error.localizedDescription)")
                    }
                }
            }
        }
    }

    // MARK: - JavaScript Escaping

    /// Escapes a string so it can be safely placed inside a JavaScript double-quoted
    /// string literal. Handles backslashes, quotes, newlines, carriage returns,
    /// line/paragraph separators, and null bytes.
    static func escapeForJavaScript(_ string: String) -> String {
        var result = ""
        result.reserveCapacity(string.count)
        for char in string {
            switch char {
            case "\\":
                result += "\\\\"
            case "\"":
                result += "\\\""
            case "\n":
                result += "\\n"
            case "\r":
                result += "\\r"
            case "\t":
                result += "\\t"
            case "\u{2028}":
                result += "\\u2028"
            case "\u{2029}":
                result += "\\u2029"
            case "\0":
                result += "\\0"
            default:
                result.append(char)
            }
        }
        return result
    }
}
