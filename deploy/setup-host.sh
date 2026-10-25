#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Per-host setup for the interacti admin dashboard — run once on the server, idempotent.
#
#   bash deploy/setup-host.sh [server_name]
#
# Defaults to admin.interacti.84-12-92-46.sslip.io. It creates the release tree,
# labels it for SELinux and installs the static nginx vhost. It does NOT deploy
# code — a push to main does that through deploy/release.sh.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SERVER_NAME=${1:-admin.interacti.84-12-92-46.sslip.io}
APP_DIR=${APP_DIR:-/srv/interacti-admin}
SITE=${SITE:-/etc/nginx/conf.d/interacti-admin.conf}
DEPLOY_USER=${DEPLOY_USER:-$(id -un)}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

ok()   { printf '\033[0;32m  ✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[0;33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\033[0;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$SERVER_NAME" ] || die "a server name is required"

# ── Release tree ────────────────────────────────────────────────────────────
sudo mkdir -p "${APP_DIR}/releases"
sudo chown -R "${DEPLOY_USER}" "${APP_DIR}"
ok "${APP_DIR}/releases ready for ${DEPLOY_USER}"

# ── SELinux ─────────────────────────────────────────────────────────────────
# Oracle Linux enforces SELinux, and nginx cannot read /srv without this label.
# -a adds the rule; -m updates it when a previous run already added one.
if command -v semanage >/dev/null 2>&1; then
  sudo semanage fcontext -a -t httpd_sys_content_t "${APP_DIR}(/.*)?" \
    || sudo semanage fcontext -m -t httpd_sys_content_t "${APP_DIR}(/.*)?"
  sudo restorecon -R "${APP_DIR}"
  ok "SELinux label applied to ${APP_DIR}"
else
  warn "semanage not found — skipping SELinux label (not an SELinux host?)"
fi

# ── nginx vhost ─────────────────────────────────────────────────────────────
if sudo grep -qE '^[[:space:]]*ssl_certificate[[:space:]]' "$SITE" 2>/dev/null; then
  warn "${SITE} already has TLS config from certbot — leaving it untouched"
  warn "to regenerate, move it aside first (you will need to re-run certbot)"
else
  sed "s|__SERVER_NAME__|${SERVER_NAME}|g" \
    "${HERE}/nginx/admin.conf.template" | sudo tee "$SITE" >/dev/null
  sudo chmod 644 "$SITE"
  ok "wrote ${SITE} for ${SERVER_NAME}"
fi

sudo nginx -t
sudo systemctl reload nginx
ok "nginx reloaded — ${SERVER_NAME} will answer once a release is live"
