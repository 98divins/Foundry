#!/usr/bin/env bash
# Access-rule tests on a local PostgreSQL. Loads a stand-in for Supabase, every file in supabase/,
# then supabase/tests/rls.sql. Uses the server given by PGHOST/PGUSER/PGPASSWORD (as in CI), or
# starts a throwaway one when PostgreSQL is installed locally.
set -euo pipefail
cd "$(dirname "$0")/.."

# Same order as the files are meant to be run in Supabase.
FILES=(schema social realtime gear activity feedback shared_meals community_foods security guards stats_bounds community_limits shared_meals_author admin adoption admin_reports)

cleanup() { :; }
trap 'cleanup' EXIT
if [ -z "${PGHOST:-}" ]; then
  BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
  [ -n "$BIN" ] || { echo "No PostgreSQL found: set PGHOST or install PostgreSQL."; exit 1; }
  DIR=$(mktemp -d)
  as() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
  [ "$(id -u)" = 0 ] && chown postgres "$DIR"
  as "$BIN/initdb -D $DIR/data -A trust -U postgres" >/dev/null
  as "$BIN/pg_ctl -D $DIR/data -o \"-p 5498 -k $DIR -c listen_addresses=''\" -l $DIR/log -w start" >/dev/null
  cleanup() { as "$BIN/pg_ctl -D $DIR/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR"; }
  export PGHOST=$DIR PGPORT=5498 PGUSER=postgres
fi

DB=foundry_rls
psql -X -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
P=(psql -X -q -t -A -v ON_ERROR_STOP=1 -d "$DB")
"${P[@]}" -f supabase/tests/00_supabase_stub.sql >/dev/null
for f in "${FILES[@]}"; do
  if ! "${P[@]}" -f "supabase/$f.sql" >/dev/null 2>"/tmp/rls-load-$$.log"; then
    echo "Loading supabase/$f.sql failed:"; cat "/tmp/rls-load-$$.log"; rm -f "/tmp/rls-load-$$.log"; exit 1
  fi
done
rm -f "/tmp/rls-load-$$.log"
"${P[@]}" -f supabase/tests/rls.sql 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //' | grep -v '^$'
exit "${PIPESTATUS[0]}"
