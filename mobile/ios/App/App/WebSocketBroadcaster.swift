import Foundation
import WebKit
import os.log

/// Fans WebSocket events from `SessionWebSocketManager` out to satellite
/// `WKWebView` instances in the multi-webview architecture. The primary
/// (climbs) tab consumes WS data via `SessionWebSocketManager.onQueueStateChanged`
/// directly; this broadcaster exists purely to mirror raw frames into
/// satellite tabs.
///
/// Singleton because there is exactly one WS connection per app.
final class WebSocketBroadcaster: NSObject, WebSocketMessageDelegate {

    static let shared = WebSocketBroadcaster()

    private let logger = Logger(subsystem: "com.boardsesh.app", category: "WebSocketBroadcaster")

    /// Serial queue protecting the satellite registry.
    private let queue = DispatchQueue(label: "com.boardsesh.WebSocketBroadcaster.state")

    /// Auto-zeroing weak set of satellite webviews.
    private let _satellites: NSHashTable<WKWebView> = .weakObjects()

    private override init() { super.init() }

    // MARK: - Public API

    /// Register a satellite webview to receive broadcast messages.
    func addSatelliteWebView(_ webView: WKWebView) {
        queue.async {
            self._satellites.add(webView)
            self.logger.debug("Added satellite webview — count: \(self._satellites.count)")
        }
    }

    /// Remove a specific satellite webview from the broadcast set.
    func removeSatelliteWebView(_ webView: WKWebView) {
        queue.async {
            self._satellites.remove(webView)
            self.logger.debug("Removed satellite webview — count: \(self._satellites.count)")
        }
    }

    /// Remove all satellite webviews.
    func removeAllSatellites() {
        queue.async {
            self._satellites.removeAllObjects()
            self.logger.debug("Removed all satellite webviews")
        }
    }

    // MARK: - WebSocketMessageDelegate

    func didReceiveRawMessage(_ text: String) {
        let webViews = queue.sync { self._satellites.allObjects }
        guard !webViews.isEmpty else { return }

        let escaped = Self.escapeForJavaScript(text)
        let js = "window.dispatchEvent(new CustomEvent('boardsesh:ws-message',{detail:{raw:\"\(escaped)\"}}));"

        DispatchQueue.main.async { [logger] in
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
        let webViews = queue.sync { self._satellites.allObjects }
        guard !webViews.isEmpty else { return }

        let state: String
        if connected {
            state = "connected"
        } else if reconnectAttempt > 0 {
            state = "reconnecting"
        } else {
            state = "disconnected"
        }

        let js = "window.dispatchEvent(new CustomEvent('boardsesh:ws-connection-state',{detail:{state:\"\(state)\",reconnectAttempt:\(reconnectAttempt)}}));"

        DispatchQueue.main.async { [logger] in
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
