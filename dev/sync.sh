#!/usr/bin/env bash
#
# Copy the plugin into the fixture garden.
#
# Not a symlink: the loader lists src/plugins with withFileTypes and keeps
# only entries where isDirectory() is true, which is false for a symlink. A
# symlinked plugin is silently never discovered.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$REPO_ROOT/.garden/src/plugins/campaign-hub"

rm -rf "$TARGET"
mkdir -p "$TARGET"

# Everything except the working directories, mirroring what the Obsidian
# installer copies out of the GitHub repo.
tar -C "$REPO_ROOT" \
  --exclude=.git --exclude=.github --exclude=.garden \
  --exclude=node_modules --exclude=dev/screenshots \
  -cf - . | tar -C "$TARGET" -xf -
