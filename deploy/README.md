# Deploying Klaviearn

Current home: **https://klaviearn.app** (Cloudflare-proxied, SSL Full
strict; `klaviearn.com` redirects at the Cloudflare edge) on the
radiantdental VPS (162.243.66.225), as its own Docker Compose project in
`/opt/klaviearn`, behind the existing `services-nginx-1` container.
The old `klaviearn.162-243-66-225.sslip.io` hostname 301-redirects to the
domain.

## Layout on the VPS

```
/opt/klaviearn/
  Dockerfile, docker-compose.yml   (from this folder)
  .env                             KLAVIEARN_SECRET=<openssl rand -hex 32>
  server/                          backend source (rsynced)
  webdist/                         built frontend (rsynced from web/dist)
  data/klaviearn.db                SQLite, survives rebuilds
```

## Release a new version

```bash
cd web && npm run build && cd ..
rsync -az --delete server/app/ radiantdental:/opt/klaviearn/server/app/
rsync -az server/requirements.txt radiantdental:/opt/klaviearn/server/
rsync -az --delete web/dist/ radiantdental:/opt/klaviearn/webdist/
ssh radiantdental 'cd /opt/klaviearn && docker compose up -d --build'
```

(Frontend-only changes need no rebuild — the dist is bind-mounted.)

## TLS

**klaviearn.app** uses a Cloudflare Origin CA certificate (valid to 2041,
no renewal plumbing): private key generated on the VPS at
`/opt/services/nginx/ssl/klaviearn.app.key`, CSR signed via the Cloudflare
dashboard (SSL/TLS → Origin Server → "Use my private key and CSR"), cert at
`/opt/services/nginx/ssl/klaviearn.app.pem`. Cloudflare SSL mode: Full
(strict).

**The legacy sslip.io hostname** keeps a Let's Encrypt cert so its redirect
works over HTTPS: host `certbot`, webroot through `/opt/services/static-site`
(mounted in the nginx container at `/var/www/static`), renewal deploy hook
at `/etc/letsencrypt/renewal-hooks/deploy/klaviearn.sh`. Renewal is
automatic via the certbot systemd timer.
