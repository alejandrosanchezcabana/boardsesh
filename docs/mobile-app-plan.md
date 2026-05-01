# Boardsesh Mobile App Distribution Plan (Capacitor) — v9.0

## What this document is

A working plan for the Capacitor mobile app and the parallel work to make it usable offline. v9.0 commits to two direction changes from v8.0:

1. **Migrate the web from Next.js to Vite + TanStack Start.** The dual-build mechanism in v8.0 (parallel `page.tsx` / `page.bundled.tsx` driven by `pageExtensions`) was the ugliest part of that plan. A Vite SPA with route-level SSR opt-in deletes the entire problem: one build by default, SSR added only on the SEO surfaces that need it. The Capacitor app loads the Vite SPA build directly.
2. **Self-host on Railway. No Vercel, no Cloudflare Pages, no Netlify.** Railway is a thin PaaS that runs Docker / Node containers and gets out of the way. Cloudflare stays as a CDN in front of Railway, but only for caching and not for compute. Image optimization, OG image generation, cron, scheduled jobs all run as Node services on Railway. The cost is owning operational concerns Vercel handled silently; the benefit is no framework gravity.

Everything else from v8.0's offline-first design — bearer-token auth in bundled mode, the query router shape contract, the mutation queue with idempotency keys, refdata SQLite measurement spike, App Store Plan B, remote-config kill switch, single WebView with client routing — carries forward.

## Pinned user story

