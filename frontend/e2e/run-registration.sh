#!/bin/sh
set -eu

db_dir=$(mktemp -d)
trap 'rm -rf "$db_dir"' EXIT
export DATABASE_URL="file:$db_dir/billku.db"
export JWT_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
./node_modules/.bin/playwright test e2e/registration.spec.ts "$@"
