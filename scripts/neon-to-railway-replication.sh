#!/usr/bin/env bash
set -euo pipefail

PUBLICATION_NAME="${PUBLICATION_NAME:-boardsesh_migration}"
SUBSCRIPTION_NAME="${SUBSCRIPTION_NAME:-boardsesh_neon_sub}"
CHECK_TABLES="${CHECK_TABLES:-boardsesh_ticks board_user_syncs comments votes feed_items users}"
LOAD_SCHEMA="${LOAD_SCHEMA:-true}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/neon-to-railway-replication.sh setup
  scripts/neon-to-railway-replication.sh status
  scripts/neon-to-railway-replication.sh sync-sequences
  scripts/neon-to-railway-replication.sh teardown

Environment:
  NEON_DATABASE_URL                 Neon admin/source connection string.
  RAILWAY_DATABASE_URL              Railway direct Postgres connection string.
  NEON_REPLICATION_DATABASE_URL     Required for setup. Publisher conninfo for the
                                    subscription; must use a role with REPLICATION.
  PUBLICATION_NAME                  Optional, default boardsesh_migration.
  SUBSCRIPTION_NAME                 Optional, default boardsesh_neon_sub.
  CHECK_TABLES                      Optional space-separated unqualified table names
                                    (no schema prefix) for status row counts.
  LOAD_SCHEMA                       Optional setup flag, default true. Set false if Railway
                                    schema was already prepared and target tables are empty.

Commands:
  setup
    Verifies Neon logical replication, creates Railway extensions, loads Neon
    schema only, creates/updates the Neon app-table publication, and creates
    the Railway subscription with copy_data=true. Re-run with LOAD_SCHEMA=false
    if the schema was already loaded on a previous attempt.

  status
    Shows replication status and compares row counts for CHECK_TABLES.

  sync-sequences
    Copies sequence values from Neon to Railway. Run immediately before cutover.

  teardown
    Drops the Railway subscription and Neon publication after cutover.
USAGE
}

fail() {
  echo "error: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but was not found in PATH"
}

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "$name is required"
}

require_identifier() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "$name must be a simple SQL identifier"
}

psql_neon() {
  psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
}

psql_railway() {
  psql "$RAILWAY_DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
}

publication_table_list() {
  psql_neon -At <<'SQL'
SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ' ORDER BY n.nspname, c.relname)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND c.relpersistence = 'p'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = c.oid
      AND d.deptype = 'e'
  );
SQL
}

assert_railway_target_tables_empty() {
  psql_railway <<'SQL'
DO $$
DECLARE
  rel record;
  has_rows boolean;
BEGIN
  FOR rel IN
    SELECT format('%I.%I', n.nspname, c.relname) AS relation_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND c.relpersistence = 'p'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass
          AND d.objid = c.oid
          AND d.deptype = 'e'
      )
    ORDER BY n.nspname, c.relname
  LOOP
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM ' || rel.relation_name || ')' INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION 'Railway target table % is not empty; copy_data=true requires empty target tables', rel.relation_name;
    END IF;
  END LOOP;
END
$$;
SQL
}

check_common_requirements() {
  require_env NEON_DATABASE_URL
  require_env RAILWAY_DATABASE_URL
  require_command psql
  require_identifier PUBLICATION_NAME "$PUBLICATION_NAME"
  require_identifier SUBSCRIPTION_NAME "$SUBSCRIPTION_NAME"
}

setup_replication() {
  check_common_requirements
  require_env NEON_REPLICATION_DATABASE_URL
  require_command pg_dump
  require_command pg_restore

  local publisher_conninfo="$NEON_REPLICATION_DATABASE_URL"
  local wal_level
  wal_level="$(psql_neon -Atqc 'SHOW wal_level;')"
  [[ "$wal_level" == "logical" ]] || fail "Neon wal_level is '$wal_level'; enable logical replication first"

  echo "Creating required Railway extensions..."
  if ! psql_railway <<'SQL'
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL
  then
    fail "failed to create required extensions on Railway; use a Railway Postgres image/template that includes PostGIS"
  fi

  if [[ "$LOAD_SCHEMA" == "true" ]]; then
    local dump_file
    dump_file="$(mktemp "${TMPDIR:-/tmp}/boardsesh-schema.XXXXXX.dump")"
    trap 'rm -f "$dump_file"' EXIT

    echo "Dumping Neon schema only..."
    pg_dump --schema-only --no-owner --no-acl --no-publications --no-subscriptions \
      --format=custom --file "$dump_file" "$NEON_DATABASE_URL"

    echo "Restoring schema to Railway..."
    pg_restore --schema-only --no-owner --no-acl --dbname "$RAILWAY_DATABASE_URL" "$dump_file"
  else
    echo "Skipping schema load because LOAD_SCHEMA=false."
  fi

  echo "Verifying Railway target tables are empty..."
  assert_railway_target_tables_empty

  local table_list
  table_list="$(publication_table_list)"
  [[ -n "$table_list" ]] || fail "no publishable Neon tables found"

  local pub_all_tables
  pub_all_tables="$(psql_neon -Atq -v pub_name="$PUBLICATION_NAME" -c "SELECT puballtables FROM pg_publication WHERE pubname = :'pub_name';")"
  if [[ "$pub_all_tables" == "t" ]]; then
    fail "Neon publication '$PUBLICATION_NAME' already exists as FOR ALL TABLES; drop it first so extension tables are not replicated"
  elif [[ "$pub_all_tables" == "f" ]]; then
    echo "Updating Neon publication table list..."
    psql_neon <<SQL
ALTER PUBLICATION $PUBLICATION_NAME SET TABLE $table_list;
SQL
  else
    echo "Creating Neon publication..."
    psql_neon <<SQL
CREATE PUBLICATION $PUBLICATION_NAME FOR TABLE $table_list;
SQL
  fi

  local subscription_exists
  subscription_exists="$(psql_railway -Atq -v sub_name="$SUBSCRIPTION_NAME" -c "SELECT 1 FROM pg_subscription WHERE subname = :'sub_name';")"
  if [[ "$subscription_exists" == "1" ]]; then
    echo "Railway subscription '$SUBSCRIPTION_NAME' already exists; leaving it unchanged."
  else
    echo "Creating Railway subscription with copy_data=true..."
    psql_railway -v publisher_conninfo="$publisher_conninfo" <<SQL
CREATE SUBSCRIPTION $SUBSCRIPTION_NAME
  CONNECTION :'publisher_conninfo'
  PUBLICATION $PUBLICATION_NAME
  WITH (copy_data = true, create_slot = true, enabled = true);
SQL
  fi

  echo "Setup complete. Run '$0 status' until Railway is caught up."
}

