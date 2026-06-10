# Deploying Klaviearn

Current home: `https://klaviearn.162-243-66-225.sslip.io` on the
radiantdental VPS (162.243.66.225), as its own Docker Compose project in
`/opt/klaviearn`, behind the existing `services-nginx-1` container.

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

Host `certbot` with the webroot method; challenges go through
`/opt/services/static-site` (mounted in the nginx container at
`/var/www/static`). The renewal deploy hook
`/etc/letsencrypt/renewal-hooks/deploy/klaviearn.sh` copies the renewed cert
to `/opt/services/nginx/ssl/klaviearn.{pem,key}` and reloads the nginx
container. Renewal is automatic via the certbot systemd timer.

## Moving to a real domain later

1. Point the new domain's A record at the VPS.
2. Duplicate `nginx-klaviearn.conf` with the new `server_name`.
3. `certbot certonly --webroot -w /opt/services/static-site -d <domain>`,
   update the deploy hook paths, reload nginx.
