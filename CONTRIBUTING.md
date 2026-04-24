# Contributing to Boardsesh

[Join us on Discord](https://discord.gg/YXA8GsXfQK)

# Getting Started

## How to get everything going

Fork the repo on GitHub, clone your fork locally, create a branch, make your change, and open a pull request against `main`. Run the setup script below to get a working local environment before you start.

## One-Command Setup

Run the automated setup script:

```bash
# macOS/Linux
./scripts/setup-dev.sh

# Windows (PowerShell) — install Vite+ first, then run the script manually
irm https://vite.plus/ps1 | iex
```

This script will:

- Check all prerequisites (Node.js, Docker, etc.)
- Install dependencies
- Set up environment files
- Optionally collect Aurora API tokens for sync features
- Set up and populate the database
- Run database migrations
- Perform final checks

Once you've run setup, you will have a copy of both the Tension and Kilter climbs database on your computer!!

After setup completes, open [http://localhost:3000](http://localhost:3000) after starting the dev server and log in with `test@boardsesh.com` / `test`.

## Start Developing

After setup completes, start the development server:

```bash
vp run dev
```

This automatically starts the database containers (PostgreSQL, neon-proxy, Redis), runs any pending migrations, and then launches the backend and web servers. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can also run pieces independently:

- `vp run db:up` - Database only (PostgreSQL, Redis, neon-proxy + migrations)
- `vp run dev:backend` - Database + backend only
- `vp run dev:web` - Database + web only

## Testing web changes on Android

You don't have to rebuild the Android app every time you change the web UI. The **debug APK** shipped with each main build includes a Dev URL switcher that points the in-app WebView at any origin you choose — typically your laptop reached over [Tailscale](https://tailscale.com).

### One-time setup: Tailscale

`vp run dev` already looks for Tailscale. It runs your local dev server through `scripts/dev-with-tailscale.ts`, which calls `tailscale status --json` to find your machine's MagicDNS name (e.g. `your-laptop.tail-scale.ts.net`) and binds `BASE_URL`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_WS_URL` to it. Without Tailscale it falls back to `localhost`, which Android can't reach from a real device.

1. Install Tailscale on both your laptop and your phone and sign into the same tailnet.
2. On your laptop, confirm `tailscale status` shows your phone online.
3. Start the dev server with `vp run dev`. Look for `[dev] Web URL: http://<your-host>.ts.net:3000` in the output — that's the URL to paste into the app.

### Point the app at your dev server

1. Grab `app-debug.apk` from the most recent [Android Build release](https://github.com/boardsesh/boardsesh/releases?q=android-build). Uninstall the release build first if you have it — both variants use the same package id.
2. Install the APK (enable "Install unknown apps" for your source if Android prompts you).
3. Open the app, tap the avatar in the top left, and choose **Dev URL** from the drawer.
4. Paste `http://<your-host>.ts.net:3000` (the URL `vp run dev` printed) and tap **Save & restart**. The app relaunches against your laptop.
5. If the dev server stops or you lose tailnet connectivity, the app shows a native **Reset to production** prompt (or, if the WebView gets far enough to render an error page, a **Reset dev URL** link) that clears the override and relaunches.

The menu item is only visible in debug builds; release builds don't expose it. Vercel preview URLs (`https://<preview>.boardsesh.com`) work too if you'd rather not run a local server.

## Keeping local data up to date

### Shared Data Sync (Public Climbs)

Once your server is running, you can manually trigger shared sync by visiting:

- **Kilter**: [http://localhost:3000/api/internal/shared-sync/kilter](http://localhost:3000/api/internal/shared-sync/kilter)
- **Tension**: [http://localhost:3000/api/internal/shared-sync/tension](http://localhost:3000/api/internal/shared-sync/tension)

This will sync the latest climbs, climb stats, beta links, and other data from Aurora's servers.

### Aurora User Data Sync (One-Way Only)

**Important**: Aurora user data sync is **one-way only** (Aurora → Boardsesh).

When you link your Aurora account in the app settings:

- Your Aurora data (logbook, ascents, climbs) is automatically imported to Boardsesh
- Data syncs immediately when you first link your account
- Automatic background sync runs every 6 hours to keep your data up-to-date
- **Data created in Boardsesh stays local and does NOT sync back to Aurora**

This is due to Aurora API limitations. Any ascents, climbs, or other data you create in Boardsesh will only exist locally in your Boardsesh account.

# Current status

Basic board use works, and the app already has queue controls. Open to feedback and contributions!
Using the share button in the top right corner, users can connect to each other and control the board and queue together.
Similar to Spotify Jams, no more "What climb was that?" "What climb was the last one?" "Mind if I change it?" questions during a sesh

## iOS support

Unfortunately, mobile Safari doesn't support web bluetooth. So to use this website on your phone, you could install an iOS browser that does have WebBLE support, for example, https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055

Bluefy is what I tested boardsesh in on my iphone and it worked like expected.

## Future features:

- Faster beta video uploads. Current process for beta videos is manual, and as a result new beta videos are almost never added. We'll implement our own Instagram integration to get beta videos faster.

# Self hosting

We plan to eventually have official support for self hosting, but currently it's still relatively involved to setup. Basically the development setup instructions should be used
for self-hosting too, but contributions would be very welcome.
The app is just a standard next.js app with Postgres.

# Thanks

This app was originally started as a fork of https://github.com/lemeryfertitta/Climbdex.
We also use https://github.com/lemeryfertitta/BoardLib for creating the database.
Many thanks to @lemeryfertitta for making this project possible!!
