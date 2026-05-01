import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        // Save any universal link that triggered this cold start.
        // The webviews aren't ready yet, so we store it and let
        // MultiWebViewController pick it up after viewDidLoad.
        var pendingURL: URL?
        if let userActivity = connectionOptions.userActivities.first(where: {
            $0.activityType == NSUserActivityTypeBrowsingWeb
        }), let url = userActivity.webpageURL {
            pendingURL = url
        }

        let window = UIWindow(windowScene: windowScene)
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        let rootVC = storyboard.instantiateInitialViewController()
        if let multiWebVC = rootVC as? MultiWebViewController, let url = pendingURL {
            multiWebVC.pendingUniversalLinkURL = url
        }
        window.rootViewController = rootVC
        self.window = window
        window.makeKeyAndVisible()

        // Clean up any orphaned Live Activities from a previous session/crash.
        if #available(iOS 16.1, *) {
            Task.detached(priority: .utility) {
                await LiveActivityManager.shared.endStaleActivities()
                await LiveActivityManager.shared.cleanupOrphanedActivities()
            }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            let _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                open: context.url,
                options: [:]
            )
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        // Forward to Capacitor's proxy for plugin handling
        let _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )

        // Navigate the correct tab's webview for universal links (warm start).
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
           let url = userActivity.webpageURL,
           let multiVC = window?.rootViewController as? MultiWebViewController {
            let tab = MultiWebViewController.tabForPath(url.path)
            let targetTab = (tab == "create") ? "climbs" : tab
            multiVC.navigateToTab(targetTab, url: url.absoluteString)
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        SessionWebSocketManager.shared.disconnect()
        if #available(iOS 16.1, *) {
            Task.detached(priority: .utility) {
                await LiveActivityManager.shared.endAllActivities()
            }
        }
    }
    func sceneDidBecomeActive(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}
    func sceneWillEnterForeground(_ scene: UIScene) {}
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
