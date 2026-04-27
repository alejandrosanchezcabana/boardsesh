# Neon to Railway PostgreSQL Migration Runbook

Migration from Neon PostgreSQL to Railway PostgreSQL with a homelab read replica.

---

## 1. Why We Migrated

- Neon was $50-100/mo, the single biggest recurring expense.
- We used none of Neon's advanced features (no branching, no scale-to-zero reliance).
- Simplification: one driver (`postgres-js`) instead of three (`@neondatabase/serverless` HTTP driver, Neon WebSocket pooler, `postgres-js` for tests).

## 2. Architecture

### Before

```
Vercel Functions → Neon HTTP Driver → Neon PostgreSQL
Backend → Neon WebSocket Pool → Neon PostgreSQL
Local Dev → neon-proxy Docker → Local PostgreSQL
```

### After

```
Vercel Functions → TCP → Railway PgBouncer → Railway PostgreSQL (primary)
Backend → TCP → Railway PgBouncer → Railway PostgreSQL
Local Dev → TCP → Local PostgreSQL (direct, no proxy)
                                      │
                           async streaming replication
                                      │
                         Homelab PostgreSQL (read replica, AU)
```

## 3. Railway PostgreSQL Setup

1. Create a PostgreSQL instance on Railway in the same project as the backend service.
2. Enable required extensions:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```
3. Railway includes PgBouncer. Use the **pooled** connection string for Vercel and the backend service.
4. Use the **direct** (non-pooled) connection string for migrations and long-running scripts.

## 4. Data Migration Procedure

Dump from Neon:

```bash
pg_dump --no-owner --no-acl -Fc "$NEON_DATABASE_URL" > boardsesh.dump
```

Restore to Railway:

```bash
pg_restore --no-owner --no-acl -d "$RAILWAY_DATABASE_URL" boardsesh.dump
```

Validate row counts on both Neon and Railway, then compare:

```sql
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

Run this on both databases. Every table should match.

## 5. Cutover Steps

1. Set `DATABASE_URL` in Vercel project settings to the Railway pooled connection string.
2. Update the Railway backend service `DATABASE_URL` env var to the Railway pooled connection string.
3. Deploy web + backend.
4. Monitor error rates and query latency for 24-48 hours.

## 6. Rollback Procedure

- Keep Neon credentials saved. Do not delete the Neon project for at least 30 days after cutover.
- To rollback: change `DATABASE_URL` back to the Neon connection string in both Vercel and Railway.
- Redeploy web + backend.
- If any writes happened against Railway after cutover, you will need to replay them or accept data loss for that window.

## 7. Homelab Read Replica Setup

### 7.1 PostgreSQL Installation

Install PostgreSQL 17.x to match Railway's version. Enable the same extensions:

```bash
sudo apt install postgresql-17 postgresql-17-postgis-3
```

Then in `psql`:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 7.2 Replication User on Railway

Connect to Railway's PostgreSQL and create a replication role:

```sql
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'secure-password-here';
```

Create a replication slot for the homelab replica:

```sql
SELECT pg_create_physical_replication_slot('homelab_replica');
```

### 7.3 Network Connectivity

Pick one:

- **WireGuard tunnel** from homelab to Railway. Homelab initiates the connection, so no inbound port forwarding is needed. This is the simplest option.
- **Cloudflare Tunnel** for TCP proxying to Railway's PostgreSQL port.
- **Direct connection** if the homelab has a static IP. Add the IP to Railway's allowlist.

### 7.4 Initial Base Backup

Stop PostgreSQL on the homelab, clear the data directory, and take a base backup:

```bash
sudo systemctl stop postgresql
sudo rm -rf /var/lib/postgresql/17/main/*

pg_basebackup -h railway-host -p 5432 -U replicator \
  -D /var/lib/postgresql/17/main -Fp -Xs -P -R

sudo chown -R postgres:postgres /var/lib/postgresql/17/main
sudo systemctl start postgresql
```

The `-R` flag writes `standby.signal` and sets `primary_conninfo` in `postgresql.auto.conf`.

### 7.5 Streaming Replication Config

Verify or adjust the following in `postgresql.conf` on the homelab:

```
primary_conninfo = 'host=railway-host port=5432 user=replicator password=xxx sslmode=require'
primary_slot_name = 'homelab_replica'
hot_standby = on
```

Check replication status from Railway:

```sql
SELECT * FROM pg_stat_replication;
```

Check replica lag from the homelab:

```sql
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

### 7.6 Application Read Routing

The codebase supports a `READ_REPLICA_URL` environment variable. When set, `createReadDb()` returns a read-only client pointed at the replica.

Route to the replica:

- Analytics and stats queries
- Search results (seconds-stale data is acceptable)
- Feed generation
- Profile views

Keep on primary:

- Auth and sessions
- All writes
- Real-time session data (party mode)

### 7.7 DR Failover

If Railway goes down:

1. Promote the homelab replica:
   ```bash
   pg_ctl promote -D /var/lib/postgresql/17/main
   ```
2. Update `DATABASE_URL` in Vercel and the backend service to point at the homelab.
3. Accept higher latency temporarily (AU to global users).
4. Once Railway recovers, re-establish replication in the opposite direction or re-baseline from the homelab.

## 8. Verification Checklist

- [ ] `pg_dump` from Neon completes without errors
- [ ] `pg_restore` to Railway completes without errors
- [ ] Row counts match between Neon and Railway for all tables
- [ ] Extensions verified: `SELECT * FROM pg_extension;` shows postgis, uuid-ossp, pg_trgm
- [ ] `bun run db:migrate` works against Railway
- [ ] Web app loads and serves pages correctly
- [ ] Climb search works
- [ ] User auth (login/signup) works
- [ ] Party/session mode works (WebSocket backend)
- [ ] Aurora sync runs successfully
- [ ] OG image generation works (`/api/og/climb`, `/api/og/profile`)
- [ ] No Neon references remain in codebase: `grep -r "neondatabase" packages/`

## 9. Cost Comparison

| Item | Neon (Before) | Railway (After) |
|------|---------------|-----------------|
| Database hosting | $50-100/mo | ~$5-20/mo (existing subscription) |
| Connection pooling | Included | PgBouncer included |
| Read replica | Extra cost | $0 (homelab) |
| **Total** | **$50-100/mo** | **$5-20/mo** |
