#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../.. && pwd)"
ARCH_LABEL="${LINUX_BUILD_ARCH_LABEL:-$(uname -m)}"
DIST_DIR="$PROJECT_ROOT/dist-linux/$ARCH_LABEL"
BUILD_ROOT="$PROJECT_ROOT/build-linux/$ARCH_LABEL"
VENV_DIR="$PROJECT_ROOT/.venv-linux-$ARCH_LABEL"
ENTRY_POINT="run.py"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This script must be run on Linux." >&2
  exit 1
fi

echo "==> Building XRP Wallet Manager for ${ARCH_LABEL}"

rm -rf "$BUILD_ROOT" "$VENV_DIR"
mkdir -p "$BUILD_ROOT"

python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install -r "$PROJECT_ROOT/requirements.txt" pyinstaller

pyinstaller \
  --clean \
  --noconfirm \
  --distpath "$BUILD_ROOT/dist" \
  --workpath "$BUILD_ROOT/build" \
  --specpath "$BUILD_ROOT" \
  --name "XRP-Wallet-Manager" \
  --windowed \
  --add-data "$PROJECT_ROOT/data:data" \
  "$PROJECT_ROOT/$ENTRY_POINT"

mkdir -p "$DIST_DIR"
rm -rf "$DIST_DIR/XRP-Wallet-Manager"
cp -r "$BUILD_ROOT/dist/XRP-Wallet-Manager" "$DIST_DIR/"

cat <<'LAUNCHER' > "$DIST_DIR/run.sh"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$DIR/XRP-Wallet-Manager/XRP-Wallet-Manager" "$@"
LAUNCHER
chmod +x "$DIST_DIR/run.sh"

echo "Linux build complete: $DIST_DIR"
