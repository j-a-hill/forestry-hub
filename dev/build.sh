#!/usr/bin/env bash
#
# Build the fixture garden and fail on any plugin warning. A [plugins] line in
# the output means the loader rejected something in our manifest or a hook
# threw, which on the live site means the hub silently disappears.
#
#   dev/build.sh            build with campaign-hub enabled
#   dev/build.sh --off      build with campaign-hub disabled, to prove the
#                           site is unchanged without it
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GARDEN="$REPO_ROOT/.garden"
REGISTRY="$GARDEN/src/plugins/plugins.json"

if [ ! -d "$GARDEN" ]; then
  echo "No .garden/ yet — run dev/setup.sh first." >&2
  exit 1
fi

# Pick up whatever is in the working tree before building.
"$REPO_ROOT/dev/sync.sh"

if [ "${1:-}" = "--off" ]; then
  echo '{"plugins":{"campaign-hub":{"enabled":false}}}' > "$REGISTRY"
  echo "==> building with campaign-hub disabled"
else
  rm -f "$REGISTRY"
  echo "==> building with campaign-hub enabled"
fi

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

if ! (cd "$GARDEN" && npm run build) 2>&1 | tee "$LOG"; then
  echo "BUILD FAILED" >&2
  exit 1
fi

if grep -q "\[plugins\]" "$LOG"; then
  echo >&2
  echo "FAILED: the build logged [plugins] warnings:" >&2
  grep "\[plugins\]" "$LOG" >&2
  exit 1
fi

if grep -q "\[campaign-hub\]" "$LOG"; then
  echo >&2
  echo "FAILED: a campaign-hub filter caught an error:" >&2
  grep "\[campaign-hub\]" "$LOG" >&2
  exit 1
fi

echo "==> build clean, no plugin warnings"
