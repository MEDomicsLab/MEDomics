#!/usr/bin/env bash
#
# install_locally_remote_backend.sh
#
# Builds the MEDomicsLab server bundle from the local repo and installs it
# on the current machine (i.e. you are already on the server). After running
# this script you can start the server with:
#
#   ~/.medomics/medomics-server/current/start.sh
#
# Usage:
#   ./utilScripts/install_locally_remote_backend.sh \
#       [--platform linux|darwin] \
#       [--version <label>]
#
# Defaults:
#   platform = linux
#   version  = value from package.json
#
set -euo pipefail

#-----------------------------------------------------------------------
# Parse arguments
#-----------------------------------------------------------------------
PLATFORM="linux"
VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform) PLATFORM="$2"; shift 2 ;;
    --version)  VERSION="$2";  shift 2 ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "${PLATFORM}" != "linux" && "${PLATFORM}" != "darwin" ]]; then
  echo "Error: --platform must be 'linux' or 'darwin'." >&2
  exit 1
fi

#-----------------------------------------------------------------------
# Resolve repo root (script lives in utilScripts/)
#-----------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

#-----------------------------------------------------------------------
# Determine version from package.json if not supplied
#-----------------------------------------------------------------------
if [[ -z "${VERSION}" ]]; then
  VERSION="$(node -p "require('./package.json').version")"
fi
echo "==> Version: ${VERSION}"

#-----------------------------------------------------------------------
# 1) Build the server bundle locally (same as CI)
#-----------------------------------------------------------------------
echo "==> Installing npm dependencies..."
npm install

echo "==> Building server bundle for ${PLATFORM}..."
node ./tools/pack_server.js --platform="${PLATFORM}"

ZIP_NAME="MEDomicsLab-Server-${VERSION}-${PLATFORM}.zip"
ZIP_PATH="${REPO_ROOT}/build/dist/${ZIP_NAME}"

if [[ ! -f "${ZIP_PATH}" ]]; then
  echo "Error: Expected build artifact not found: ${ZIP_PATH}" >&2
  exit 1
fi
echo "==> Bundle ready: ${ZIP_PATH}"

#-----------------------------------------------------------------------
# 2) Prepare local directories
#   ~/.medomics/medomics-server/versions/<version>/
#   ~/.medomics/medomics-server/downloads/
#-----------------------------------------------------------------------
BASE_DIR="${HOME}/.medomics/medomics-server"
VERSIONS_DIR="${BASE_DIR}/versions"
VERSION_DIR="${VERSIONS_DIR}/server-v${VERSION}"
DOWNLOADS_DIR="${BASE_DIR}/downloads"

echo "==> Creating directories..."
mkdir -p "${VERSION_DIR}" "${DOWNLOADS_DIR}"

#-----------------------------------------------------------------------
# 3) Copy the zip into downloads
#-----------------------------------------------------------------------
cp "${ZIP_PATH}" "${DOWNLOADS_DIR}/${ZIP_NAME}"

#-----------------------------------------------------------------------
# 4) Extract
#-----------------------------------------------------------------------
echo "==> Extracting ${ZIP_NAME}..."
unzip -o "${DOWNLOADS_DIR}/${ZIP_NAME}" -d "${VERSION_DIR}"

#-----------------------------------------------------------------------
# 5) Locate and chmod the medomics-server binary
#-----------------------------------------------------------------------
echo "==> Locating medomics-server executable..."
EXEC_PATH="$(find "${VERSION_DIR}" -type f -name 'medomics-server' -print -quit)"
if [[ -z "${EXEC_PATH}" ]]; then
  echo "Error: medomics-server executable not found under ${VERSION_DIR}" >&2
  exit 1
fi
chmod +x "${EXEC_PATH}"
echo "    Executable: ${EXEC_PATH}"

#-----------------------------------------------------------------------
# 6) Also chmod the Go binary and start/stop scripts if present
#-----------------------------------------------------------------------
GO_BIN="$(find "${VERSION_DIR}" -type f -name 'server_go' -print -quit || true)"
if [[ -n "${GO_BIN}" ]]; then
  chmod +x "${GO_BIN}"
  echo "    Go binary:  ${GO_BIN}"
fi

START_SH="$(find "${VERSION_DIR}" -type f -name 'start.sh' -print -quit || true)"
if [[ -n "${START_SH}" ]]; then
  chmod +x "${START_SH}"
  echo "    start.sh:   ${START_SH}"
fi

STOP_SH="$(find "${VERSION_DIR}" -type f -name 'stop.sh' -print -quit || true)"
if [[ -n "${STOP_SH}" ]]; then
  chmod +x "${STOP_SH}"
  echo "    stop.sh:    ${STOP_SH}"
fi

#-----------------------------------------------------------------------
# 7) Create/update 'current' symlink
#-----------------------------------------------------------------------
CURRENT_LINK="${BASE_DIR}/current"
ln -sfn "${VERSION_DIR}" "${CURRENT_LINK}"
echo "==> Symlink ${CURRENT_LINK} -> ${VERSION_DIR}"

#-----------------------------------------------------------------------
# Done
#-----------------------------------------------------------------------
echo ""
echo "==> Installation complete!"
echo "    Executable: ${EXEC_PATH}"
echo ""
echo "    To start the server run:"
echo "      ${CURRENT_LINK}/start.sh"
