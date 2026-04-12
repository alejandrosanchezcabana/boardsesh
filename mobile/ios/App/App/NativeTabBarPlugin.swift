import Capacitor
import UIKit

@objc(NativeTabBarPlugin)
public class NativeTabBarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeTabBarPlugin"
    public let jsName = "NativeTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setActiveTab",         returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBarsHidden",        returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNotificationBadge", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "navigateTab",          returnType: CAPPluginReturnPromise),
    ]

    /// Walks up the view controller hierarchy to find the MultiWebViewController.
    private var multiWebVC: MultiWebViewController? {
        var vc: UIViewController? = bridge?.viewController
        while let current = vc {
            if let multi = current as? MultiWebViewController {
                return multi
            }
            vc = current.parent
        }
        return nil
    }

    // MARK: - setActiveTab

    @objc func setActiveTab(_ call: CAPPluginCall) {
        let tab = call.getString("tab") ?? "home"
        DispatchQueue.main.async {
            self.multiWebVC?.tabBarView?.setActiveTab(tab)
            call.resolve()
        }
    }

    // MARK: - setBarsHidden

    @objc func setBarsHidden(_ call: CAPPluginCall) {
        let hidden = call.getBool("hidden") ?? false
        DispatchQueue.main.async {
            self.multiWebVC?.tabBarView?.setBarsHidden(hidden)
            call.resolve()
        }
    }

    // MARK: - setNotificationBadge

    @objc func setNotificationBadge(_ call: CAPPluginCall) {
        let count = call.getInt("count") ?? 0
        DispatchQueue.main.async {
            self.multiWebVC?.tabBarView?.setNotificationBadge(count)
            call.resolve()
        }
    }

    // MARK: - navigateTab

    @objc func navigateTab(_ call: CAPPluginCall) {
        let tab = call.getString("tab") ?? "home"
        let url = call.getString("url") ?? "/"
        DispatchQueue.main.async {
            guard let multiVC = self.multiWebVC else {
                call.reject("MultiWebViewController not available")
                return
            }
            multiVC.navigateToTab(tab, url: url)
            call.resolve()
        }
    }
}
