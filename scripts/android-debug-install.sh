#!/usr/bin/env bash
#
# Build and install the Android debug APK alongside the production app, then
# claim https://(www.)boardsesh.com App Links for the debug package so deep
# links (e.g. /join/<id>) route to the build under test instead of falling
# through to the Play Store production app.
#
# The .debug package is signed with the committed keystore at
# mobile/android/app/debug.keystore, whose SHA-256 is registered in
# assetlinks.json. The autoVerify check would normally pick a default after
# install, but when both com.boardsesh.app and com.boardsesh.app.debug are
# verified for the same domain, Android lets the user choose. Without an
# explicit pm-set-app-links-user-selection call, contributors hit a chooser
# (or worse, silently get production). We pin the debug package here so the
# routing is deterministic.
#
# Usage:
#   ./scripts/android-debug-install.sh           # uses default adb device
#   ANDROID_SERIAL=XXXX ./scripts/android-debug-install.sh

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
ANDROID_DIR="$REPO_ROOT/mobile/android"
DEBUG_PACKAGE="com.boardsesh.app.debug"
HOSTS=("boardsesh.com" "www.boardsesh.com")

if ! command -v adb >/dev/null 2>&1; then
    echo "error: adb not found on PATH (install platform-tools or add to PATH)" >&2
    exit 1
fi

# A single device must be selected so the post-install pm command targets
# the same install. Honour ANDROID_SERIAL if set; otherwise require exactly
# one device.
if [[ -z "${ANDROID_SERIAL:-}" ]]; then
    devices=$(adb devices | awk 'NR>1 && $2=="device" {print $1}')
    count=$(printf '%s\n' "$devices" | grep -c . || true)
    if [[ "$count" -eq 0 ]]; then
        echo "error: no adb devices attached" >&2
        exit 1
    fi
    if [[ "$count" -gt 1 ]]; then
        echo "error: multiple adb devices attached, set ANDROID_SERIAL=<serial>" >&2
        adb devices >&2
        exit 1
    fi
fi

echo "==> Syncing Capacitor Android project"
(cd "$REPO_ROOT/mobile" && bunx cap sync android)

echo "==> Building and installing debug APK ($DEBUG_PACKAGE)"
(cd "$ANDROID_DIR" && ./gradlew installDebug)

# Re-trigger App Links verification. Without this, the device may keep a
# cached "unverified" decision from a previous unsigned debug install and
# refuse to honour the user-selection below.
echo "==> Re-verifying App Links for $DEBUG_PACKAGE"
adb shell pm verify-app-links --re-verify "$DEBUG_PACKAGE" >/dev/null || true

# Claim the boardsesh.com hosts for the debug package on user 0. With both
# packages verified via assetlinks.json, this is what makes the debug build
# the deterministic deep-link target on this device.
echo "==> Pinning App Links to $DEBUG_PACKAGE"
for host in "${HOSTS[@]}"; do
    adb shell pm set-app-links-user-selection \
        --user 0 --package "$DEBUG_PACKAGE" true "$host"
done

echo
echo "Done. Test with:"
echo "  adb shell am start -a android.intent.action.VIEW -d 'https://www.boardsesh.com/join/test'"
echo
echo "If a deep link still opens the production app, run:"
echo "  adb shell pm get-app-links $DEBUG_PACKAGE"
echo "and confirm the boardsesh.com hosts show 'always : ${DEBUG_PACKAGE}'."
