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

PLATFORM="${LINUX_BUILDER_PLATFORM:-}"
ARCH_LABEL="${LINUX_BUILD_ARCH_LABEL:-}"

if [[ -z "$ARCH_LABEL" ]]; then
  if [[ -n "$PLATFORM" ]]; then
    ARCH_LABEL="${PLATFORM##*/}"
  else
    ARCH_LABEL="$(uname -m)"
  fi
fi

if [[ "$ENGINE" == "docker" && -n "$PLATFORM" ]]; then
  docker buildx build \
    --platform "$PLATFORM" \
    --load \
    -t "$IMAGE_NAME" \
    -f "$SCRIPT_DIR/Dockerfile" \
    "$PROJECT_ROOT"
else
  BUILD_ARGS=(-t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile")
  if [[ -n "$PLATFORM" ]]; then
    BUILD_ARGS=(--platform "$PLATFORM" "${BUILD_ARGS[@]}")
  fi
  "$ENGINE" build "${BUILD_ARGS[@]}" "$PROJECT_ROOT"
fi

USER_ID="$(id -u)"
GROUP_ID="$(id -g)"

RUN_ARGS=(run --rm -u "${USER_ID}:${GROUP_ID}" -v "$PROJECT_ROOT":/app)
RUN_ARGS+=(-e "LINUX_BUILD_ARCH_LABEL=$ARCH_LABEL")
if [[ -n "$PLATFORM" ]]; then
  RUN_ARGS+=(--platform "$PLATFORM")
  RUN_ARGS+=(-e "LINUX_BUILDER_PLATFORM=$PLATFORM")
fi

"$ENGINE" "${RUN_ARGS[@]}" "$IMAGE_NAME"
