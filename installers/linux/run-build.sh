#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
IMAGE_NAME="xrp-wallet-linux-builder"
DIST_DEST="$PROJECT_ROOT/dist-linux"

mkdir -p "$DIST_DEST"

ENGINE=""
if command -v docker >/dev/null 2>&1; then
  ENGINE="docker"
elif command -v podman >/dev/null 2>&1; then
  ENGINE="podman"
else
  echo "Neither docker nor podman is installed." >&2
  exit 1
fi

"$ENGINE" build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile" "$PROJECT_ROOT"

"$ENGINE" run --rm -v "$PROJECT_ROOT":/app "$IMAGE_NAME"
