#!/bin/sh
#
# dev-db-up.sh — Start the development database stack and ensure data is ready.
#
# The pre-built Docker image (boardsesh-dev-db) already contains Kilter,
# Tension, and MoonBoard board data, a test user, and social seed data.
# This script:
#   1. Starts postgres and redis containers
#   2. Waits for postgres to be healthy
#   3. Ensures pg_hba.conf allows Docker network connections
#   4. Ensures the postgres user has a password set
#   5. Syncs drizzle migration tracker (public → drizzle schema)
#   6. Runs drizzle migrations (to pick up any newer migrations not yet in the image)

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

# ── Fast path: if everything is already running, just check migrations ─
# This makes multi-worktree setups fast — the second worktree skips all
# container setup and pg_hba configuration.
all_running=true
for svc in postgres redis; do
  container=$(docker compose ps -q "$svc" 2>/dev/null)
  if [ -z "$container" ] || ! docker inspect "$container" --format='{{.State.Running}}' 2>/dev/null | grep -q true; then
    all_running=false
    break
  fi
done

if [ "$all_running" = true ]; then
  echo "All containers already running — checking for pending migrations..."
  PG_CONTAINER=$(docker compose ps -q postgres)
  run_pending_drizzle_sql_migrations
  echo ""
  echo "Development database is ready."
  echo "  Test user: test@boardsesh.com / test"
  exit 0
fi

# ── Cross-worktree fast path: postgres already running on port 5432 ──────
# If another worktree already started the DB stack, reuse it instead of
# starting duplicate containers (which would fail on port conflicts anyway).
# Only reuse the container if it is actually the boardsesh dev DB image —
# another project's postgres on port 5432 must not receive boardsesh migrations.
PG_CONTAINER=$(docker ps --filter "publish=5432" --filter "status=running" -q 2>/dev/null | head -1)
if [ -n "$PG_CONTAINER" ]; then
  PG_IMAGE=$(docker inspect "$PG_CONTAINER" --format='{{.Config.Image}}' 2>/dev/null)
  case "$PG_IMAGE" in
    *boardsesh-dev-db*) ;;
    *)
      echo "WARNING: A postgres container is running on port 5432 but it is not the boardsesh dev DB (expected image matching *boardsesh-dev-db*, got: $PG_IMAGE). Skipping cross-worktree fast path."
      PG_CONTAINER=""
      ;;
  esac
fi
if [ -n "$PG_CONTAINER" ]; then
  echo "Postgres already running on port 5432 (shared DB detected) — skipping container startup..."
  run_pending_drizzle_sql_migrations
  echo ""
  echo "Development database is ready (shared from another worktree)."
  echo "  Test user: test@boardsesh.com / test"
  exit 0
fi

echo "Starting development database containers..."
docker compose up -d postgres redis

# Resolve container names dynamically (derived from directory name)
PG_CONTAINER=$(docker compose ps -q postgres)

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
echo "Ensuring pg_hba.conf allows Docker network connections..."
if docker exec "$PG_CONTAINER" grep -q "host all all 0.0.0.0/0 md5" "$HBA_FILE" 2>/dev/null; then
  echo "  pg_hba.conf already has md5 rule."
else
  echo "  Adding md5 auth rule for Docker network..."
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

echo "Running database migrations..."
run_pending_drizzle_sql_migrations

echo ""
echo "Development database is ready."
echo "  Test user: test@boardsesh.com / test"
