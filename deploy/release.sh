#!/usr/bin/env bash
# Ship the current checkout to production.
#
# The release used to be five commands pasted out of the README, which is
# part of why a four-month-old build sat in production unnoticed. This is
# the same five commands with the things that actually matter attached:
# the suite has to pass, the database gets a real backup first, and the
# result is verified from outside rather than assumed.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST=radiantdental

cd "$REPO"

# node and npm are usually lazy nvm shell functions, which a script cannot
# see, so resolve the version in .nvmrc to a real bin directory.
if ! command -v npm >/dev/null 2>&1; then
  want="$(tr -dc '0-9.' < .nvmrc 2>/dev/null || true)"
  cand="$(ls -d "$HOME/.nvm/versions/node/v${want}"*/bin 2>/dev/null | sort -V | tail -1)"
  if [ -z "$cand" ]; then
    echo "!! npm is not on PATH and no nvm node v${want:-?} is installed" >&2
    exit 1
  fi
  export PATH="$cand:$PATH"
  echo "==> using node from $cand"
fi

echo "==> nothing ships unless lint and the whole suite are green"
make check

echo
echo "==> building the production bundle"
npm --prefix web run build

# SQLite's backup API rather than cp: the app is live, and copying a running
# database file can catch it mid-write.
STAMP=$(date +%F-%H%M)
echo
echo "==> backing the live database up to klaviearn.db.bak-$STAMP"
ssh "$HOST" "docker exec klaviearn python -c \"
import sqlite3
src = sqlite3.connect('/data/klaviearn.db')
dst = sqlite3.connect('/data/klaviearn.db.bak-$STAMP')
with dst:
    src.backup(dst)
print('    ok')
\""

echo
echo "==> syncing server code"
rsync -az --delete server/app/ "$HOST:/opt/klaviearn/server/app/"
rsync -az server/requirements.txt "$HOST:/opt/klaviearn/server/"

echo
echo "==> syncing the built frontend"
rsync -az --delete web/dist/ "$HOST:/opt/klaviearn/webdist/"

# --build is required, not optional: the Dockerfile COPYs server/app into the
# image, so a plain restart would keep serving the old code.
echo
echo "==> rebuilding and restarting the container"
ssh "$HOST" 'cd /opt/klaviearn && docker compose up -d --build'

echo
echo "==> verifying"
sleep 6
ssh "$HOST" 'docker ps --filter name=klaviearn --format "    {{.Names}}  {{.Status}}"'
curl -sS -o /dev/null -w '    https://klaviearn.app/          -> HTTP %{http_code}\n' https://klaviearn.app/ || true
curl -sS -o /dev/null -w '    https://klaviearn.app/api/tree  -> HTTP %{http_code}\n' https://klaviearn.app/api/tree || true

echo
echo "Rollback:"
echo "  ssh $HOST 'cp /opt/klaviearn/data/klaviearn.db.bak-$STAMP /opt/klaviearn/data/klaviearn.db'"
echo "  git checkout <previous commit> && deploy/release.sh"
