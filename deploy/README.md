# Deploying the interacti admin

Host: `opc@84.12.92.46`, Oracle Linux 9, the same host as the landing. The dashboard is
static: nginx serves `/srv/interacti-admin/current` directly, with no Node process,
database or PM2 app. Hostname: `admin.interacti.84-12-92-46.sslip.io`, a subdomain of
the landing's, until the landing gets a real domain.

## Required repository secrets

| Secret | Purpose |
|---|---|
| `SSH_HOST` | The host's address, `84.12.92.46` |
| `SSH_USER` | The ssh user, `opc` |
| `SSH_KEY` | The deploy private key, the whole file including header and footer |

These are the same values the landing and the other products use. The workflow reads
nothing else: no repository variables, and no product origin, because those are committed
in `.env.production`. Missing secrets are reported before the build starts. Never commit
a key.

## First-time setup

Once per host, on the server, from a checkout of this repo:

```bash
bash deploy/setup-host.sh
# or, for a different hostname:
bash deploy/setup-host.sh admin.example.com
```

It is idempotent. It creates `/srv/interacti-admin/releases`, gives it to the deploy
user, applies the SELinux label nginx needs to read `/srv`, renders
`/etc/nginx/conf.d/interacti-admin.conf` from `deploy/nginx/admin.conf.template`, and
reloads nginx.

The script refuses to overwrite an installed vhost that already contains
`ssl_certificate`, because certbot edits that file in place. To change a TLS-bearing
vhost, edit the template, move the installed copy aside, re-run setup, then re-run
certbot.

## The certificate (required)

The dashboard refuses to sign in on a page that is not https, so the subdomain needs its
certificate before first use. Point an A record at `84.12.92.46` (sslip.io names resolve
by themselves) and wait for it to resolve, then:

```bash
sudo certbot --nginx -d admin.interacti.84-12-92-46.sslip.io
```

certbot writes its TLS server block and HTTP to HTTPS redirect into the installed vhost.

Certbot counts failed validations against a 5-per-hour limit. Prove DNS, public port 80
and the nginx plugin with a dry run first:

```bash
sudo certbot certonly --nginx --dry-run \
  --register-unsafely-without-email --agree-tos --non-interactive \
  -d admin.interacti.84-12-92-46.sslip.io
```

Confirm renewal is armed:

```bash
systemctl status certbot-renew.timer
sudo certbot renew --dry-run
```

## Deploying

Push to `main`, or run **Deploy interacti admin** from the Actions tab. The workflow:

1. verifies the three secrets;
2. installs dependencies with `yarn install --frozen-lockfile`, then runs `yarn test` and
   `yarn build` on Node 24;
3. uploads `dist/` to `/srv/interacti-admin/releases/<sha>` and `release.sh` to
   `/srv/interacti-admin/release.sh`;
4. runs `release.sh`, which atomically points `/srv/interacti-admin/current` at the new
   release.

Files are uploaded before the symlink moves, so a failed test, build or upload leaves the
live dashboard untouched. `release.sh` keeps the live release plus the two newest others
and never deletes the one `current` points at.

## Switching on each product

A product answers every `/api/admin` request with 404 until it is switched on, so do this
only after the admin API has shipped to that product. In that product's server
environment:

1. Set `ADMIN_API_TOKEN` to a random secret of at least 32 characters
   (`openssl rand -base64 32`). Use the same value in every product, so one sign-in
   covers all of them. Rotating it means changing the environment in each product and
   restarting.
2. Set `ADMIN_ORIGIN` to `https://admin.interacti.84-12-92-46.sslip.io`. It must match
   the dashboard's origin exactly.
3. Restart the product, then sign in to the dashboard with the token.

If a product rejects the token it shows "Token rejected" and the others keep working. A
product whose origin is empty in `.env.production` (Fluid, for now) shows as not switched
on; set its `VITE_API_*` value and deploy to enable it.

## Rolling back by hand

```bash
ls -1dt /srv/interacti-admin/releases/*/        # newest first
ln -sfn /srv/interacti-admin/releases/<sha> /srv/interacti-admin/current.tmp
mv -T /srv/interacti-admin/current.tmp /srv/interacti-admin/current
```

No service restart is needed; nginx resolves the symlink per request.

## Checking the host

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://admin.interacti.84-12-92-46.sslip.io/
ls -l /srv/interacti-admin/current
```