status_replication() {
  check_common_requirements

  echo "Neon publisher connections:"
  psql_neon -x -v sub_name="$SUBSCRIPTION_NAME" <<'SQL'
SELECT application_name, state, sent_lsn, write_lsn, flush_lsn, replay_lsn, sync_state
FROM pg_stat_replication
WHERE application_name = :'sub_name';
SQL

  echo
  echo "Railway subscription status:"
  psql_railway -x -v sub_name="$SUBSCRIPTION_NAME" <<'SQL'
SELECT subname, pid, received_lsn, latest_end_lsn, latest_end_time,
       now() - latest_end_time AS replication_lag
FROM pg_stat_subscription
WHERE subname = :'sub_name';
SQL

  echo
  echo "Railway table sync states:"
  psql_railway -v sub_name="$SUBSCRIPTION_NAME" <<'SQL'
SELECT srsubstate, count(*) AS table_count
FROM pg_subscription_rel
WHERE srsubid = (SELECT oid FROM pg_subscription WHERE subname = :'sub_name')
GROUP BY srsubstate
ORDER BY srsubstate;
SQL

  echo
  echo "Row count comparison:"
  for table in $CHECK_TABLES; do
    require_identifier CHECK_TABLES "$table"
    local neon_count railway_count
    neon_count="$(psql_neon -Atqc "SELECT count(*) FROM \"$table\";")"
    railway_count="$(psql_railway -Atqc "SELECT count(*) FROM \"$table\";")"
    printf '%-28s Neon=%-12s Railway=%-12s\n' "$table" "$neon_count" "$railway_count"
  done
}

sync_sequences() {
  check_common_requirements

  local sql_file
  sql_file="$(mktemp "${TMPDIR:-/tmp}/boardsesh-sequences.XXXXXX.sql")"
  trap 'rm -f "$sql_file"' EXIT

  echo "Generating sequence setval statements from Neon..."
  psql_neon -At <<'SQL' >"$sql_file"
SELECT format(
  'SELECT setval(%L, %s, %L);',
  quote_ident(s.sequence_schema) || '.' || quote_ident(s.sequence_name),
  ps.last_value,
  ps.is_called
)
FROM information_schema.sequences s
JOIN pg_sequences ps
  ON ps.schemaname = s.sequence_schema
 AND ps.sequencename = s.sequence_name
WHERE s.sequence_schema NOT IN ('pg_catalog', 'information_schema')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = format('%I.%I', s.sequence_schema, s.sequence_name)::regclass
      AND d.deptype = 'e'
  )
ORDER BY s.sequence_schema, s.sequence_name;
SQL

  echo "Applying sequence values to Railway..."
  psql_railway --file "$sql_file"
  echo "Sequence sync complete."
}

teardown_replication() {
  check_common_requirements

  echo "Dropping Railway subscription if present..."
  local subscription_exists
  subscription_exists="$(psql_railway -Atq -v sub_name="$SUBSCRIPTION_NAME" -c "SELECT 1 FROM pg_subscription WHERE subname = :'sub_name';")"
  if [[ "$subscription_exists" == "1" ]]; then
    psql_railway <<SQL
ALTER SUBSCRIPTION $SUBSCRIPTION_NAME DISABLE;
DROP SUBSCRIPTION $SUBSCRIPTION_NAME;
SQL
  else
    echo "Railway subscription '$SUBSCRIPTION_NAME' does not exist."
  fi

  echo "Dropping Neon publication if present..."
  psql_neon <<SQL
DROP PUBLICATION IF EXISTS $PUBLICATION_NAME;
SQL
}

main() {
  local command="${1:-}"
  case "$command" in
    setup)
      setup_replication
      ;;
    status)
      status_replication
      ;;
    sync-sequences)
      sync_sequences
      ;;
    teardown)
      teardown_replication
      ;;
    -h | --help | help)
      usage
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
