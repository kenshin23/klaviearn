# Deploying Klaviearn

Current home: **https://klaviearn.app** (Cloudflare-proxied, SSL Full
strict) on the radiantdental VPS (162.243.66.225), as its own Docker Compose
project in `/opt/klaviearn`, behind the existing `services-nginx-1`
container.

`klaviearn.com` is **not** currently wired to the app: it resolves to AWS
Global Accelerator addresses and answers on neither port 80 nor 443. Either
point it at Cloudflare and redirect it at the edge, or let it lapse.

The old `klaviearn.162-243-66-225.sslip.io` hostname is **retired** — see
"Retiring the sslip.io hostname" below for the leftovers to clear.

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
deploy/release.sh
```

Runs `make check` first and refuses to ship if anything fails, backs the live
database up through SQLite's backup API, rsyncs `server/app/`,
`requirements.txt` and `web/dist/`, rebuilds, and verifies over HTTPS from
outside. Prints its own rollback commands at the end.

`--build` is not optional: the Dockerfile `COPY`s `server/app` into the
image, so a restart alone keeps serving the old code. The frontend is
bind-mounted, so frontend-only changes take effect without a rebuild.

### Schema changes

There is no migration tool. `server/app/main.py` runs
`Base.metadata.create_all` — which creates missing *tables* but never adds a
*column* to an existing one — followed by a short list of idempotent
`ALTER TABLE` statements for columns added since. **A new column means a new
line in that list**, or production breaks on the first query touching it
while every test still passes against a freshly created database. Alembic
when the schema stops churning.

## TLS

**klaviearn.app** uses a Cloudflare Origin CA certificate (valid to 2041, no
renewal plumbing): private key generated on the VPS at
`/opt/services/nginx/ssl/klaviearn.app.key`, CSR signed via the Cloudflare
dashboard (SSL/TLS → Origin Server → "Use my private key and CSR"), cert at
`/opt/services/nginx/ssl/klaviearn.app.pem`. Cloudflare SSL mode: Full
(strict).

`nginx-klaviearn-app.conf` belongs in `/opt/services/nginx/conf.d/` on the
VPS. To (re)install it and reload safely:

```bash
deploy/restore-tls.sh
```

### If the site returns 526

Cloudflare 526 is "I could not validate the origin's certificate", and it is
almost always this server block having gone missing: nginx falls through to
the radiantdental default block, presents `radiantdental.app`'s certificate
for `klaviearn.app`, and Full (strict) rejects it. Confirm with

```bash
echo | openssl s_client -connect 162.243.66.225:443 -servername klaviearn.app 2>/dev/null \
  | openssl x509 -noout -subject
```

If that names radiantdental, run `deploy/restore-tls.sh`. Note that nginx
keeps serving its last-loaded config, so the config can disappear weeks
before the symptom does — the breakage dates from the next nginx restart,
not from when the file was lost.

## Retiring the sslip.io hostname

The hostname is gone from this repo. Its Let's Encrypt certificate expired on
2026-09-08 (renewal had nowhere to answer once the server block carrying the
ACME webroot was lost), and requests to it now fall through to the
radiantdental default block. Leftovers on the VPS, to clear by hand:

```bash
sudo certbot delete --cert-name klaviearn.162-243-66-225.sslip.io
sudo rm -f /etc/letsencrypt/renewal-hooks/deploy/klaviearn.sh
sudo rm -f /opt/services/nginx/ssl/klaviearn.pem /opt/services/nginx/ssl/klaviearn.key
```

Removing the renewal config is the point: without it, certbot's timer keeps
failing on a hostname nobody wants.
