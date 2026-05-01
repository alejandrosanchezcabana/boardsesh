# Boardsesh Mobile App Distribution Plan (Capacitor) — v8.0

## What this document is

A working plan for the Capacitor mobile app and the parallel work to make it usable offline. Scope: native shell maintenance, the offline-first pivot (bundled Next.js static export + local SQLite cache + write queue), the Vercel/Neon → Railway hosting move, and the ongoing REST → GraphQL completion in `packages/backend`.

This version replaces v7.0. v7.0 over-specified delivery dates against partly-fictional state and contradicted itself on auth in bundled mode. The corrections are listed in the changelog at the bottom.

## Pinned user story

A user opens Boardsesh in airplane mode at the gym. They launch the app, browse and search climbs for their board, build a queue, connect via BLE, send climbs to the board (LEDs light up), and tick the ones they sent. Real-time-only features (party mode, comments, others' profiles) show a "needs network" state. When the user reconnects, queued ticks and edits sync to the server. Phase 5 is the milestone where this end-to-end story works.

## Current state (verified against `main`)

What is shipped and what is not, as of this rewrite. Anything below is checkable in the repo.

| Area | Status |
|------|--------|
| Capacitor shell at `mobile/` (sibling of `packages/`, not under it) | Shipped. iOS + Android projects, `capacitor.config.ts`, `BoardseshWidgets` LiveActivity extension. |
| Capacitor major version | 8 (`@capacitor/core: ^8`). Plan must not reference Cap 6 APIs. |
| Hosted mode | App loads `https://www.boardsesh.com`. iOS uses `limitsNavigationsToAppBoundDomains: true` with `boardsesh.com`, `*.boardsesh.com`, `*.ts.net` declared in `WKAppBoundDomains`. |
| BLE adapter | `packages/web/app/lib/ble/{capacitor-adapter,web-adapter,adapter-factory,types,resolve-serials,board-config-match}.ts` with tests. |
| Native plugins installed | `@capacitor-community/{bluetooth-le, in-app-review, keep-awake, safe-area}`, `@capacitor/{app, browser, core, geolocation, motion}`, plus iOS / Android platforms. |
| Native plugins **not** installed | `@capacitor-community/sqlite`, `@capacitor/push-notifications`, `@capacitor/network`, `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/status-bar`, `@capacitor/splash-screen`. Adding these is in-scope for later phases. |
| Backend GraphQL coverage | 14 resolver domains under `packages/backend/src/graphql/resolvers/` (board, ticks, users, social, feedback, beta-videos, queue, sessions, playlists, favorites, controller, climbs, plus shared helpers). Substantial, not "early." |
| REST routes still live in `packages/web/app/api/` | 44 `route.ts` files across `/api/internal/*`, `/api/v1/*`, `/api/auth/*`, `/api/og/*`. Sync, search, sync-cron, ws-auth, OG image generation, NextAuth handlers. |
| Server pages with direct `next/headers` / `auth()` calls | 7. |
| Server pages importing DB directly | 4. |
| Hosting | Vercel (web) + Neon (DB) + backend on its current host. |
| Web `next.config.mjs` | `output: 'standalone'`. No dual-build wiring exists yet. |
| LiveActivity bridge | iOS extension target exists; queue updates flow through it in hosted mode. |

What this means for sequencing:

- The native shell is real, so M0–M2 from prior versions are largely done. The remaining native work is hosting bundled assets, optional native plugin additions, and store submission.
- The GraphQL surface is broad enough that a dedicated REST → GraphQL completion phase is a finite cleanup, not a green-field migration.
- The export-build conversion is finite because most in-app pages already client-fetch; the genuine cost is in the few server pages and in `cookies()` callsites.

## Architecture target

```
   ┌──────────────── boardsesh.com (Railway) ───────────────┐
   │                                                          │
   │  packages/web (Next.js standalone build)                 │
   │   • SEO routes server-rendered (homepage, profile,       │
   │     setter, climb view, public playlist, /b/...)         │
   │   • Auth endpoints (NextAuth)                            │
   │   • OG image routes (until they move to backend)         │
   │                                                          │
   │  packages/backend (Hono + graphql-ws + Yoga)             │
   │   • GraphQL queries + mutations + subscriptions          │
   │   • Hono handlers for auth callbacks, OG, webhooks       │
   │                                                          │
   │  Postgres + PostGIS (Railway)                            │
   │  Redis (Railway, for pub/sub + sessions)                 │
   └──────────────────────────────────────────────────────────┘
                             ▲
                             │ HTTPS GraphQL + WebSocket
                             │ (cross-origin from app)
                             │
   ┌──────────────── mobile/ (Capacitor 8) ──────────────────┐
   │                                                          │
   │  iOS (WKWebView) / Android (System WebView)              │
   │   • Loads bundled Next.js static export from             │
   │     capacitor://localhost (Phase 2 onward)               │
   │   • Bearer-token auth (no cross-origin cookie reliance)  │
   │                                                          │
   │  Local data:                                             │
   │   • Refdata SQLite per board (ODR / Asset Pack)          │
   │   • cached_ticks / cached_playlists / cached_profile     │
   │   • pending_mutations (write queue)                      │
   │                                                          │
   │  Native code:                                            │
   │   • BLE central                                          │
   │   • LiveActivity (iOS)                                   │
   │   • Connectivity monitor                                 │
   │   • Native tab bar (open question — see "Tab bar" below) │
   └──────────────────────────────────────────────────────────┘
```

## Why Capacitor (kept brief)

We've already chosen this. We're on Cap 8 with a working BLE adapter, LiveActivity extension, and a hosted shell that ships to both stores. The relevant question now is not "Capacitor vs React Native" but "hosted vs bundled," covered next.

## Hosted vs bundled mode

Today the WebView loads `https://www.boardsesh.com`. After the offline-first work, it loads bundled HTML from `capacitor://localhost`. Both modes share the same `packages/web` source tree. The differences are:

| | Hosted (today) | Bundled (Phase 2+) |
|---|---|---|
| Initial load | Network round-trip on every cold start | Local files, no network |
| Update cadence | Every Vercel/Railway deploy ships to all users | Only WebView JS via OTA (see "Rollback") OR app store update |
| Auth | NextAuth cookie inside same-origin WebView | Bearer token (see "Auth" below) |
| Service worker | Possible but not enabled | Not needed |
| App-bound domains | iOS gates WebView APIs to boardsesh.com | Custom-scheme load is unaffected; app-bound list still applies to outbound `<iframe>` and `WKWebsiteDataStore` scoping |
| App Store "wrapper" risk | Higher | Lower (app has clear native value with bundled assets + offline) |

## The dual-build mechanism (concrete)

`output: 'export'` is project-wide. You cannot mark some pages as "exportable" and others as "SSR-only" via a flag. The plan must own one of these mechanisms:

**Chosen: parallel `app/` trees driven by `pageExtensions`.**

- The standalone build runs `next build` with default `pageExtensions: ['tsx', 'ts', 'jsx', 'js']`.
- The export build runs `next build` with `output: 'export'` and `pageExtensions: ['bundled.tsx', 'bundled.ts', 'tsx', 'ts', 'jsx', 'js']`.
- For routes that work identically in both builds (most in-app pages already fetch client-side), there is one file: `app/foo/page.tsx`.
- For routes that differ, both files exist: `app/foo/page.tsx` (used by standalone) and `app/foo/page.bundled.tsx` (used by export). The bundled version is a client component that reads route params and queries via the query router.
- SEO routes that have no business inside the bundle (homepage, public profile, public playlist, climb view, setter) get a `page.bundled.tsx` that **redirects to the in-app equivalent** or 404s. They are not user-reachable in the bundled app.

Why this beats the alternatives:

- A runtime branch on `process.env.BUILD_TARGET` inside server components doesn't compile under `output: 'export'` — `cookies()` and friends are static-build-incompatible.
- A whole-tree codemod that strips server-only imports has too much surface area to maintain.
- Two separate Next.js apps doubles the dev / CI / type-check cost and forks the routing.

The cost: every server page either needs a `.bundled.tsx` sibling (small effort for SEO pages — they redirect or 404 in-bundle) or a real client conversion (the 7 pages with `next/headers` calls and the 4 with direct DB imports). Estimate: 10–15 page conversions, plus ~20 small `.bundled.tsx` redirect stubs.

A single `next.config.mjs` reads `BUILD_TARGET=export` and switches `output`, `pageExtensions`, and disables image optimization (`images.unoptimized: true`) for the export profile. CI runs both builds; the bundled artifact is consumed by `mobile/` via a script that copies `packages/web/out/` into `mobile/dist/`.

## Auth in bundled mode (decided)

**Bearer token. NextAuth cookies are not used inside the bundled app.**

The plan needs to commit to one model rather than mix cookies and tokens. Cross-origin cookies from `capacitor://localhost` to `https://www.boardsesh.com` rely on `SameSite=None; Secure` plus WebKit ITP behavior that is moving in the wrong direction across iOS releases. Bearer tokens dodge the entire category.

Concretely:

1. **Login flow (unchanged at the user level).** WebView opens the existing `/auth/native-start` flow in the Capacitor Browser plugin (SFSafariViewController on iOS, Custom Tabs on Android). That flow runs OAuth in the system browser's cookie context, then redirects to `com.boardsesh.app://auth/callback?token=<short-lived-hmac-token>`.
2. **Token exchange.** Native code intercepts the deep link, closes the browser tab, and POSTs the short-lived token to `/api/auth/native/callback` (existing endpoint, kept in `packages/web` standalone build). The server validates the HMAC and returns a long-lived session JWT (rotated weekly) plus a refresh token.
3. **Storage.** The session JWT and refresh token are stored via `@capacitor/preferences` (which uses Keychain on iOS, encrypted SharedPreferences on Android). Not localStorage. Not IndexedDB.
4. **Use.** A fetch interceptor in `packages/web/app/lib/auth/native-token.ts` attaches `Authorization: Bearer <jwt>` to every GraphQL request. WebSocket connection attaches the token via connection params, replacing the current `/api/internal/ws-auth` cookie-based handshake.
5. **Refresh.** When the JWT is within 24h of expiry, the interceptor uses the refresh token to mint a new pair. Refresh failures (revoked, expired refresh) trigger a re-auth via the Browser plugin.
6. **`useSession` replacement.** A small `NativeSessionProvider` reads from `@capacitor/preferences` on mount and exposes a hook with the same shape as NextAuth's `useSession`. Components don't change. Standalone web continues using NextAuth's `SessionProvider`.

What this means for the backend:

- A bearer-token middleware in `packages/backend/src/middleware/auth.ts` validates the JWT and resolves the session. The current cookie path stays for the standalone web's GraphQL requests. Both paths populate the same `GraphQLContext.session`.
- `/api/internal/ws-auth` (cookie → token exchange) remains for the standalone web. The bundled app skips it.
- The native callback endpoint (`/api/auth/native/callback`) issues bearer tokens in addition to setting the existing transfer-token-based cookie path.

What this does **not** require:

- Migrating NextAuth to `packages/backend`. Out of scope for this plan.
- A separate auth host. Standalone web keeps NextAuth as-is.

## Query router and shape contract

The router decides per query whether to read from local SQLite, from remote GraphQL, or both. The shape problem (local data lacks user-specific fields) is handled by a discriminated return type, not by silently returning a different shape.

```ts
// packages/web/app/lib/data/query-router.ts

export type QuerySource = 'local' | 'remote' | 'remote-fresh';

export interface QueryResult<T> {
  data: T;
  source: QuerySource;
  // Fields that are present on the remote shape but stripped here.
  // Components that need them must gate on source === 'remote' or 'remote-fresh'.
  stripped?: ReadonlyArray<keyof T>;
  fetchedAt: number;
}

export interface RouteSpec<TArgs, T> {
  local?: (args: TArgs) => Promise<{ data: T; stripped: ReadonlyArray<keyof T> }>;
  remote: (args: TArgs) => Promise<T>;
  prefer: 'local-first' | 'cache-first' | 'remote-only';
  // For cache-first: how stale before we block on the remote call.
  staleAfterMs?: number;
}

export async function boardseshQuery<TArgs, T>(
  route: RouteSpec<TArgs, T>,
  args: TArgs,
): Promise<QueryResult<T>>;
```

Concrete contracts per route group:

| Route group | `prefer` | Local source | Stripped fields | Notes |
|---|---|---|---|---|
| `climbs.search` | `local-first` (in bundled), `remote` (web) | refdata SQLite | `userAttemptCount`, `userTopAttempts`, `userQualityRating` | Components show user fields only when `source === 'remote-fresh'` |
| `climbs.byUuid` | `local-first` | refdata SQLite | same as search | |
| `holds.forLayout` | `local-first` | refdata SQLite | none | Pure refdata |
| `ticks.forUser` | `cache-first`, 60s | `cached_ticks` | none — cache holds the full shape, including user fields, because it's user-specific data | Background refresh on focus / online |
| `playlists.forUser` | `cache-first`, 60s | `cached_playlists` | none | |
| `profile.me` | `cache-first`, 5min | `cached_profile` | none | |
| `partySession.state` | `remote-only` | n/a | n/a | Subscription, not query |
| `feed.activity` | `remote-only` | n/a | n/a | Online-only |
| `comments.forClimb` | `remote-only` | n/a | n/a | Online-only |

Components that use a route consume `QueryResult<T>` and pattern-match on `source` for online-only fields. The TypeScript type prevents reading `userAttemptCount` from a result whose source is `'local'` — `stripped` narrows it to `undefined`.

Cache priming: the bundled app, on first online launch after auth, runs a background `primeCache()` job that pulls the user's full ticks list, playlists, and profile. It surfaces a one-line progress indicator ("Syncing your climbs"). On subsequent launches, only deltas refresh.

## Mutation queue

Local writes go through a single function that always returns optimistically and queues for sync.

```ts
// packages/web/app/lib/data/mutation-queue.ts

export interface QueuedMutation<TArgs> {
  id: string;                  // UUID v7, generated client-side, used as idempotency key
  name: string;                // 'tick.create' | 'playlist.addClimb' | ...
  args: TArgs;
  attempts: number;
  lastAttemptAt: number | null;
  lastError: { kind: 'transient' | 'terminal'; message: string } | null;
  createdAt: number;
}

export async function boardseshMutate<TArgs, T>(
  spec: MutationSpec<TArgs, T>,
  args: TArgs,
): Promise<{ optimisticResult: T; queued: boolean }>;
```

Contracts:

- **Idempotency keys are mandatory.** Every mutation generates a `clientMutationId` (UUID v7) on enqueue. The server's GraphQL middleware looks up that key in a `mutation_dedup` table; if seen, it returns the prior result without re-executing. This is the only safe way to handle "did the network request succeed before the connection dropped."
- **Optimistic UI commits to local SQLite immediately.** The mutation is also written to `pending_mutations`. The TanStack Query cache is invalidated locally so the UI refreshes from the new local state.
- **Sync.** On reconnect (or app foreground if `pending_mutations` is non-empty), a single drainer pulls mutations in `createdAt` order and submits them to the backend with their `clientMutationId`. Concurrency = 1 to preserve user-perceived order.
- **Error classification.** Network errors are `transient`: retry with exponential backoff (2s, 8s, 32s, 2m, 10m, 1h max). Server-validation errors (400-class GraphQL errors) are `terminal`: the mutation moves to a "needs attention" list with a tap-to-edit-or-discard UI.
- **Conflict resolution per mutation:**
  - `tick.create` — server-wins on the existence check; if the server says the tick already exists for this `(user, climb_uuid, climbed_at)`, the mutation succeeds idempotently. Always safe to retry.
  - `playlist.addClimb` / `playlist.removeClimb` — server stores per-(playlist, climb) presence as a set; ops are idempotent.
  - `playlist.rename` — last-write-wins with a server-side `updated_at` check. If the server's `updated_at` is newer than the client's `expectedUpdatedAt`, the local edit is kept in `pending_mutations` and the user sees a "playlist was changed elsewhere — keep mine / use theirs" prompt.
  - Queue / party operations — never queued. Real-time only. If the user edits the queue offline, the local edits apply locally only; on reconnect the local queue replaces the server queue if the user has not been overridden by another party member (last-write-wins by client `updated_at`).

The "needs attention" UI is part of Phase 6, not "post-launch polish." It must ship with Phase 5 because Phase 5 is when terminal errors first become visible to users.

## Embedded SQLite (refdata)

This is the existing M1.5 work, rolled into Phase 3.

### Sizing — to be measured, not estimated

Prior versions cited "Kilter ~120-150 MB compressed." That was a guess. Before committing to a delivery model, run:

```bash
bun run packages/db/scripts/measure-mobile-export.ts
```

Output: per-board uncompressed and zstd-compressed sizes, with and without the indexes named below. Phase 3 commits to ODR / Asset Pack only if compressed Kilter fits under 200 MB (the iOS cellular-download prompt threshold). If it doesn't, Phase 3 either:

- Drops `frames` from the bundled snapshot and fetches it on-demand the first time a climb is viewed (cached locally after); or
- Splits per-layout, not per-board, so users only download the layout(s) they actually use.

The decision happens before Phase 3 starts implementation. There's a one-week measurement spike at the top of Phase 3 to lock in the choice.

### Schema and indexes

Local SQLite tables: `board_climbs`, `board_climb_stats`, `board_difficulty_grades`, `board_holes`, `board_layouts`, `board_product_sizes`, `board_products`, `board_sets`, `board_product_sizes_layouts_sets`. Schema lives at `packages/db/scripts/mobile-sqlite-schema.sql`.

Indexes in `mobile-sqlite-indexes.sql`:

- `idx_climbs_search` on `(board_type, layout_id, is_listed, is_draft, frames_count)`
- `idx_climbs_edges` on `(board_type, layout_id, edge_left, edge_right, edge_bottom, edge_top)`
- `idx_stats_lookup` on `(climb_uuid, angle)` — `board_type` lives on `board_climbs`, not `board_climb_stats`, so the index doesn't include it
- `idx_stats_difficulty` on `(angle, display_difficulty)`
- `idx_climbs_name_nocase` on `(name COLLATE NOCASE)`
- `idx_climbs_setter` on `(setter_username)`

Search query goes through `searchClimbsLocal()` in `packages/web/app/lib/data/local/climbs.ts`. The function shape exactly matches the GraphQL query's TypeScript output type, with user-specific fields stripped (returned as `undefined` and surfaced via `stripped` per the query router contract).

### Sync — two channels

1. **New climbs.** Endpoint `GET /api/internal/climb-sync?board=<board>&since=<iso>` returns `{ inserted: Climb[], updated: Climb[], deletedUuids: string[] }`. Runs on app launch and every 24h while online.
2. **Stats refresh.** `board_climb_stats` (`ascensionist_count`, `quality_average`, `display_difficulty`) changes on every climb every day as Aurora aggregates new ticks. A separate `GET /api/internal/stats-sync?board=<board>&since=<iso>` returns delta rows. Runs weekly, or whenever the user pulls-to-refresh on a stats-heavy view. The UI shows "stats updated 3 days ago" when stale.

Both endpoints stream JSON to keep memory low on the client.

### Build pipeline

`packages/db/scripts/export-mobile-sqlite.ts` runs from a GitHub Action weekly, uploads per-board `.zst` snapshots to Cloudflare R2 (CDN), and triggers a `mobile-bundle-refresh` workflow that updates the ODR / Asset Pack manifests. Mobile shell version is **not** bumped on snapshot updates — the app downloads the new snapshot on next launch.

## Hosting migration to Railway

Cutover phase. Independent of Capacitor work but the export build benefits from a stable backend host before it ships.

### Move list

| Component | From | To | Risk |
|---|---|---|---|
| Postgres | Neon (serverless) | Railway Postgres + PostGIS | Connection pool sizing; PostGIS version (need 3.4+ for `ST_HexagonGrid` used by heatmap) |
| DB driver | `drizzle-orm/neon-serverless` (HTTP) | `drizzle-orm/postgres-js` (TCP) | Already what local dev uses; production cold-start TLS adds ~50ms per fresh connection |
| `packages/backend` | Existing host | Railway, co-located with DB | Subscription reconnect storm during cutover |
| `packages/web` standalone Next.js | Vercel | Railway (long-lived Node container, not serverless) | Loses Vercel image-optimization endpoint; loses Vercel Cron |
| OG images (`/api/og/*`) | Vercel Edge (`satori`) | Backend Hono with `satori` + `@resvg/resvg-js`, same URL shape preserved | Existing Discord / Twitter cards must keep resolving |
| Image optimization | Vercel image endpoint | Cloudflare Images in front of R2 origin, custom `next/image` loader | One-time loader rewrite in `next.config.mjs` |
| Cron jobs (`/api/internal/{user-sync-cron,cleanup,inferred-sessions-backfill,prewarm-heatmap}`) | Vercel Cron | Railway cron service hitting the same internal HTTP endpoints with a shared-secret `CRON_TOKEN` header | Endpoints already exist; auth wrapper must be added before Vercel is shut down |
| Aurora sync | `packages/aurora-sync` runner (currently triggered from Vercel) | Railway scheduled service in the same stack | Re-point `DATABASE_URL` only |

### Cutover sequence

1. Stand up Railway Postgres + PostGIS. Confirm PostGIS version, run heatmap test query against a restored snapshot.
2. Stand up Railway backend pointing at Railway DB. Run e2e suite against backend at staging hostname.
3. Stand up Railway standalone Next.js pointing at Railway DB. Run e2e suite at staging.
4. Add `CRON_TOKEN` to all `/api/internal/*-cron` endpoints. Verify auth path.
5. Move Aurora sync runner. Verify next scheduled run completes.
6. DNS flip for `boardsesh.com`. Keep Vercel project warm for 48h as instant rollback.
7. Decommission Vercel + Neon after a 7-day burn-in.

Estimate: 4 weeks. The original 2-3w estimate did not include the Vercel-specific carry items (cron + image opt + OG).

## REST → GraphQL completion

Out of 44 `route.ts` files in `packages/web/app/api/`, the destinations:

| Group | Count | Destination |
|---|---|---|
| `/api/internal/*` data ops (search, sync, profile, favorites, hold-classifications, climb-redirect, etc.) | 18 | GraphQL in `packages/backend`. Existing resolvers cover ~10 already; remaining 8 are net-new resolvers. |
| `/api/v1/[board_name]/*` (grades, slugs, climb-stats, heatmap) | 14 | GraphQL with same shape. URL shape kept via thin proxy shims in standalone build during overlap, removed after. |
| `/api/v1/[board_name]/proxy/*` (Aurora: login, saveAscent, saveClimb, getLogbook, user-sync) | 5 | GraphQL mutations wrapping Aurora calls server-side. |
| `/api/auth/*` (NextAuth + native callback + register + verify-email + providers-config) | 6 | Stay in `packages/web` standalone build. Bundled app uses bearer tokens and the existing native callback. |
| `/api/og/*` (climb, profile, playlist, setter, session) | 5 | Backend Hono with `satori`, same URL shape preserved at `boardsesh.com` (the standalone build proxies `/api/og/*` to backend; backend renders). |
| `/api/internal/*-cron` and `ws-auth` | 4 | Stay in `packages/web` standalone build, wrapped with `CRON_TOKEN`. `ws-auth` stays for the cookie path. |

Sequence: migrate by category, smallest first, with parallel resolver + thin shim until the shim can be deleted. Estimate: 6 weeks for the new resolvers + Hono OG carve-out + shim removal.

## Bluetooth Strategy (status quo + chunking fix)

The adapter abstraction already exists at `packages/web/app/lib/ble/`. The remaining items:

1. Verify `splitMessages()` in the protocol layer is no longer called by callers — the adapter's `write()` owns chunking. Tests in `__tests__/capacitor-adapter.test.ts` should assert this for the Capacitor adapter; add an equivalent for `web-adapter.test.ts` if missing.
2. MTU negotiation on Cap 8: confirm `BleClient.requestMtu` API shape matches what the adapter assumes. Cap 8 changed Android MTU semantics; verify on a physical Pixel before Phase 2.
3. The Bluefy banner suppression in native is already gated on `isNativeApp()` per existing code. Spot-check on next iOS build.

No new BLE work is on the critical path.

## Native polish (incremental)

Add as needed, not all at once:

- `@capacitor/haptics` — lightweight, add when first haptic-tagged interaction is requested.
- `@capacitor/keyboard` — already partially handled by `@capacitor-community/safe-area`; add only if specific keyboard issues surface.
- `@capacitor/status-bar` and `@capacitor/splash-screen` — defer until store reviewers flag them or until UI consistency requires them.
- `@capacitor/network` — needed for the connectivity banner in Phase 6. Add as part of that phase.

Deep links: existing `boardsesh://` and Universal Link / App Link config already covers `/party/*` and `/invite/*`. Do not register the entire `boardsesh.com` domain — that hijacks the browser experience.

## Analytics and observability

- **PostHog**, single project, separate environments. `posthog-js` in the web (works in both standalone and bundled). Server events from `packages/backend` via `posthog-node`. `distinct_id` lives in IndexedDB in bundled mode (not localStorage), bootstrapped from a device-stable identifier (`@capacitor/device` `identifier` field).
- **Sentry** in JS today. Add Sentry iOS / Android SDKs in the same milestone the bundled app first ships (Phase 2). Source maps uploaded for both standalone and export builds.
- **Build-time stub** for both PostHog and Sentry to avoid firing during `next build`.

Cross-cutting, not phased.

## App Store distribution

### Review notes (committed text, not aspiration)

When submitting:

> Boardsesh controls climbing-board hardware via Bluetooth Low Energy. The app embeds a per-board climb database (~150 MB, downloaded on first board selection) so users can search and browse climbs without internet. Reviewers cannot pair to a physical Kilter or Tension board, so the demo flow below shows the offline-only functionality:
>
> 1. Open the app. Select "Kilter" → wait for board data download.
> 2. Without an account: tap "Browse climbs." Search for "Crimpy" — results render from the local database (no network indicator visible).
> 3. Tap any climb → the climb detail page renders with hold positions and grade.
> 4. Tap the BLE icon → device picker appears (will not find a board in the test environment, but the picker proves native BLE is active).
>
> The app is not a thin web wrapper. The offline climb database, BLE control, and LiveActivity (visible from the lock screen during a session) are native features unavailable to a website.

### Plan B if rejected

iOS Store Guideline 4.2 rejections happen unpredictably even with strong native features. If iOS is rejected:

1. Ship Android first via Play Store internal testing while iOS rework continues.
2. Add a native onboarding flow (3 native screens before the WebView opens) that visually demonstrates non-WebView UI before the reviewer sees the WebView.
3. Make the LiveActivity always-on during a session (currently optional) so it appears in the reviewer's lock screen automatically.
4. Re-submit with an explicit reply to the rejection citing each native feature.

The native-onboarding fallback is built but kept dormant; activate only if rejected.

### Rollback for bundled-mode regressions

The bundled JS is an app store update — slow rollback. To avoid 1-7 day outages:

- **OTA evaluation** at the start of Phase 2: compare Capacitor Live Updates (Ionic), Capgo, and a self-hosted bundle-swap approach. Decision committed before Phase 2 ships. The plan does not assume an OTA solution; if the comparison concludes none is acceptable, Phase 2 also requires a feature flag in the bundled app that lets the app revert to hosted mode (`server.url = 'https://www.boardsesh.com'`) on next launch via a remote config flip.
- **Remote-config kill switch** is the minimum: a fetch on launch to a small `app-config.json` on R2 / CDN that can flip the WebView back to hosted mode without an app store update. This is a hard requirement of Phase 2.

## Phase plan (with explicit dependencies)

```
0a Hosting cutover ─┐
                    ├─→ 1 Dual-build pipeline ─→ 2 Bundle switch ─→ 3 Refdata SQLite ─┐
0b GraphQL cleanup ─┘                                                                   ├─→ 5 Mutation queue ─→ 6 Connectivity polish
                                                                4 User-data cache ─────┘
```

| Phase | Estimate | Hard dependencies | Ships when |
|---|---|---|---|
| 0a Hosting → Railway | 4 weeks | none | Postgres + backend + standalone web on Railway, Vercel + Neon decommissioned |
| 0b GraphQL completion | 6 weeks | none | All non-auth, non-OG REST routes have GraphQL equivalents; shims removable |
| 1 Dual-build pipeline | 6 weeks | 0b largely done (so client conversions don't double-back) | `BUILD_TARGET=export` produces `out/` with a working app shell, both builds green in CI |
| 2 Bundle switch (incl. OTA decision + bearer auth) | 4 weeks | 1 | Capacitor app launches in airplane mode, reaches the home screen, bearer-token auth works on physical iOS + Android, kill-switch verified |
| 3 Refdata SQLite | 4 weeks (incl. 1-week measurement spike) | 2 | Per-board refdata downloads via ODR / Asset Pack, search and climb detail render from local DB offline |
| 4 User-data cache | 5 weeks | 2 | Profile, ticks, playlists render offline after one online session; stale-while-revalidate refreshes on focus |
| 5 Mutation queue | 5 weeks | 4 | Pinned user story end-to-end, with `mutation_dedup` server-side and "needs attention" UI for terminal failures |
| 6 Connectivity polish | 2 weeks | 5 | Persistent online/offline banner, sync count, retry UI, onboarding mentions offline |
| Cross-cutting (PostHog + Sentry + native crashes) | rolling, 1 week of dedicated work in Phase 2 | n/a | Native crashes report before Phase 2 ships |

Critical path for the pinned user story: 0a (or 0b) → 1 → 2 → 3 → 4 → 5. Sum: ~30 weeks ≈ 7 months calendar time with one engineer, less with parallelism on 0a/0b and partial overlap of 3/4.

The 5-6 month estimate in v7.0 was optimistic. **8 months is a realistic best case** with one full-time engineer; **10-12 months** is realistic with shared engineering capacity and store review cycles. Phases 4 and 5 are the largest single risks.

## Risks (only the ones that change behavior)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bearer-token refresh edge cases (clock skew, revoked refresh, network failure mid-refresh) | Medium | High | Refresh logic gets its own test suite. Failed refresh triggers re-auth via Browser plugin, not silent failure. |
| Cross-origin GraphQL request gets stripped of `Authorization` header by some WKWebView/CORS edge case | Low | High | Backend logs requests with missing auth at `warn` level; alert if rate spikes after Phase 2 ships. |
| Refdata SQLite > 200 MB compressed for Kilter | Medium | Medium | Phase 3 measurement spike. Fallback: per-layout split or `frames` lazy-fetch. |
| `mutation_dedup` table grows unbounded | Low | Medium | Server expires entries older than 30 days; client never replays mutations older than 30 days. |
| OTA solution all unacceptable; bundled-mode regressions stuck on app store cycle | Medium | High | Remote-config kill switch flips to hosted mode without app store update. |
| Apple 4.2 rejection | Medium | High | Plan B above. Android-first and native-onboarding fallback. |
| Vercel cron migration misses an endpoint | Medium | Medium | Inventory above is checked against `vercel.json` before cutover. |
| Server pages with `next/headers` calls have hidden auth side effects that break in client-converted form | Medium | Medium | Each of the 7 conversions gets a paired Playwright test that exercises the auth-gated content. |
| Phase 1 page-conversion estimate underestimates real complexity | Medium | Medium | First two conversions are timeboxed to 1 week total to validate the per-page cost; reschedule Phase 1 if the rate doesn't hold. |
| Per-tab WKWebView pattern (PR #1509-style) blocked by bundled mode | Low (we're not committing to it) | Medium | Plan does not ship per-tab WebViews. See "Tab bar" below. |
| Stats sync bandwidth on weekly refresh | Low | Low | Delta endpoint streams JSON, gzip-compressed. |

## Tab bar

The plan does not ship per-tab WKWebView. A single WebView with client-side routing matches bundled mode best (preserves TanStack Query cache, in-memory state, and JS context across tab switches). If WebView gesture/scroll performance becomes a real user complaint after Phase 5, revisit then for the most-affected surface only (the board canvas).

## Success criteria

| Layer | Done when |
|---|---|
| Hosting | `boardsesh.com`, backend, Postgres all on Railway. Vercel + Neon shut down. |
| GraphQL | Non-auth REST routes have GraphQL equivalents. `/api/v1/*` and `/api/internal/*` data routes proxy to backend or are removed. |
| Dual-build | Both `next build` and `BUILD_TARGET=export next build` succeed in CI. The export `out/` is consumed by `mobile/`. |
| Bundle switch | Bundled iOS + Android apps launch in airplane mode, reach the home screen, and complete bearer-token auth from a fresh install. Kill-switch flip verified. |
| Refdata | Search and climb detail render from local SQLite. First sync on online launch applies stat deltas without re-downloading the snapshot. |
| User data | Ticks, playlists, profile render offline after one online session. SWR refresh < 2s on online transition. |
| Mutation queue | Pinned user story passes in CI on a Capacitor simulator with network simulation. No duplicate ticks under network-failure replay. |
| Polish | Online/offline banner, sync count, retry UI, onboarding line about offline. |

### Performance targets

| Metric | Target |
|---|---|
| Cold start to interactive (bundled) | < 1.5s on a 2022 mid-tier Android device |
| Climb search latency (local SQLite) | < 100ms p95 for unfiltered queries |
| BLE connection | < 5s |
| BLE LED send | < 1s after connect |
| Native shell binary | < 15 MB without refdata |
| Refdata per-board download | target < 200 MB compressed (gating) |

### Platform requirements

| | Minimum |
|---|---|
| iOS | 14.0 (Capacitor 8 minimum) |
| Android | API 23 (Capacitor 8 minimum); target API 34+ |

## Considered alternatives (one paragraph each)

**TanStack Start migration (was v6.0).** Move the entire web stack from Next.js to TanStack Start (Vite + TanStack Router). One Vite codebase, two builds. Rejected because the dual-build problem v8.0 solves with parallel `app/` trees does not require a framework swap, and the rewrite cost (8-10 weeks of route-file rewrites) buys no marginal user value.

**React Native + Tamagui hybrid.** Native shell with Tamagui for critical-path screens, `react-native-webview` embedding `boardsesh.com` for the long tail. Rejected because it discards the existing Capacitor + LiveActivity + BLE adapter investment and forks the UI into two render systems (MUI on web, Tamagui on native). Worth revisiting only if WebView gesture performance becomes a real complaint after Phase 5, and only for the board canvas.

**Migrate NextAuth to backend Hono.** Possible long-term cleanup. Out of scope for this plan because bearer-token auth in bundled mode and cookie auth in standalone web both work without it.

## Appendix

### Capacitor 8 dependencies (current `mobile/package.json`)

```json
{
  "dependencies": {
    "@capacitor-community/bluetooth-le": "^8",
    "@capacitor-community/in-app-review": "^8.0.0",
    "@capacitor-community/keep-awake": "^8",
    "@capacitor-community/safe-area": "^8",
    "@capacitor/android": "^8",
    "@capacitor/app": "^8",
    "@capacitor/browser": "^8",
    "@capacitor/core": "^8",
    "@capacitor/geolocation": "8.1.0",
    "@capacitor/ios": "^8",
    "@capacitor/motion": "^8"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.3.1",
    "typescript": "^5.9.3"
  }
}
```

Phases 3 and 4 add `@capacitor-community/sqlite`. Phase 6 adds `@capacitor/network`. Other plugins (`haptics`, `keyboard`, `status-bar`, `splash-screen`, `push-notifications`) are added on demand, not preemptively.

### Permissions

iOS `Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Boardsesh connects to your climbing board to control LED holds.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Connect to your climbing board to control LED holds.</string>
```

Android `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
```

### Deep links

Custom scheme:

- `boardsesh://party/join/{sessionId}` — join party session
- `boardsesh://climb/{uuid}` — open climb detail
- `boardsesh://board/{boardName}/{layoutId}/{sizeId}/{setIds}/{angle}` — open board config

Universal / App Links: scoped paths only (`/party/*`, `/invite/*`). Do not register the entire `boardsesh.com` domain.

### Capacitor vs web feature matrix (post-Phase 2)

| Feature | Web (Chrome) | Web (Safari iOS) | Capacitor (bundled) |
|---|---|---|---|
| BLE | Web Bluetooth | Not supported | Native plugin |
| Offline climb search | Not available | Not available | Local SQLite |
| Offline user data | Not available | Not available | Local SQLite cache |
| Offline writes | Not available | Not available | Mutation queue |
| Push notifications | Web Push | Limited | APNs / FCM (when shipped) |
| Haptics | Not available | Not available | Native (when added) |
| Wake lock | Screen Wake Lock API | Not supported | KeepAwake plugin |
| Cold start to interactive | < 2s cached | < 2s cached | < 1.5s (bundled) |

---

## Changelog

**v8.0 — current.**
- Reflects actual repo state: `mobile/` lives at the repo root (not `packages/mobile/`); the Capacitor shell is on v8 (not v6); 14 backend GraphQL resolver domains already exist; only 7 server pages call `next/headers` and 4 import the DB directly.
- Commits to bearer-token auth in bundled mode. Cross-origin cookies are no longer the path.
- Specifies the dual-build mechanism concretely: parallel `page.tsx` / `page.bundled.tsx` files driven by `pageExtensions`, not a runtime branch.
- Specifies the query router shape contract as a discriminated `QueryResult<T>` so components type-gate on `source` for online-only fields.
- Specifies mutation idempotency: client-generated UUID v7 keys plus a `mutation_dedup` table on the backend.
- Replaces the unmeasured SQLite size estimates with a Phase 3 measurement spike that gates the delivery model.
- Expands the hosting cutover scope to include Vercel cron, image optimization, and OG image generation. Estimate up from 2-3w to 4w.
- Honest dependency graph: phases are mostly sequential, not "each independently shippable." Critical path is ~30 weeks one-engineer, ~7 months calendar best case.
- Adds a Plan B for App Store rejection and a hard requirement for a remote-config kill switch in Phase 2.
- Drops per-tab WKWebView from the plan; single WebView with client routing.
- Trims the document by ~50% from v7.0; historical changelogs (v3 → v7) and detailed rejected alternatives are preserved in the git history of `docs/mobile-app-plan.md` rather than this file.

**v7.0 — superseded by v8.0.** Pivoted to offline-first on Next.js dual-build. The strategic direction was right; the execution detail was thin and the timelines optimistic. v8.0 keeps the direction and tightens the rest.

**v3.0 → v6.0** — see git history of this file.
