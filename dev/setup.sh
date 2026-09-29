#!/usr/bin/env bash
#
# Clone the Digital Garden template into .garden/, wire this plugin into it,
# and copy the fixture notes in. Safe to re-run: it updates in place.
#
#   dev/setup.sh              normal run
#   dev/setup.sh --hexmap     also clone the sibling hexcrawl-map plugin, to
#                             test the map card with real data
#   dev/setup.sh --its        write a .env that loads ITS Theme in its
#                             wotc-beyond palette, which is what the live
#                             site uses
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GARDEN="$REPO_ROOT/.garden"
TEMPLATE="https://github.com/oleeskild/digitalgarden.git"
HEXMAP="https://github.com/j-a-hill/forestry-hexmap.git"

if [ ! -d "$GARDEN/.git" ]; then
  echo "==> cloning the garden template into .garden/"
  git clone --depth 1 "$TEMPLATE" "$GARDEN"
fi

echo "==> installing template dependencies"
(cd "$GARDEN" && npm install --no-audit --no-fund)

echo "==> copying campaign-hub into the garden"
"$REPO_ROOT/dev/sync.sh"

if [ "${1:-}" = "--its" ]; then
  echo "==> configuring the garden to load ITS Theme (wotc-beyond)"
  cat > "$GARDEN/.env" <<'ENV'
BASE_THEME=light
THEME=https://raw.githubusercontent.com/slrvb/Obsidian--ITS-Theme/main/theme.css
STYLE_SETTINGS_BODY_CLASSES=wotc-beyond
dgHomeLink=true
dgShowBacklinks=true
dgShowInlineTitle=true
dgShowFileTree=true
dgEnableSearch=true
dgShowToc=true
dgShowTags=true
ENV
else
  # get-theme.js only clears a cached theme when THEME is set, so a stale one
  # from a previous --its run would otherwise stay compiled into the site.
  rm -f "$GARDEN/.env" "$GARDEN"/src/site/styles/_theme.*.css
fi

if [ "${1:-}" = "--hexmap" ]; then
  echo "==> cloning hexcrawl-map alongside it"
  rm -rf "$GARDEN/src/plugins/hexcrawl-map"
  git clone --depth 1 "$HEXMAP" "$GARDEN/src/plugins/hexcrawl-map"
fi

echo "==> copying fixture notes"
# Clear previous fixtures but leave the template's own notes.11tydata.js and
# notes.json in place — the build needs both.
find "$GARDEN/src/site/notes" -name '*.md' -delete
find "$GARDEN/src/site/notes" -mindepth 1 -type d -empty -delete
cp -R "$REPO_ROOT/dev/fixtures/notes/." "$GARDEN/src/site/notes/"

echo "==> ready. dev/build.sh to build, dev/shot.mjs to screenshot."
