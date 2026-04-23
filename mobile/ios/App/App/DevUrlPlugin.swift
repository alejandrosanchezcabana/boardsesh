import Capacitor
import Foundation

/// Lets debug builds swap the Capacitor server URL at runtime.
///
/// The web UI (packages/web/app/lib/dev-url.ts) calls `getState` to decide
/// whether to render the Dev URL menu. In release builds `isDebug` is always
/// false and `setUrl` / `clearUrl` no-op.
@objc(DevUrlPlugin)
public class DevUrlPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DevUrlPlugin"
    public let jsName = "DevUrl"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearUrl", returnType: CAPPluginReturnPromise),
    ]

    static let defaultsKey = "dev_server_url"
    static let defaultUrl = "https://www.boardsesh.com"

    static var isDebugBuild: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    static func currentOverride() -> String? {
        let stored = UserDefaults.standard.string(forKey: defaultsKey)
        guard let stored, !stored.isEmpty else { return nil }
        return stored
    }

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve([
            "isDebug": DevUrlPlugin.isDebugBuild,
            "currentUrl": DevUrlPlugin.currentOverride() as Any? ?? NSNull(),
            "defaultUrl": DevUrlPlugin.defaultUrl,
        ])
    }

    @objc func setUrl(_ call: CAPPluginCall) {
        guard DevUrlPlugin.isDebugBuild else {
            call.resolve()
            return
        }
        let url = (call.getString("url") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if url.isEmpty {
            UserDefaults.standard.removeObject(forKey: DevUrlPlugin.defaultsKey)
        } else {
            UserDefaults.standard.set(url, forKey: DevUrlPlugin.defaultsKey)
        }
        call.resolve()
        scheduleRestart()
    }

    @objc func clearUrl(_ call: CAPPluginCall) {
        guard DevUrlPlugin.isDebugBuild else {
            call.resolve()
            return
        }
        UserDefaults.standard.removeObject(forKey: DevUrlPlugin.defaultsKey)
        call.resolve()
        scheduleRestart()
    }

    private func scheduleRestart() {
        // Wrap the exit(0) symbol itself in #if DEBUG so it's never emitted into the
        // release binary — App Store static analysis flags `exit` symbols even when
        // they are unreachable at runtime.
        #if DEBUG
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            exit(0)
        }
        #endif
    }
}
