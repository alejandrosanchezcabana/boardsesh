import UIKit
import Capacitor
import Network
import WebKit

final class NetworkStatus {
    static let shared = NetworkStatus()

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.boardsesh.network-monitor")
    private let stateQueue = DispatchQueue(label: "com.boardsesh.network-state")
    private var isOnline = true

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            self?.stateQueue.async {
                self?.isOnline = path.status == .satisfied
            }
        }
        monitor.start(queue: monitorQueue)
    }

    func currentlyOnline() -> Bool {
        stateQueue.sync { isOnline }
    }
}

/// Intercepts WKNavigationDelegate calls to add offline-fallback behaviour,
/// then forwards every call to Capacitor's original navigation delegate
/// (WebViewDelegationHandler) so the bridge keeps working normally.
final class NavigationDelegateProxy: NSObject, WKNavigationDelegate {
    weak var original: WKNavigationDelegate?
    weak var controller: BoardseshViewController?

    // MARK: - Forwarded delegate methods

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        controller?.fallbackState.onPageStarted()
        original?.webView?(webView, didStartProvisionalNavigation: navigation)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        controller?.fallbackState.onPageFinished()
        original?.webView?(webView, didFinish: navigation)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        controller?.handleNavigationError(webView, error: error)
        original?.webView?(webView, didFail: navigation, withError: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        controller?.handleNavigationError(webView, error: error)
        original?.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
    }

    // Objective-C selectors for the two decidePolicyFor variants.
    // Using NSSelectorFromString avoids Swift #selector ambiguity between overloads.
    private static let decidePolicyForActionSel =
        NSSelectorFromString("webView:decidePolicyForNavigationAction:decisionHandler:")
    private static let decidePolicyForResponseSel =
        NSSelectorFromString("webView:decidePolicyForNavigationResponse:decisionHandler:")

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let orig = original, orig.responds(to: Self.decidePolicyForActionSel) {
            orig.webView?(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if let orig = original, orig.responds(to: Self.decidePolicyForResponseSel) {
            orig.webView?(webView, decidePolicyFor: navigationResponse, decisionHandler: decisionHandler)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if let orig = original, orig.responds(to: #selector(WKNavigationDelegate.webView(_:didReceive:completionHandler:))) {
            orig.webView?(webView, didReceive: challenge, completionHandler: completionHandler)
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        original?.webViewWebContentProcessDidTerminate?(webView)
    }
}

class BoardseshViewController: CAPBridgeViewController {
    let fallbackState = IOSOfflineFallbackStateMachine()
    private var delegateProxy: NavigationDelegateProxy?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        // Disable rubber-band bounce so the page cannot overscroll
        webView?.scrollView.bounces = false

        // Insert our proxy between the webView and Capacitor's delegate
        // so we can observe navigation failures for offline fallback.
        installNavigationProxy()

        // Start monitor eagerly so offline decisions have recent connectivity state.
        _ = NetworkStatus.shared

        // If a universal link triggered a cold start, navigate to it now
        // that the bridge and WebView are ready.
        loadPendingUniversalLink()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        // Fallback: the window may not be set during viewDidLoad on first launch.
        // Check again once the view is fully in the hierarchy.
        loadPendingUniversalLink()
    }

    private func installNavigationProxy() {
        guard let wv = webView else { return }
        let proxy = NavigationDelegateProxy()
        proxy.original = wv.navigationDelegate
        proxy.controller = self
        self.delegateProxy = proxy
        wv.navigationDelegate = proxy
    }

    private func loadPendingUniversalLink() {
        guard let sceneDelegate = view.window?.windowScene?.delegate as? SceneDelegate,
              let pendingURL = sceneDelegate.pendingUniversalLinkURL else {
            return
        }
        sceneDelegate.pendingUniversalLinkURL = nil
        webView?.load(URLRequest(url: pendingURL))
    }

    func handleNavigationError(_ webView: WKWebView, error: Error) {
        fallbackState.onMainFrameError(webView.url)
        if shouldTriggerOfflineFallback(error: error) {
            tryCacheThenFallback(webView)
        }
    }

    private func shouldTriggerOfflineFallback(error: Error) -> Bool {
        guard !NetworkStatus.shared.currentlyOnline() else {
            return false
        }

        return OfflineFallbackSupport.isRetryableNetworkError(error)
    }

    private func tryCacheThenFallback(_ webView: WKWebView) {
        let targetURL = fallbackState.retryURL(currentURL: webView.url)

        if fallbackState.shouldAttemptCacheFallback() {
            let request = URLRequest(
                url: targetURL,
                cachePolicy: .returnCacheDataElseLoad,
                timeoutInterval: 30
            )
            webView.load(request)
            return
        }

        let safeURL = htmlEscaped(targetURL.absoluteString)
        let errorHtml = """
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset='utf-8' />
            <meta name='viewport' content='width=device-width, initial-scale=1' />
            <title>You're offline</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #0A0A0A;
                color: #fff;
                margin: 0;
                padding: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                text-align: center;
              }
              main { max-width: 360px; }
              h1 { font-size: 24px; margin: 0 0 12px; }
              p { color: #c4c4c4; line-height: 1.5; }
              a {
                display: inline-block;
                margin-top: 8px;
                padding: 10px 14px;
                border-radius: 10px;
                background: #fff;
                color: #0A0A0A;
                text-decoration: none;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <main>
              <h1>You appear to be offline</h1>
              <p>We couldn't load Boardsesh from the network and no cached version was available yet. Check your connection and try again.</p>
              <p><a href='\(safeURL)'>Try again</a></p>
            </main>
          </body>
        </html>
        """

        webView.loadHTMLString(errorHtml, baseURL: nil)
    }

    private func htmlEscaped(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        .portrait
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        .portrait
    }

    override var shouldAutorotate: Bool {
        false
    }
}
