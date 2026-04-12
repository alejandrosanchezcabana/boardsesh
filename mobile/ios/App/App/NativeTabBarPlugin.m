#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeTabBarPlugin, "NativeTabBar",
    CAP_PLUGIN_METHOD(setActiveTab, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setBarsHidden, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setNotificationBadge, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(navigateTab, CAPPluginReturnPromise);
)
