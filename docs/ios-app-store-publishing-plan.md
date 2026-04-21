# iOS App Store Publishing Plan

Minimum steps to get Boardsesh (`com.boardsesh.app`) from zero to published on the App Store.

**Current state:** Capacitor 6 iOS app exists in `mobile/ios/`, BLE permissions configured, no Apple Developer account.

---

## Step 1: Apple Developer Account

1. Go to [developer.apple.com/programs](https://developer.apple.com/programs/) and click Enroll
2. Sign in with an Apple ID (or create one)
3. Choose enrollment type:
   - **Individual** ($99/year) — fastest, enroll as yourself. You can transfer to an org later.
   - **Organization** ($99/year) — requires a D-U-N-S number, takes longer (up to 2 weeks for verification)
   - **Recommendation:** Start as Individual to unblock everything. You can convert later.
4. Pay the $99 annual fee
5. Wait for enrollment approval — typically 24-48 hours for individuals

## Step 2: Certificates & Signing

Once your developer account is active:

1. Open Xcode > Settings > Accounts > Add your Apple ID
2. In `mobile/ios/App/App.xcodeproj`, select the **App** target:
   - Set **Team** to your new developer account
   - Set **Bundle Identifier** to `com.boardsesh.app`
   - Enable **Automatically manage signing**
3. Xcode will automatically create:
   - An App ID for `com.boardsesh.app`
   - A development certificate
   - A distribution certificate
   - Provisioning profiles (dev + distribution)
4. Under **Signing & Capabilities**, add the **Background Modes** capability if BLE needs to operate in background (optional for v1)

No need to manually create certificates or profiles — Xcode's automatic signing handles it all.

## Step 3: App Icons & Launch Screen

**App Icon:**

- You need a single 1024x1024 PNG (no transparency, no alpha channel)
- Place it in `mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Xcode 15+ generates all sizes from the single 1024x1024 image automatically

**Launch Screen:**

- Already configured via `mobile/ios/App/App/Assets.xcassets/Splash.imageset/`
- Verify it looks good on different device sizes in Xcode previews

## Step 4: App Store Connect Setup

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **My Apps** > **+** > **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** Boardsesh
   - **Primary Language:** English
   - **Bundle ID:** Select `com.boardsesh.app` (created by Xcode in Step 2)
   - **SKU:** `boardsesh-ios` (internal reference, anything unique)
4. Fill in the **App Information** tab:
   - **Category:** Sports (primary), Health & Fitness (secondary)
   - **Content Rights:** Does not contain third-party content that requires rights
   - **Age Rating:** Fill out the questionnaire (all "None" — no objectionable content)

### Required Metadata

**Description** (4000 char max):

> Boardsesh connects to your climbing training board via Bluetooth and illuminates routes directly on the wall. Works with Kilter Board, Tension Board, and other Aurora Climbing boards.
>
> - Browse and search thousands of climbs
> - Send routes to your board with one tap
> - Queue up climbs for your session
> - Real-time collaborative sessions with friends
>
> Requires a compatible Aurora Climbing board with Bluetooth LED support.

**Keywords** (100 char max):
`climbing,kilter,tension,bouldering,training,board,bluetooth,routes,LED`

**Support URL:** `https://boardsesh.com`

**Privacy Policy URL:** See Step 5

### Screenshots

Required sizes (minimum 1 per size class):

- **6.7" iPhone** (1290 x 2796) — iPhone 15 Pro Max / 16 Pro Max
- **6.5" iPhone** (1242 x 2688) — iPhone 11 Pro Max (if supporting older)
- **5.5" iPhone** (1242 x 2208) — only if you want to support iPhone 8 Plus class

Take screenshots of:

1. The board view showing an illuminated climb
2. The climb search/list view
3. The BLE connection screen
4. A queue session view

Use Xcode Simulator or a physical device to capture these.

## Step 5: Privacy Policy & Legal

**Required before submission:**

1. Create a privacy policy page hosted at a public URL (e.g., `https://boardsesh.com/privacy`)
2. The policy must cover:
   - What data you collect (account info, usage data)
   - BLE usage (connects to climbing boards, no data transmitted off-device)
   - Third-party services (Aurora API, analytics if any)
   - Data retention and deletion
3. Add the URL to App Store Connect under **App Information > Privacy Policy URL**

### App Privacy (Nutrition Labels)

In App Store Connect under **App Privacy**, declare data collection:

| Data Type      | Collected?          | Linked to User? | Used for Tracking? |
| -------------- | ------------------- | --------------- | ------------------ |
| Email Address  | Yes (account)       | Yes             | No                 |
| Name / User ID | Yes (account)       | Yes             | No                 |
| Usage Data     | Yes (climbs logged) | Yes             | No                 |
| Diagnostics    | No                  | —               | —                  |

## Step 6: Review Info.plist

Verify these keys in `mobile/ios/App/App/Info.plist`:

- `NSBluetoothAlwaysUsageDescription` — Already set: "Boardsesh uses Bluetooth to connect to your climbing training board and illuminate routes." This is good.
- Ensure no unnecessary permissions are declared (camera, location, etc.)

## Step 7: Build & Upload

1. In Xcode, select the **App** scheme and **Any iOS Device (arm64)** as destination
2. **Product > Archive**
3. When archiving completes, the Organizer window opens
4. Click **Distribute App** > **App Store Connect** > **Upload**
5. Keep defaults (include symbols, manage signing automatically)
6. Click **Upload**

The build will appear in App Store Connect within ~15 minutes after processing.

## Step 8: TestFlight

1. In App Store Connect, go to your app > **TestFlight** tab
2. The uploaded build appears under **iOS Builds**
3. **Internal Testing** (up to 100 testers from your dev team):
   - Add testers by email under **Internal Group**
   - They get an invite immediately — no review needed
4. **External Testing** (up to 10,000 testers):
   - Create a group, add testers by email or share a public link
   - First build requires Beta App Review (~1-2 days)
   - Include test notes: "Requires a Kilter or Tension climbing board with Bluetooth for full functionality. Without a board, you can browse climbs and test the search/queue features."
5. Test on real devices — especially BLE connection with actual boards
6. Fix any issues, upload new builds (bump build number each time)

## Step 9: App Review Preparation

This is the highest-risk step. Apple may flag the app as a web wrapper (Guideline 4.2). Prepare carefully:

### Review Notes (visible only to reviewers)

Include this in the **App Review Information > Notes** field:

> Boardsesh requires a Bluetooth-enabled climbing training board (Kilter Board, Tension Board) for its primary functionality. The app uses native CoreBluetooth (via Capacitor BLE plugin) to:
>
> 1. Scan for and discover nearby climbing boards
> 2. Connect via BLE to the board's Nordic UART Service
> 3. Send LED illumination commands to light up specific holds on the wall
>
> This BLE functionality is not available in Safari on iOS, which is the primary reason for the native app.
>
> To test without a physical board: Open the app, browse climbs via the search screen, and tap any climb to view its hold layout. The Bluetooth connection screen (accessible from any climb detail) demonstrates the native BLE scanning UI.
>
> Video demo of BLE board connection: [include a short screen recording URL showing the app connecting to a real board and illuminating holds]

### Demo Video

Record a 30-60 second video showing:

1. Opening the app
2. Searching for a climb
3. Tapping "Connect" to start BLE scanning
4. Connecting to a real board
5. The board lighting up with the selected route

Upload to YouTube (unlisted) or similar, and paste the URL in review notes.

### Guideline 4.2 Mitigation

The app loads from `boardsesh.com` (hosted mode), which means Apple may see it as a web wrapper. Counter this by emphasizing:

- **Native BLE** is the core feature — impossible in Safari
- The app is **not functional without the native shell** for its primary use case (board control)
- Future: if you add the embedded SQLite climb database (from `docs/mobile-app-plan.md`), this further strengthens the case

## Step 10: Submit for Review

1. In App Store Connect, go to your app > **App Store** tab
2. Select the build you tested via TestFlight
3. Fill in **What's New** (for first version, this is your initial description)
4. Set **Release Options:**
   - **Manually release** — recommended for first submission so you control the launch timing
5. Click **Submit for Review**
6. Review typically takes 24-48 hours (can be up to a week)
7. If rejected:
   - Read the rejection reason carefully
   - Respond in Resolution Center with clarifications
   - Fix issues and resubmit
   - Common first-time rejections: metadata issues, missing privacy policy, guideline 4.2

## Step 11: Release

1. Once approved, the status changes to **Pending Developer Release** (if you chose manual)
2. Click **Release This Version**
3. The app goes live on the App Store within 24 hours (usually faster)

---

## Timeline Estimate

| Step                            | Duration            | Blocker?                             |
| ------------------------------- | ------------------- | ------------------------------------ |
| Developer Account enrollment    | 1-2 days            | Yes — blocks everything              |
| Certificates & signing          | 30 minutes          | No                                   |
| App icons & screenshots         | 1-2 hours           | No                                   |
| App Store Connect setup         | 1 hour              | No                                   |
| Privacy policy                  | 1-2 hours           | Blocks submission                    |
| Build & upload                  | 30 minutes          | No                                   |
| TestFlight testing              | 3-7 days            | Good practice, not strictly required |
| App Review submission           | 1-3 days for review | Yes                                  |
| **Total (fast path)**           | **~1 week**         |                                      |
| **Total (with proper testing)** | **~2 weeks**        |                                      |

---

## Checklist

- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Set up signing in Xcode (automatic)
- [ ] Create 1024x1024 app icon
- [ ] Verify launch screen looks good
- [ ] Create app record in App Store Connect
- [ ] Write app description and keywords
- [ ] Take required screenshots (6.7" iPhone minimum)
- [ ] Create and host privacy policy at boardsesh.com/privacy
- [ ] Fill out App Privacy nutrition labels
- [ ] Verify Info.plist permissions
- [ ] Archive and upload build via Xcode
- [ ] Test via TestFlight on real devices
- [ ] Record BLE demo video for reviewers
- [ ] Write App Review notes explaining native BLE functionality
- [ ] Submit for App Store Review
- [ ] Respond to any review feedback
- [ ] Release the app