A user opens Boardsesh in airplane mode at the gym. They launch the app, browse and search climbs for their board, build a queue, connect via BLE, send climbs to the board (LEDs light up), and tick the ones they sent. Real-time-only features (party mode, comments, others' profiles) show a "needs network" state. When the user reconnects, queued ticks and edits sync to the server. Phase 5 is the milestone where this end-to-end story works.

## Current state (verified against `main`)

| Area | Status |
|---|---|
| Capacitor shell at `mobile/` | Capacitor 8. iOS + Android projects, `capacitor.config.ts`, `BoardseshWidgets` LiveActivity extension. Loads `https://www.boardsesh.com` in hosted mode today. |
| iOS app-bound domains | `boardsesh.com`, `*.boardsesh.com`, `*.ts.net` declared in `WKAppBoundDomains`. `limitsNavigationsToAppBoundDomains: true`. |
| BLE adapter | `packages/web/app/lib/ble/{capacitor-adapter,web-adapter,adapter-factory,types,...}.ts` with tests. |
| Native plugins installed | `@capacitor-community/{bluetooth-le, in-app-review, keep-awake, safe-area}`, `@capacitor/{app, browser, core, geolocation, motion}`. |
| Native plugins not installed | `@capacitor-community/sqlite`, `@capacitor/{push-notifications, network, haptics, keyboard, status-bar, splash-screen}`. |
| Backend GraphQL | 14 resolver domains under `packages/backend/src/graphql/resolvers/` (board, ticks, users, social, queue, sessions, playlists, favorites, controller, climbs, ...). |
| Web framework | Next.js 16.1.6 + NextAuth 4.24.13. 47 `page.tsx` files. 68 dynamic route files. 102 files importing from `next/{link,navigation,image}`. 21 files using `generateMetadata` / `generateStaticParams`. `middleware.ts` for PHP-block, board-name validation, list-page caching, climb-session cookies. |
| REST routes in `packages/web/app/api/` | 44 `route.ts` files. |
| Hosting | Vercel (web) + Neon (Postgres) + backend on its current host. |
| TanStack already in use | `@tanstack/react-query`, `@tanstack/react-virtual`. Adding `@tanstack/react-router` + `@tanstack/start` is incremental. |

The Next.js surface is large but tractable: ~47 route files to port, ~100 import sites to swap. The existing TanStack Query usage means data-fetching patterns transfer with little change.

## Architecture target

```
   ┌───────────────── boardsesh.com (Railway) ─────────────────┐
   │                                                            │
   │  packages/web (Vite + TanStack Start, Node SSR server)     │
   │   • SSR routes: /, /b/<board>, /b/<board>/.../view/<uuid>, │
   │     /profile/<id>, /setter/<name>, /playlists/<uuid>       │
   │   • SPA routes: everything else (client-rendered, hydrated │
   │     against in-memory router state)                        │
   │   • `vite build` produces both `dist/server/` (SSR Node    │
   │     bundle) and `dist/client/` (browser assets)            │
   │                                                            │
   │  packages/backend (Hono + graphql-ws + Yoga)               │
   │   • GraphQL queries, mutations, subscriptions              │
   │   • Auth: arctic (OAuth) + lucia (sessions) replace        │
   │     NextAuth. Bearer tokens for native, cookies for web.   │
   │   • OG image rendering (satori + @resvg/resvg-js)          │
   │                                                            │
   │  packages/scheduler (small Node service)                   │
   │   • Replaces Vercel Cron. node-cron triggers internal      │
   │     GraphQL mutations or Hono endpoints with shared-secret │
   │   • Aurora sync, cleanup, prewarm-heatmap, etc.            │
   │                                                            │
   │  Postgres + PostGIS + Redis (all on Railway)               │
   │                                                            │
   │  Cloudflare in front: CDN cache for static assets, R2 for  │
   │  refdata snapshots, optionally Cloudflare Images for       │
   │  user-uploaded photos                                      │
   └────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS GraphQL + WebSocket
                              │
   ┌───────────────── mobile/ (Capacitor 8) ───────────────────┐
   │                                                            │
   │  iOS WKWebView / Android WebView                           │
   │   • Loads SPA bundle from capacitor://localhost            │
   │     (the same `dist/client/` assets, no SSR)               │
   │   • Bearer-token auth, no cookie reliance cross-origin     │
   │                                                            │
   │  Local data:                                               │
   │   • Refdata SQLite per board (ODR / Asset Pack)            │
   │   • cached_ticks, cached_playlists, cached_profile         │
   │   • pending_mutations (write queue)                        │
   │                                                            │
   │  Native: BLE central, LiveActivity, connectivity monitor   │
   └────────────────────────────────────────────────────────────┘
```

The same `dist/client/` assets serve the web SPA hydration AND the Capacitor bundle. No parallel builds. No `pageExtensions` trick.

## Why Vite + TanStack Start

Considered: TanStack Start, Vike, plain Vite + a custom prerender step, React Router 7, Astro.

**Chosen: TanStack Start.**

- **Same renderer for SSR and SPA.** `vite build` produces a Node SSR bundle + client bundle. Mark routes as `ssr: true` or `ssr: false` per route. Capacitor uses the client bundle directly.
- **TanStack Router is type-safe and file-based.** Route loaders are explicit functions; no implicit server-component / client-component split.
- **TanStack Query is already in the project.** TanStack Router integrates with it natively for data preloading.
- **Vite means fast dev.** The current Next.js dev cycle is the slowest part of the project; Vite typically cuts cold start by 10x for projects this size.
- **Runs anywhere Node runs.** No Vercel-specific runtime, no edge-function gymnastics, no `next/image` infrastructure to replicate.

Rejected:

- **Vike** is more flexible and battle-tested but requires choosing a router separately. We already use TanStack Query; pairing with TanStack Router is the lower-friction choice. Worth revisiting only if TanStack Start's maturity becomes blocking.
- **React Router 7 (Remix-merged).** SSR-first model is less natural for our SPA-first goal. Strong project, wrong shape.
- **Astro.** Great for content sites; in-app SPA experience is a separate concern handled via "islands" of React. Two mental models for one app.
- **Next.js dual-build with `pageExtensions`** (v8.0). Works, but the parallel `page.bundled.tsx` files and `output: 'export'` constraints are friction every team member pays forever.

The maturity risk on TanStack Start is real (1.x, evolving fast). Mitigation: pin minor versions, follow the migration guides, and budget a dedicated 1-week buffer per quarter for upgrade churn during the migration year.

## Why self-host on Railway (no Vercel)

Railway is a thin PaaS. It runs Docker containers, Node services, scheduled jobs, and a managed Postgres / Redis. It does not impose a deployment shape, runtime, or SDK. Compared with Vercel:

| Concern | Vercel | Railway (chosen) |
|---|---|---|
| Compute model | Serverless functions, edge runtime | Long-lived Node containers |
| Image optimization | Built-in `next/image` endpoint | We provide our own (`@image-optim/sharp` route or Cloudflare Images) |
| Cron | Vercel Cron triggers HTTP endpoints | `packages/scheduler` runs node-cron in a long-lived container |
| Edge cache | Automatic for static assets | Cloudflare in front of Railway origin |
| OG image rendering | Edge runtime with `@vercel/og` | Hono route in `packages/backend` with `satori` + `@resvg/resvg-js` |
| Logs / metrics | Vercel-native | Railway logs piped to OpenTelemetry collector → ClickHouse / Axiom (or stay with Sentry / PostHog) |
| Deploy | `vercel deploy` or git-push | Railway git integration or GitHub Actions → `railway up` |

What we lose: instant-rollback button, framework-aware build optimization, free DDoS protection (kept via Cloudflare), some preview-deployment ergonomics.

What we gain: portability. Anything we run on Railway can move to Fly.io, AWS ECS, Hetzner with Coolify, or bare metal. No code changes required.

What we own that Vercel handled silently:

- **Connection pool tuning.** Long-lived Node + `postgres-js` pool max + Postgres `max_connections` need explicit numbers, not auto-scale.
- **Pod scaling.** Single Node process by default; vertical scale before horizontal. If horizontal, sticky sessions for SSR (or fully stateless SSR with an external session store — we're already using Redis for the backend).
- **Health checks and graceful shutdown.** Railway pings; Node service must respond and drain in-flight requests on SIGTERM.
- **Build cache.** Railway caches Docker layers; the project's Dockerfile must structure layers so `bun install` is cached separately from source.
- **Backups.** Railway Postgres takes daily backups by default; verify retention and cost.

These are tractable and well-understood operational items. The plan budgets explicit time for them in Phase 0a.

## Hosted vs bundled mode

Today the WebView loads `https://www.boardsesh.com` (hosted mode). After the migration + offline-first work, it loads `dist/client/` from `capacitor://localhost` (bundled mode). The same Vite client bundle ships to both. The differences:

| | Hosted (today) | Bundled (Phase 2+) |
|---|---|---|
| Initial load | Network round-trip on every cold start | Local files, no network |
| Update cadence | Every Railway deploy ships to all users | OTA bundle swap (preferred) OR app store update |
| Auth | Cookie inside same-origin WebView | Bearer token (no cross-origin cookie reliance) |
| App Store "wrapper" risk | Higher | Lower (clear native value: bundled assets + offline + BLE + LiveActivity) |

## Build mechanism (drops out)

`vite build` produces `dist/server/` (Node SSR bundle, deployed to Railway) and `dist/client/` (browser assets, served by SSR for hydration AND copied into the Capacitor app verbatim). One source tree, one build command, one set of route files. No conditional `pageExtensions`.

For the Capacitor app, `mobile/` runs a small script during its sync step:

```bash
# mobile/scripts/sync-bundle.sh
bun run --filter=@boardsesh/web build:client
rm -rf mobile/dist
cp -r packages/web/dist/client mobile/dist
bunx cap sync
```

The Vite config sets `base: '/'` for web hydration and `base: './'` for Capacitor. A single env var (`VITE_BUILD_TARGET=capacitor`) flips it. No second config file.

Routes that use server-only code (DB access, secrets) declare it via TanStack Start's `createServerFn`. Calling a server function from a client-rendered route is a typed RPC; calling it from an SSR-rendered route inlines the call. The same component code works in both modes.

## Auth (bearer tokens for native, cookies for web)

NextAuth is replaced. `packages/backend` becomes the auth host using **arctic** (OAuth provider library) + **lucia** (session library) + a thin schema in Postgres. The current NextAuth tables (`accounts`, `sessions`, `users`, `verification_tokens`) map cleanly; a one-time migration script copies existing sessions. Existing Aurora-credential proxy logic stays in `packages/web` (now a Vite Node SSR endpoint or a backend Hono route — either works; we'll pick during Phase 0b).

### Two paths from one source

1. **Web (browser).** Standard cookie session. arctic redirects to OAuth provider, lucia issues a session cookie, the SSR layer reads it. `Authorization` header optional.
2. **Native (Capacitor).** Bearer token.
   - WebView opens `/auth/native-start` in the Capacitor Browser plugin (SFSafariViewController / Custom Tabs).
   - OAuth runs in the system browser context.
   - Provider redirects to `/auth/callback` on `boardsesh.com` (system browser cookie context).
   - Backend issues a short-lived (5min) HMAC transfer token, redirects to `com.boardsesh.app://auth/callback?token=...`.
   - Native code intercepts the deep link, closes the browser tab, POSTs the transfer token to `/auth/native/exchange`.
   - Backend validates, issues a long-lived JWT (30d, refreshable) + refresh token, both stored via `@capacitor/preferences` (Keychain on iOS, encrypted SharedPreferences on Android).
   - A fetch interceptor in `packages/web/app/lib/auth/native-token.ts` attaches `Authorization: Bearer <jwt>` to every GraphQL request.
   - WebSocket connection params include the token.

Refresh: when JWT is within 24h of expiry, the interceptor uses the refresh token to mint a new pair. Refresh failures (revoked, expired) trigger a re-auth via the Browser plugin.

`useSession`-equivalent: a small `SessionProvider` reads from `@capacitor/preferences` (native) or from cookies via a server function (web). Components consume the same hook.

What this is NOT:

- Not a hand-rolled crypto stack. arctic + lucia handle the OAuth and session primitives; we own the schema and the bearer-token issuance.
- Not a Next.js shim. Once `packages/web` is migrated, NextAuth code is deleted entirely.

Estimate: 4 weeks for the auth re-implementation (Phase 0c, runs parallel to 0a/0b).

## Query router and shape contract

Unchanged from v8.0. Reproduced for completeness.

```ts
// packages/web/src/lib/data/query-router.ts

export type QuerySource = 'local' | 'remote' | 'remote-fresh';

export interface QueryResult<T> {
  data: T;
  source: QuerySource;
  stripped?: ReadonlyArray<keyof T>;
  fetchedAt: number;
}

export interface RouteSpec<TArgs, T> {
  local?: (args: TArgs) => Promise<{ data: T; stripped: ReadonlyArray<keyof T> }>;
  remote: (args: TArgs) => Promise<T>;
  prefer: 'local-first' | 'cache-first' | 'remote-only';
  staleAfterMs?: number;
}
```

Per-route table (same as v8.0): `climbs.search` and `climbs.byUuid` are `local-first` in bundled mode and strip user-specific fields; `ticks.forUser`, `playlists.forUser`, `profile.me` are `cache-first`; party state, feed, comments are `remote-only`. Components type-gate on `source` for online-only fields.

Cache priming runs after first online-launch-after-auth, surfaces a "Syncing your climbs" indicator, and refreshes deltas on subsequent launches.

## Mutation queue

Unchanged from v8.0. Client-generated UUID v7 idempotency keys, server-side `mutation_dedup` table (entries expire after 30 days), single-concurrency drainer in `createdAt` order, transient vs terminal error classification, per-mutation conflict resolution:

- `tick.create`: server-wins existence check, idempotent.
- `playlist.addClimb` / `removeClimb`: idempotent set ops.
- `playlist.rename`: last-write-wins with server `updated_at` check; conflict prompts user.
- Queue / party operations: never queued, real-time only.

The "needs attention" UI ships with Phase 5, not as polish.

## Embedded SQLite (refdata)

Unchanged from v8.0.

- **Phase 3 starts with a one-week measurement spike.** Run `bun run packages/db/scripts/measure-mobile-export.ts` against a current dev DB snapshot. Commit to ODR / Asset Pack only if compressed Kilter fits under 200 MB. Fallback: per-layout split, or `frames` lazy-fetch on first view.
- Tables: `board_climbs`, `board_climb_stats`, `board_difficulty_grades`, `board_holes`, `board_layouts`, `board_product_sizes`, `board_products`, `board_sets`, `board_product_sizes_layouts_sets`.
- Indexes: `idx_climbs_search`, `idx_climbs_edges`, `idx_stats_lookup` on `(climb_uuid, angle)` — `board_type` lives on `board_climbs` not `board_climb_stats` — `idx_stats_difficulty`, `idx_climbs_name_nocase`, `idx_climbs_setter`.
- Two sync channels: new climbs (24h cadence) and stats refresh (weekly, separate endpoint, "stats updated N days ago" UI when stale).
- Build pipeline: GitHub Action runs `export-mobile-sqlite.ts` weekly, uploads zstd snapshots to Cloudflare R2, triggers ODR / Asset Pack manifest refresh. Mobile shell version is **not** bumped per snapshot.

## Hosting migration to Railway (Phase 0a)

| Component | From | To | Notes |
|---|---|---|---|
| Postgres | Neon | Railway Postgres + PostGIS 3.4+ | Verify `ST_HexagonGrid` for heatmap |
| DB driver | `drizzle-orm/neon-serverless` | `drizzle-orm/postgres-js` | Local dev already on this driver |
| Backend | Existing host | Railway, co-located with DB | Subscription reconnect during cutover |
| Web (Next.js, then Vite) | Vercel | Railway long-lived Node container | See Phase 1 for the framework swap |
| OG images | Vercel Edge | Backend Hono with `satori` + `@resvg/resvg-js` | Same URL shape preserved |
| Image optimization | Vercel | Cloudflare Images OR self-hosted `sharp` route | Decide during Phase 0a, not assumed |
| Cron | Vercel Cron | `packages/scheduler` (new), node-cron, shared-secret `CRON_TOKEN` | Targets existing internal endpoints |
| Aurora sync | Vercel-triggered runner | Same `packages/aurora-sync` runner, deployed as Railway service | `DATABASE_URL` re-pointed only |

### Cutover sequence

1. Stand up Railway Postgres + PostGIS. Restore from Neon snapshot. Verify heatmap and PostGIS test queries.
2. Stand up Railway backend pointing at Railway DB. Run e2e suite at staging hostname.
3. Stand up Railway Next.js (still Next, pre-migration) pointing at Railway DB. Run e2e suite.
4. Add `CRON_TOKEN` to all `/api/internal/*-cron` endpoints. Stand up `packages/scheduler` on Railway.
5. Move Aurora sync runner.
6. DNS flip for `boardsesh.com`. Keep Vercel project warm for 7 days as instant rollback.
7. Decommission Vercel + Neon.

Estimate: 4 weeks.

## Framework migration (Phase 1) — the big new phase

Replaces v8.0's "dual-build pipeline" entirely. This is the largest single phase in the plan.

### Approach: parallel package, route-by-route migration

- Create `packages/app/` with the Vite + TanStack Start skeleton, deploy config, auth scaffold.
- During migration, both `packages/web` (Next.js) and `packages/app` (Vite) deploy to Railway behind separate hostnames. Cloudflare splits traffic.
- Migrate routes in batches. For each route: port the page component, port any data loaders to TanStack Router `loader` functions or TanStack Query queries, port metadata to `head` / route options, port the test if it exists.
- After each batch, flip the Cloudflare router rule for that route from `web` to `app`. The user-visible URL is unchanged.
- After all routes are flipped, decommission `packages/web`. Rename `packages/app` to `packages/web`.

### Migration batches (approximate)

| Batch | Routes | Notes |
|---|---|---|
| Skeleton | `/`, `/about`, `/legal`, `/privacy`, `/help`, `/docs`, `/development`, `/aurora-migration` | Static-ish, low risk. Shake out the build + deploy + Cloudflare-routing pipeline. |
| Auth | `/auth/login`, `/auth/native-start`, `/auth/error`, `/auth/verify-request` | Cuts over with the arctic + lucia rollout in Phase 0c. |
| In-app — board | `/b/[board_slug]`, `/b/[board_slug]/[angle]/{list,liked,playlists,logbook,create,import}`, `/b/[board_slug]/[angle]/view/[climb_uuid]`, `/b/[board_slug]/[angle]/play/[climb_uuid]`, `/b/[board_slug]/[angle]/playlists/[playlist_uuid]` | The largest batch. Same route shape preserved; mostly client-rendered with TanStack Query. |
| In-app — full board path | `/[board_name]/[layout_id]/[size_id]/[set_ids]/[angle]/...` | Long path, deep dynamic routes; same conversion pattern as above. |
| Profile / setter / playlist | `/profile/[user_id]`, `/profile/[user_id]/{statistics,sessions,climbs}`, `/setter/[setter_username]`, `/playlists`, `/playlists/[playlist_uuid]` | SEO surfaces — these are SSR routes in TanStack Start. |
| Session / party | `/session/[sessionId]`, `/join/[sessionId]`, `/notifications`, `/feed` | Real-time-heavy, mostly SPA. |
| Settings | `/settings`, `/you`, `/you/{sessions,logbook}` | Auth-gated SPA. |

### Things deleted with NextAuth and Next.js

- `packages/web/middleware.ts` — PHP-block becomes a Hono pre-request handler in the SSR server; board-name validation moves to TanStack Router route loaders; list-page caching becomes a backend `Cache-Control` header on the GraphQL response; climb-session cookie handling moves to a small `serverFn`.
- `next/image` — replaced with `<img>` + `srcset` for the few responsive cases. Image optimization, where actually needed, hits the Cloudflare Images URL or the self-hosted `sharp` route.
- `generateMetadata` — TanStack Router `head` option per route.
- `generateStaticParams` — irrelevant; routes are SSR or SPA, not statically generated. (Public climb-view pages get SSR-with-cache rather than SSG. Cloudflare caches the SSR response.)
- All `/api/auth/*` routes — replaced by backend auth endpoints under `packages/backend/src/auth/`.
- Most `/api/internal/*` and `/api/v1/*` routes — replaced by GraphQL from `packages/backend` (Phase 0b finishes this).

### What stays as Vite Node SSR endpoints (not GraphQL)

- The auth callback for the native deep-link flow (`/auth/native/exchange`) — needs to mint bearer tokens server-side.
- Refdata sync endpoints (`/internal/climb-sync`, `/internal/stats-sync`) — bulk JSON streaming is friendlier as plain HTTP than GraphQL.
- A redirect endpoint for shortened climb links (`/internal/climb-redirect`) — needs to issue a 301.

These live as Hono routes in `packages/backend` (preferred) or as TanStack Start `serverFn` calls (acceptable, but only when the logic is genuinely web-only).

### Estimate

- Skeleton + first route batch (auth + static): 3 weeks (the new build/deploy pipeline takes most of this time, not the routes).
- In-app batches: 5-6 weeks across all in-app surface (~30 routes), pair-programmed if possible to keep velocity.
- SEO batches (profile, setter, playlist, climb view): 3 weeks. SSR + cache headers + metadata.
- Cutover + decommission: 2 weeks (DNS flip per batch, monitoring, Next.js retirement).
- Buffer for surprises: 2 weeks.

**Total Phase 1: ~14 weeks.** Larger than v8.0's "Phase 1: 6 weeks" but more honest, and Phase 2 (Capacitor bundle switch) becomes nearly free since the SPA build already exists.

## REST → GraphQL completion (Phase 0b)

Same shape as v8.0; the destination is unchanged by the framework move:

- `/api/internal/*` data ops → GraphQL in backend (most resolvers exist; ~8 net-new).
- `/api/v1/[board_name]/*` → GraphQL with same shape; URL kept via thin SSR-side proxies during overlap.
- `/api/v1/[board_name]/proxy/*` (Aurora) → GraphQL mutations.
- `/api/auth/*` → `packages/backend` auth (replaced as part of the NextAuth → arctic/lucia migration).
- `/api/og/*` → backend Hono with `satori`. URL shape preserved by the SSR server proxying `/api/og/*` to backend during overlap, then the URL is served by the backend directly after Phase 1 cutover.
- `/api/internal/*-cron` → endpoints stay (now in `packages/backend` or as SSR routes), wrapped with `CRON_TOKEN`. `packages/scheduler` calls them.

Estimate: 6 weeks. Runs parallel to Phase 0a and Phase 0c.

## Bluetooth (status quo)

The adapter abstraction at `packages/web/app/lib/ble/` ports as-is to `packages/app/`. Capacitor 8 MTU semantics on Android need a one-day verification on a physical Pixel before Phase 2. Bluefy banner suppression is already gated on `isNativeApp()`.

## Native polish (incremental)

Add as needed: `@capacitor/haptics` when the first haptic interaction is requested; `@capacitor/network` in Phase 6; status-bar / splash-screen / keyboard plugins only if specific issues surface.

Deep links (`boardsesh://party/*`, `/invite/*` Universal / App Links) continue working post-migration. The TanStack Router `notFound` route handles unknown deep-link paths.

## Analytics and observability

PostHog (single project, separate envs). `posthog-js` in the web (works in both web SSR/SPA and bundled). Server events from `packages/backend` via `posthog-node`. `distinct_id` lives in IndexedDB in bundled mode (not localStorage), bootstrapped from `@capacitor/device.identifier`.

Sentry for JS + native (iOS/Android SDKs added in Phase 2). Source maps uploaded for Vite builds (web client + SSR server) and native dSYMs / ProGuard.

Logs: backend + SSR server emit structured JSON to stdout. Railway's log forwarder ships to a chosen aggregator (Axiom is already in use per `packages/backend/src/services/axiom.ts`; keep it).

Cross-cutting; not phased.

## App Store distribution

### Review notes (committed text)

> Boardsesh controls climbing-board hardware via Bluetooth Low Energy. The app embeds a per-board climb database (~150 MB, downloaded on first board selection) so users can search and browse climbs without internet. Reviewers cannot pair to a physical Kilter or Tension board, so the demo flow below shows the offline-only functionality:
>
> 1. Open the app. Select "Kilter" → wait for board data download.
> 2. Without an account: tap "Browse climbs." Search for "Crimpy" — results render from the local database.
> 3. Tap any climb → the climb detail page renders with hold positions and grade.
> 4. Tap the BLE icon → device picker appears (will not find a board in the test environment, but proves native BLE is active).
>
> The app is not a web wrapper. The offline climb database, BLE control, and LiveActivity (visible from the lock screen during a session) are native features unavailable to a website.

### Plan B if iOS rejected on guideline 4.2

1. Ship Android first via Play Store internal testing.
2. Activate the dormant native onboarding flow (3 native screens before the WebView opens).
3. Make the LiveActivity always-on during a session.
4. Re-submit with explicit reply citing each native feature.

### Rollback

- **OTA evaluation at the start of Phase 2.** Compare Capacitor Live Updates (Ionic), Capgo, and a self-hosted bundle-swap. Decision committed before Phase 2 ships.
- **Remote-config kill switch is a hard requirement of Phase 2.** A small `app-config.json` on Cloudflare R2 can flip the WebView back to `server.url: 'https://www.boardsesh.com'` within minutes, no app store update.

## Phase plan (with explicit dependencies)

```
0a Hosting cutover ─┐
                    │
0b GraphQL cleanup ─┼─→ 1 Vite migration ─→ 2 Bundle switch ─→ 3 Refdata SQLite ─┐
                    │                                                              │
0c Auth (arctic) ───┘                                          4 User-data cache ─┴─→ 5 Mutation queue ─→ 6 Connectivity polish
```

| Phase | Estimate | Hard deps | Done when |
|---|---|---|---|
| 0a Hosting → Railway | 4w | none | Postgres + backend + Next.js web all on Railway. Vercel + Neon decommissioned. |
| 0b GraphQL completion | 6w | none | Non-auth REST routes have GraphQL equivalents. |
| 0c Auth: NextAuth → arctic + lucia | 4w | 0b largely done | Backend issues bearer tokens for native + cookie sessions for web. Existing user sessions migrated. |
| 1 Vite + TanStack Start migration | 14w | 0c (auth must be portable) | All routes ported, Next.js decommissioned, `packages/web` is Vite. SSR for SEO surfaces, SPA for in-app. |
| 2 Capacitor bundle switch | 3w | 1 | App launches in airplane mode, bearer auth works, kill-switch verified. The bundle is just `dist/client/`. |
| 3 Refdata SQLite | 4w (incl. measurement spike) | 2 | Search and climb detail render from local DB offline. |
| 4 User-data cache | 5w | 2 | Profile, ticks, playlists render offline after one online session. |
| 5 Mutation queue | 5w | 4 | Pinned user story end-to-end. `mutation_dedup` server-side. "Needs attention" UI ships. |
| 6 Connectivity polish | 2w | 5 | Online/offline banner, sync count, retry UI, onboarding. |

Critical path for the pinned user story: 0a / 0b / 0c (parallel) → 1 → 2 → 3 → 4 → 5. With one full-time engineer and reasonable parallelism on 0a–0c, the chain is roughly: 6w (longest of 0a/0b/0c) + 14w + 3w + 4w + 5w + 5w = 37 weeks ≈ **9 months calendar**.

The realistic range is **9–14 months** depending on shared engineering capacity, surprises in the Vite migration (typical: 30-40% over estimate for framework migrations of this surface area), and store review cycles. The framework migration is the single largest risk; if Phase 1 slips, everything downstream slips.

## Risks (the ones that change behavior)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TanStack Start API churn during 14-week migration | Medium | Medium | Pin minor versions; budget 1w/quarter for upgrade churn; subscribe to TanStack release notes. |
| arctic + lucia migration loses existing sessions | Medium | High | Migration script copies `accounts` / `sessions` schema; run against a Neon snapshot in staging; users may re-auth on cutover but should not lose accounts. |
| OAuth flows differ subtly between NextAuth and arctic (Apple, Google specifics) | High | Medium | Each provider gets a paired Playwright e2e + manual smoke before its cutover batch. |
| SSR cache invalidation for climb-view pages misbehaves | Medium | Medium | Use ETag + short `s-maxage` (60s) at Cloudflare; backend emits `Cache-Tag` headers and purges on climb edit. |
| Self-hosted image optimization adds latency | Medium | Low | Cloudflare Images is the default; `sharp` self-host is fallback only. Decide in Phase 0a. |
| `packages/scheduler` cron drift / missed jobs | Medium | Medium | Each cron logs a heartbeat to Sentry; alert if absent for >2× expected interval. |
| Phase 1 page-conversion velocity is below estimate | Medium | High | First two batches (skeleton + auth) timeboxed; reassess Phase 1 schedule after they ship. |
| Bearer-token refresh edge cases | Medium | High | Refresh logic gets its own test suite; failed refresh triggers re-auth via Browser plugin, not silent failure. |
| Refdata SQLite > 200 MB compressed | Medium | Medium | Phase 3 measurement spike. Fallback: per-layout split or `frames` lazy-fetch. |
| `mutation_dedup` table grows unbounded | Low | Medium | Server expires entries >30d; client never replays mutations >30d. |
| OTA solutions all unacceptable; bundle regressions stuck on app store cycle | Medium | High | Remote-config kill switch flips to hosted mode without an app store update. |
| Apple 4.2 rejection | Medium | High | Plan B above. |
| Railway region outage | Low | High | Postgres backups daily; backend stateless; one-day RTO with manual restore. Consider warm replica in Phase 6+ if outages prove material. |

## Tab bar

The plan does not ship per-tab WKWebView. A single WebView with TanStack Router client-side routing matches bundled mode best. Revisit only if WebView gesture/scroll perf becomes a real complaint after Phase 5, and only for the board canvas.

## Success criteria

| Layer | Done when |
|---|---|
| Hosting | `boardsesh.com`, backend, Postgres, scheduler all on Railway. Vercel + Neon shut down. |
| GraphQL | Non-auth REST routes have GraphQL equivalents. |
| Auth | arctic + lucia in backend. NextAuth code deleted. Bearer tokens for native, cookies for web. |
| Framework | Vite + TanStack Start. Next.js code deleted. Both SSR (SEO) and SPA modes ship from one source tree. |
| Bundle switch | Bundled iOS + Android launch in airplane mode, complete bearer-token auth from a fresh install, kill-switch verified. |
| Refdata | Search and climb detail render from local SQLite. Stat deltas apply on next online launch. |
| User data | Ticks, playlists, profile render offline after one online session. SWR refresh < 2s on online transition. |
| Mutation queue | Pinned user story passes in CI on Capacitor simulator with network simulation. No duplicate ticks under failure replay. |
| Polish | Online/offline banner, sync count, retry UI, onboarding line about offline. |

### Performance targets

| Metric | Target |
|---|---|
| Cold start to interactive (bundled) | < 1.5s on a 2022 mid-tier Android |
| Climb search latency (local SQLite) | < 100ms p95 |
| BLE connection | < 5s |
| BLE LED send | < 1s after connect |
| Native shell binary | < 15 MB without refdata |
| Refdata per-board download | target < 200 MB compressed (gating) |
| SSR page TTFB at edge cache hit | < 100ms p95 |
| Vite dev cold start | < 5s |

### Platform requirements

| | Minimum |
|---|---|
| iOS | 14.0 (Capacitor 8 minimum) |
| Android | API 23 (Capacitor 8 minimum); target API 34+ |

## Considered alternatives (one paragraph each)

**Stay on Next.js with the v8.0 dual-build mechanism.** Workable. Avoids 14 weeks of framework migration. Costs: parallel `page.tsx` / `page.bundled.tsx` files forever, `pageExtensions` toggling, slow Next.js dev cycle, ongoing Vercel-shaped patterns even if hosted on Railway. Rejected because the team plans to spend years in this codebase and the migration pays off across that horizon.

**Vike instead of TanStack Start.** Vike is more mature and more flexible; you choose the router separately. Rejected only because TanStack Router pairs naturally with the TanStack Query usage already in the project. Worth revisiting if TanStack Start's maturity becomes blocking during Phase 1.

**React Router 7 (Remix-merged).** Strong project, SSR-first model. Rejected because SPA-first is the posture this plan needs and we'd be fighting the grain.

**Astro for SEO + plain Vite for the app.** Two mental models for one app. Rejected because the offline-first surface IS the app, and Astro's content-site strengths don't carry there.

**Stay on Vercel.** The deploy ergonomics are excellent. Rejected because the team's preference is to escape framework gravity; once you're on Vercel, every architectural choice gets routed through "what does Vercel reward." Railway is the thinnest PaaS that still handles Postgres, Redis, and cron without forcing a deployment shape.

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

Phases 3/4 add `@capacitor-community/sqlite`. Phase 6 adds `@capacitor/network`. Other plugins added on demand.

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

Universal / App Links: scoped paths only (`/party/*`, `/invite/*`). Not the entire `boardsesh.com` domain.

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

**v9.0 — current.**
- Commits to **migrating from Next.js to Vite + TanStack Start.** The dual-build mechanism in v8.0 is replaced by one source tree with per-route SSR / SPA flags.
- Commits to **self-hosting on Railway**. No Vercel, no Cloudflare Pages. Cloudflare stays as a CDN. `packages/scheduler` replaces Vercel Cron. Image optimization moves to Cloudflare Images or self-hosted `sharp`. OG image rendering moves to backend Hono with `satori`.
- Replaces NextAuth with **arctic + lucia** in `packages/backend`. Bearer tokens for native, cookie sessions for web. New Phase 0c (4 weeks, parallel to 0a/0b).
- Adds Phase 1 framework migration (~14 weeks) with explicit batch ordering.
- Reworks the dependency graph: critical path is now ~9 months calendar best case, 9–14 months realistic.
- Updates "Considered alternatives" to record TanStack Start vs Vike vs React Router 7 vs Astro reasoning, and Next.js dual-build (v8.0) as the rejected default.
- Carries forward unchanged from v8.0: pinned user story, query router shape contract, mutation queue with idempotency keys, refdata SQLite measurement spike, App Store Plan B, remote-config kill switch, single WebView with client routing, all SQLite indexes and sync channels.

**v8.0 — superseded by v9.0.** Same offline-first direction, but kept Next.js with a dual-build (`pageExtensions`) mechanism. Workable but ugly forever. v9.0 deletes that constraint by changing frameworks.

**v7.0 and earlier — see git history of this file.**
