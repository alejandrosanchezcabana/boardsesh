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

## 4. Data Migration: Railway as Temporary Read Replica of Neon

Instead of a one-shot `pg_dump`/`pg_restore` (which creates a gap where writes are lost), we run Railway as a **logical replica of Neon** during the transition. Every write to Neon streams to Railway in near-real-time. When we're confident Railway is caught up, we promote it and cut over with zero data loss.

### 4.1 Initial Bulk Load

Take a consistent dump from Neon and restore it to Railway. This gives Railway a baseline to start replication from.

```bash
pg_dump --no-owner --no-acl -Fc "$NEON_DATABASE_URL" > boardsesh.dump
pg_restore --no-owner --no-acl -d "$RAILWAY_DATABASE_URL" boardsesh.dump
```

### 4.2 Set Up Logical Replication (Neon → Railway)

Neon supports logical replication as a publisher. Railway PostgreSQL acts as the subscriber.

**On Neon (publisher):**

Neon already has `wal_level = logical`. Create a publication for all tables:

```sql
CREATE PUBLICATION boardsesh_migration FOR ALL TABLES;
```

**On Railway (subscriber):**

Create a subscription pointing back at Neon. Use `copy_data = false` since we already restored the dump:

```sql
CREATE SUBSCRIPTION boardsesh_neon_sub
  CONNECTION 'postgresql://user:pass@neon-host/dbname?sslmode=require'
  PUBLICATION boardsesh_migration
  WITH (copy_data = false);
```

### 4.3 Verify Replication Is Streaming

On Neon, check that the subscription is active:

```sql
SELECT * FROM pg_stat_replication;
```

On Railway, check subscription status:

```sql
SELECT subname, received_lsn, latest_end_lsn, latest_end_time
FROM pg_stat_subscription;
```

Confirm the `received_lsn` is advancing. Also compare row counts on a few high-write tables (e.g., `boardsesh_ticks`, `user_syncs`) to make sure they match.

### 4.4 Monitor During Transition Window

Leave both databases running for a few hours to a day. Any writes to Neon (user syncs, new ticks, comments, follows) will replicate to Railway automatically. Check replication lag periodically:

```sql
-- On Railway
SELECT now() - latest_end_time AS replication_lag
FROM pg_stat_subscription
WHERE subname = 'boardsesh_neon_sub';
```

Lag should be under a few seconds for our write volume.

### 4.5 Sequence Sync

Logical replication does not replicate sequences. Before cutover, sync sequence values from Neon to Railway so new inserts get the correct IDs:

```sql
-- Generate this on Neon:
SELECT format('SELECT setval(''%s'', %s);', sequence_name, last_value)
FROM information_schema.sequences s
JOIN pg_sequences ps ON ps.schemaname = s.sequence_schema AND ps.sequencename = s.sequence_name
WHERE s.sequence_schema = 'public';
```

Run the output on Railway.

## 5. Cutover Steps

1. Verify Railway replication lag is under 1 second.
2. Sync sequences from Neon → Railway (section 4.5).
3. Set `DATABASE_URL` in Vercel project settings to the Railway pooled connection string.
4. Update the Railway backend service `DATABASE_URL` env var to the Railway pooled connection string.
5. Deploy web + backend.
6. On Railway, drop the subscription (it's no longer needed):
   ```sql
   ALTER SUBSCRIPTION boardsesh_neon_sub DISABLE;
   DROP SUBSCRIPTION boardsesh_neon_sub;
   ```
7. On Neon, drop the publication:
   ```sql
   DROP PUBLICATION boardsesh_migration;
   ```
8. Monitor error rates and query latency for 24-48 hours.

## 6. Rollback Procedure

- Keep Neon credentials saved. Do not delete the Neon project for at least 30 days after cutover.
- **Before dropping the subscription** (step 5.6): rollback is instant — just flip `DATABASE_URL` back to Neon and redeploy. Neon still has all the data since it was the primary.
- **After dropping the subscription**: flip `DATABASE_URL` back to Neon, but any writes that happened on Railway after cutover won't be on Neon. For a quick rollback, set up reverse logical replication (Railway → Neon) before deleting the Neon project. For the volume of writes we get, a few hours of lost data is recoverable from Aurora sync re-import.

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

### Pre-cutover (while Railway is still a replica)

- [ ] `pg_dump` from Neon completes without errors
- [ ] `pg_restore` to Railway completes without errors
- [ ] Logical replication subscription is active and streaming
- [ ] Replication lag is under a few seconds
- [ ] Row counts match between Neon and Railway on high-write tables
- [ ] Extensions verified: `SELECT * FROM pg_extension;` shows postgis, uuid-ossp, pg_trgm
- [ ] Sequences synced from Neon to Railway

### Post-cutover

- [ ] `DATABASE_URL` updated in Vercel and Railway backend service
- [ ] Web app loads and serves pages correctly
- [ ] Climb search works
- [ ] User auth (login/signup) works
- [ ] Party/session mode works (WebSocket backend)
- [ ] Aurora sync runs successfully
- [ ] OG image generation works (`/api/og/climb`, `/api/og/profile`)
- [ ] Subscription dropped on Railway, publication dropped on Neon
- [ ] No Neon references remain in codebase: `grep -r "neondatabase" packages/`

## 9. Cost Comparison

| Item | Neon (Before) | Railway (After) |
|------|---------------|-----------------|
| Database hosting | $50-100/mo | ~$5-20/mo (existing subscription) |
| Connection pooling | Included | PgBouncer included |
| Read replica | Extra cost | $0 (homelab) |
| **Total** | **$50-100/mo** | **$5-20/mo** |
