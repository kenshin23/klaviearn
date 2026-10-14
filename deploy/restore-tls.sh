#!/usr/bin/env bash
# Put the klaviearn.app nginx server block back and reload.
#
# This exists because it has already gone wrong once: on 2026-06-26 the
# Klaviearn server blocks were lost from /opt/services/nginx/conf.d/, nginx
# served its old in-memory config until it restarted weeks later, and then
# klaviearn.app started falling through to the radiantdental default block.
# The origin answered with the wrong certificate, and Cloudflare Full
# (strict) turned that into a blanket 526. Nothing alerted; the site was
# simply down.
#
# Safe to re-run. Additive only - klaviearn.app is claimed by nothing else on
# this host - the reload is gated on `nginx -t`, and a failed test removes
# exactly what this run added and reloads nothing. The reload is a SIGHUP, so
# the other sites on this nginx keep serving.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST=radiantdental
ORIGIN=162.243.66.225

echo "==> staging the config on the host"
scp "$REPO/deploy/nginx-klaviearn-app.conf" "$HOST:/tmp/"

echo "==> installing behind nginx -t"
ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/services/nginx/conf.d

added=""
if [ -e nginx-klaviearn-app.conf ]; then
  echo "    nginx-klaviearn-app.conf already present - leaving it as it is"
else
  cp /tmp/nginx-klaviearn-app.conf ./nginx-klaviearn-app.conf
  added=nginx-klaviearn-app.conf
  echo "    installed nginx-klaviearn-app.conf"
fi

echo "==> nginx -t"
if docker exec services-nginx-1 nginx -t; then
  echo "==> config is valid; reloading"
  docker exec services-nginx-1 nginx -s reload
  echo "==> reloaded"
else
  echo "!! config test FAILED - reverting this run; nginx untouched" >&2
  [ -n "$added" ] && rm -f "$added"
  exit 1
fi

rm -f /tmp/nginx-klaviearn-app.conf
REMOTE

echo
echo "==> verifying from the outside"
sleep 2
curl -sS -o /dev/null -w '    https://klaviearn.app/      -> HTTP %{http_code}\n' https://klaviearn.app/ || true
curl -sS -o /dev/null -w '    https://www.klaviearn.app/  -> HTTP %{http_code}\n' https://www.klaviearn.app/ || true

echo
echo "==> certificate the origin presents for klaviearn.app"
echo | openssl s_client -connect "$ORIGIN:443" -servername klaviearn.app 2>/dev/null \
  | openssl x509 -noout -subject -dates

echo
echo "Want: HTTP 200, and a CloudFlare Origin Certificate rather than"
echo "radiantdental.app. A 526 means the origin is still presenting the"
echo "wrong cert; anything else is the app itself, not TLS."
