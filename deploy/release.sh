#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Point the interacti admin at a new release. Run on the server, as the deploy user:
#
#   bash /srv/interacti-admin/release.sh <sha>
#
# The directory /srv/interacti-admin/releases/<sha> must already be uploaded.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SHA=${1:?usage: release.sh <sha>}
APP_DIR=${APP_DIR:-/srv/interacti-admin}
RELEASES="${APP_DIR}/releases"
TARGET="${RELEASES}/${SHA}"
LIVE="${APP_DIR}/current"

[ -d "$TARGET" ] || { echo "✗ ${TARGET} does not exist — upload it before releasing" >&2; exit 1; }

# ── Switch the symlink atomically ───────────────────────────────────────────
# Build the new link beside the old one, then rename it over the top: a reader
# sees either the old release or the new one, never a missing current.
cd "$APP_DIR"
ln -sfn "releases/${SHA}" current.tmp
mv -T current.tmp current
[ "$(readlink -f "$LIVE")" = "$(readlink -f "$TARGET")" ] || {
  echo "✗ current does not point at ${TARGET}" >&2
  exit 1
}
echo "✓ current -> releases/${SHA}"

# ── SELinux ─────────────────────────────────────────────────────────────────
if command -v restorecon >/dev/null 2>&1; then
  restorecon -R "$TARGET"
  echo "✓ SELinux label refreshed"
fi

# ── Keep the live release and the two newest others ─────────────────────────
live=$(readlink -f "$LIVE")
kept=0
for dir in $(ls -1dt "$RELEASES"/*/ 2>/dev/null); do
  dir=${dir%/}
  [ "$(readlink -f "$dir")" = "$live" ] && continue
  if [ "$kept" -lt 2 ]; then
    kept=$((kept + 1))
    continue
  fi
  echo "removing old release $dir"
  rm -rf "$dir"
done
