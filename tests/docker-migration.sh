#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

test_dir=$(mktemp -d)
pid=
cleanup() {
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -rf "$test_dir"
}
trap cleanup EXIT
trap 'exit 1' INT TERM

export NODE_ENV=test PORT=4410
export JWT_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
prisma=./node_modules/.bin/prisma

start_api() {
  curl -fsS --max-time 2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && return 1
  sh docker-entrypoint.sh > "$test_dir/start.log" 2>&1 &
  pid=$!
  attempt=0
  until curl -fsS --max-time 2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if ! kill -0 "$pid" 2>/dev/null || [ "$attempt" -ge 30 ]; then
      cat "$test_dir/start.log"
      return 1
    fi
    sleep 1
  done
  kill "$pid"
  wait "$pid" || true
  pid=
}

export DATABASE_URL="file:$test_dir/fresh.db"
start_api
"$prisma" migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code

git show v1.1.1:prisma/schema.prisma > "$test_dir/legacy.prisma"
export DATABASE_URL="file:$test_dir/legacy.db"
"$prisma" db push --schema "$test_dir/legacy.prisma" --skip-generate
node prisma/seed-currencies.js
"$prisma" db execute --url "$DATABASE_URL" --file tests/legacy-billing.sql
cp "$test_dir/legacy.db" "$test_dir/copy.db"
cp "$test_dir/legacy.db" "$test_dir/drift.db"

export DATABASE_URL="file:$test_dir/copy.db"
if sh docker-entrypoint.sh > "$test_dir/unbaselined.log" 2>&1; then
  echo "Expected startup to reject an unbaselined database" >&2
  exit 1
fi
grep -q P3005 "$test_dir/unbaselined.log"
if grep -q 'Seeding initial data' "$test_dir/unbaselined.log"; then
  echo "Startup reached seeding after a migration failure" >&2
  exit 1
fi
sh docker-entrypoint.sh baseline-v1.1.1
sh docker-entrypoint.sh baseline-v1.1.1
start_api

export DATABASE_URL="file:$test_dir/drift.db"
echo 'DROP INDEX "invoices_customer_id_idx";' | "$prisma" db execute --url "$DATABASE_URL" --stdin
if sh docker-entrypoint.sh baseline-v1.1.1 > "$test_dir/drift.log" 2>&1; then
  echo "Expected baseline to reject schema drift" >&2
  exit 1
fi
grep -q 'customer_id' "$test_dir/drift.log"

python3 - "$test_dir" <<'PY'
import pathlib
import sqlite3
import sys

root = pathlib.Path(sys.argv[1])
old, copied, drift, fresh = [sqlite3.connect(root / (name + ".db")) for name in
                             ("legacy", "copy", "drift", "fresh")]
for table in ("users", "businesses", "customers", "invoices", "invoice_items", "payments"):
    rows = old.execute(f"SELECT * FROM {table} ORDER BY id").fetchall()
    assert len(rows) == 1 and copied.execute(f"SELECT * FROM {table} ORDER BY id").fetchall() == rows, table
assert not copied.execute("PRAGMA foreign_key_check").fetchall()
history = "SELECT migration_name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name"
migrations = fresh.execute(history).fetchall()
assert migrations and copied.execute(history).fetchall() == migrations
assert drift.execute("SELECT name FROM sqlite_master WHERE name = '_prisma_migrations'").fetchone() is None
PY
echo 'Fresh startup, v1.1.1 data preservation, and migration failure checks passed.'
