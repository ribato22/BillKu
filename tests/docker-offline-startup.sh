#!/bin/sh
set -eu

name="billku-offline-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
trap 'exit 1' INT TERM
docker run -d --name "$name" --network none -e DATABASE_URL=file:/app/data/billku.db \
  -e PORT=4000 -e JWT_SECRET="$(openssl rand -hex 32)" "$1" >/dev/null

attempt=0
until docker exec "$name" node -e 'fetch("http://127.0.0.1:4000/health").then(r => { if (!r.ok) process.exitCode = 1 }).catch(() => { process.exitCode = 1 })' 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ] || [ "$(docker inspect -f '{{.State.Running}}' "$name")" != true ]; then
    docker logs "$name"
    exit 1
  fi
  sleep 1
done
echo 'BillKu started from an empty SQLite database without network access.'
