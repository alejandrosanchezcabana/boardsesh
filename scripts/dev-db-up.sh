#!/bin/sh
#
# dev-db-up.sh — Start the development database stack and ensure data is ready.
#
# The pre-built Docker image (boardsesh-dev-db) already contains Kilter,
# Tension, and MoonBoard board data, a test user, and social seed data.
# This script:
#   1. Starts postgres and redis containers
#   2. Waits for postgres to be healthy
#   3. Ensures pg_hba.conf allows Docker network connections (for neon-proxy)
#   4. Ensures the postgres user has a password set (neon-proxy requires it)
#   5. Syncs drizzle migration tracker (public → drizzle schema)
#   6. Starts neon-proxy and waits for connectivity
#   7. Runs drizzle migrations (to pick up any newer migrations not yet in the image)

set -e

HBA_FILE="/var/lib/postgresql/pgdata/pg_hba.conf"
REPO_ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DRIZZLE_DIR="$REPO_ROOT/packages/db/drizzle"

run_pending_drizzle_sql_migrations() {
  last_migration_created_at=$(docker exec -u postgres "$PG_CONTAINER" psql -U postgres -d main -t -A -c \
    "SELECT COALESCE((SELECT created_at FROM drizzle.\"__drizzle_migrations\" ORDER BY created_at DESC LIMIT 1), 0);")

  pending_migrations=$(DRIZZLE_DIR="$DRIZZLE_DIR" LAST_MIGRATION_CREATED_AT="$last_migration_created_at" bun --eval '
    const fs = require("node:fs");
    const path = require("node:path");
    const crypto = require("node:crypto");

    const drizzleDir = process.env.DRIZZLE_DIR;
    const lastAppliedAt = Number(process.env.LAST_MIGRATION_CREATED_AT ?? 0);
    const journal = JSON.parse(fs.readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8"));

    for (const entry of journal.entries) {
      if (entry.when <= lastAppliedAt) continue;
      const sql = fs.readFileSync(path.join(drizzleDir, `${entry.tag}.sql`), "utf8");
      const hash = crypto.createHash("sha256").update(sql).digest("hex");
      process.stdout.write(`${entry.tag}|${entry.when}|${hash}\n`);
    }
  ')

  if [ -z "$pending_migrations" ]; then
    echo "  No pending migrations."
    return
  fi

  pending_count=$(printf '%s\n' "$pending_migrations" | sed '/^$/d' | wc -l | tr -d ' ')
  echo "  Applying $pending_count pending migration(s) from $DRIZZLE_DIR..."

  printf '%s\n' "$pending_migrations" | while IFS='|' read -r tag created_at hash; do
    [ -n "$tag" ] || continue
    migration_file="$DRIZZLE_DIR/$tag.sql"
    echo "    → $tag"

    {
      printf 'BEGIN;\n'
      cat "$migration_file"
      printf '\nINSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES (%s, %s);\n' "'$hash'" "$created_at"
      printf 'COMMIT;\n'
    } | docker exec -i -u postgres "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d main > /dev/null
  done
}

echo "Starting development database containers..."
docker compose up -d postgres redis

# Resolve container names dynamically (derived from directory name)
PG_CONTAINER=$(docker compose ps -q postgres)
NEON_SERVICE="neon-proxy"

echo "Waiting for postgres to be healthy..."
attempts=0
max_attempts=30
until docker exec "$PG_CONTAINER" pg_isready -U postgres -q 2>/dev/null; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge "$max_attempts" ]; then
    echo "ERROR: Postgres did not become ready within ${max_attempts}s"
    exit 1
  fi
  sleep 1
done
echo "Postgres is ready."

# ── Ensure pg_hba.conf allows Docker network connections ────────────────
# The neon-proxy container connects from the Docker network (172.x.x.x).
# We need an md5 auth rule for 0.0.0.0/0. Using 'trust' breaks the neon
# proxy because it tries to read the password hash from pg_authid.
echo "Ensuring pg_hba.conf allows Docker network connections..."
if docker exec "$PG_CONTAINER" grep -q "host all all 0.0.0.0/0 md5" "$HBA_FILE" 2>/dev/null; then
  echo "  pg_hba.conf already has md5 rule."
else
  echo "  Adding md5 auth rule for Docker network..."
  # Remove any trust rule for 0.0.0.0/0 (breaks neon proxy password lookup)
  docker exec "$PG_CONTAINER" sed -i '/host all all 0\.0\.0\.0\/0 trust/d' "$HBA_FILE" 2>/dev/null || true
  docker exec -u postgres "$PG_CONTAINER" bash -c "echo 'host all all 0.0.0.0/0 md5' >> $HBA_FILE"
  docker exec -u postgres "$PG_CONTAINER" pg_ctl reload -D /var/lib/postgresql/pgdata
  echo "  pg_hba.conf updated and reloaded."
fi

# ── Ensure postgres user has a password ─────────────────────────────────
echo "Ensuring postgres user password is set..."
docker exec -u postgres "$PG_CONTAINER" psql -U postgres -d main -c \
  "ALTER USER postgres WITH PASSWORD 'password';" > /dev/null 2>&1
echo "  Password ensured."

# ── Sync drizzle migration tracker ──────────────────────────────────────
# Older pre-built images only have the public.__drizzle_migrations table.
# Newer drizzle-orm uses the drizzle.__drizzle_migrations table. Ensure
# both schemas exist and are in sync so migrations don't re-run from 0.
echo "Syncing drizzle migration tracker..."

docker exec -u postgres "$PG_CONTAINER" psql -U postgres -d main -q -c \
  "CREATE SCHEMA IF NOT EXISTS drizzle;"

docker exec -u postgres "$PG_CONTAINER" psql -U postgres -d main -q -c \
  "CREATE TABLE IF NOT EXISTS drizzle.\"__drizzle_migrations\" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);"

# Copy records from public tracker to drizzle tracker if drizzle is empty
docker exec -u postgres "$PG_CONTAINER" psql -U postgres -d main -q -c \
  "INSERT INTO drizzle.\"__drizzle_migrations\" (hash, created_at) SELECT hash, created_at FROM public.\"__drizzle_migrations\" WHERE NOT EXISTS (SELECT 1 FROM drizzle.\"__drizzle_migrations\" LIMIT 1) AND EXISTS (SELECT 1 FROM public.\"__drizzle_migrations\" LIMIT 1) ORDER BY id;"

DRIZZLE_COUNT=$(docker exec -u postgres "$PG_CONTAINER" psql -U postgres -d main -t -A -c \
  "SELECT count(*) FROM drizzle.\"__drizzle_migrations\";")
echo "  drizzle.__drizzle_migrations has $DRIZZLE_COUNT records."

# ── Start neon-proxy now that postgres is configured ────────────────────
echo "Starting neon-proxy..."
docker compose up -d neon-proxy

# Wait for neon-proxy to accept connections
NEON_CONTAINER=$(docker compose ps -q "$NEON_SERVICE")
echo "Waiting for neon-proxy to be ready..."
attempts=0
max_attempts=30
while [ "$attempts" -lt "$max_attempts" ]; do
  attempts=$((attempts + 1))
  sleep 1
  # Check container is running
  if ! docker inspect "$NEON_CONTAINER" --format='{{.State.Running}}' 2>/dev/null | grep -q true; then
    continue
  fi
  # Check for connection errors in proxy logs
  if docker compose logs --tail=3 "$NEON_SERVICE" 2>&1 | grep -q "Console request failed"; then
    continue
  fi
  # Give it one more second to stabilize
  sleep 1
  if ! docker compose logs --tail=3 "$NEON_SERVICE" 2>&1 | grep -q "Console request failed"; then
    echo "  neon-proxy is ready."
    break
  fi
done

if [ "$attempts" -ge "$max_attempts" ]; then
  echo ""
  echo "ERROR: neon-proxy failed to connect to postgres."
  echo "Proxy logs:"
  docker compose logs --tail=5 "$NEON_SERVICE" 2>&1 | grep -i "error\|fatal\|fail"
  echo ""
  echo "pg_hba.conf non-comment lines:"
  docker exec "$PG_CONTAINER" grep -v "^#" "$HBA_FILE" | grep -v "^$"
  exit 1
fi

echo "Running database migrations..."
run_pending_drizzle_sql_migrations

echo ""
echo "Development database is ready."
echo "  Test user: test@boardsesh.com / test"
