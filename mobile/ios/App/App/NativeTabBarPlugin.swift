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
    ]

    // MARK: - setActiveTab

    @objc func setActiveTab(_ call: CAPPluginCall) {
        let tab = call.getString("tab") ?? "home"
        DispatchQueue.main.async {
            (self.bridge?.viewController as? BoardseshViewController)?.tabBarView?.setActiveTab(tab)
            call.resolve()
        }
    }

    // MARK: - setBarsHidden

    @objc func setBarsHidden(_ call: CAPPluginCall) {
        let hidden = call.getBool("hidden") ?? false
        DispatchQueue.main.async {
            (self.bridge?.viewController as? BoardseshViewController)?.tabBarView?.setBarsHidden(hidden)
            call.resolve()
        }
    }

    // MARK: - setNotificationBadge

    @objc func setNotificationBadge(_ call: CAPPluginCall) {
        let count = call.getInt("count") ?? 0
        DispatchQueue.main.async {
            (self.bridge?.viewController as? BoardseshViewController)?.tabBarView?.setNotificationBadge(count)
            call.resolve()
        }
    }
}
