# Contributing to Boardsesh

[Join us on Discord](https://discord.gg/YXA8GsXfQK)

# Getting Started

## How to get everything going

If you want to fix bugs, build features, or make this app even better, follow the instructions described in this [blogpost](https://www.linkedin.com/pulse/git-github-demystified-guide-open-source-contribution-nishan-baral-i4ndc).

You can also check out this [video](https://www.youtube.com/watch?v=dSl_qnWO104) with the full explanation (yes, it is super old, but the concepts are still valid).

## One-Command Setup

Run the automated setup script:

```bash
./packages/web/setup-dev.sh
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

## Start Developing

After setup completes, there will be a Docker container running with the database and shared data; you can then start the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
