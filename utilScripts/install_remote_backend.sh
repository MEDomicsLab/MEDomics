#!/usr/bin/env bash
#
# install_remote_backend.sh
#
# Builds the MEDomicsLab server bundle from the local repo (like the CI in
# serverRelease.yml), then uploads and installs it on a remote host over SSH
# (replicating the Electron installRemoteBackend / installRemoteBackendFromURL
# IPC handlers).
#
# Usage:
#   ./utilScripts/install_remote_backend.sh \
#       --host <remote-host> \
#       [--user <ssh-user>]  \
#       [--port <ssh-port>]  \
#       [--key  <identity-file>] \
#       [--platform linux|darwin] \
#       [--version <label>]
#
# Defaults:
#   user     = $USER
#   port     = 22
#   platform = linux
#   version  = value from package.json
#
set -euo pipefail

#-----------------------------------------------------------------------
# Parse arguments
#-----------------------------------------------------------------------
REMOTE_HOST=""
REMOTE_USER="${USER}"
SSH_PORT="22"
SSH_KEY=""
PLATFORM="linux"
VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)     REMOTE_HOST="$2"; shift 2 ;;
    --user)     REMOTE_USER="$2"; shift 2 ;;
    --port)     SSH_PORT="$2";    shift 2 ;;
    --key)      SSH_KEY="$2";     shift 2 ;;
    --platform) PLATFORM="$2";    shift 2 ;;
    --version)  VERSION="$2";     shift 2 ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${REMOTE_HOST}" ]]; then
  echo "Error: --host is required." >&2
  exit 1
fi

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
# Build SSH options
#-----------------------------------------------------------------------
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -p "${SSH_PORT}")
SCP_OPTS=(-o StrictHostKeyChecking=accept-new -P "${SSH_PORT}")
if [[ -n "${SSH_KEY}" ]]; then
  SSH_OPTS+=(-i "${SSH_KEY}")
  SCP_OPTS+=(-i "${SSH_KEY}")
fi

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "$@"
}

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
# 2) Detect remote home directory
#-----------------------------------------------------------------------
echo "==> Detecting remote home directory..."
REMOTE_HOME="$(ssh_cmd 'echo $HOME')"
echo "    Remote HOME = ${REMOTE_HOME}"

#-----------------------------------------------------------------------
# 3) Prepare remote directories
#   ~/.medomics/medomics-server/versions/<version>/
#   ~/.medomics/medomics-server/downloads/
#-----------------------------------------------------------------------
BASE_DIR="${REMOTE_HOME}/.medomics/medomics-server"
VERSIONS_DIR="${BASE_DIR}/versions"
VERSION_DIR="${VERSIONS_DIR}/${VERSION}"
DOWNLOADS_DIR="${BASE_DIR}/downloads"

echo "==> Creating remote directories..."
ssh_cmd "mkdir -p '${VERSION_DIR}' '${DOWNLOADS_DIR}'"

#-----------------------------------------------------------------------
# 4) Upload the zip via scp
#-----------------------------------------------------------------------
REMOTE_ZIP="${DOWNLOADS_DIR}/${ZIP_NAME}"
echo "==> Uploading ${ZIP_NAME} to remote..."
scp "${SCP_OPTS[@]}" "${ZIP_PATH}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_ZIP}"

#-----------------------------------------------------------------------
# 5) Extract on remote
#-----------------------------------------------------------------------
echo "==> Extracting on remote..."
ssh_cmd "unzip -o '${REMOTE_ZIP}' -d '${VERSION_DIR}'"

#-----------------------------------------------------------------------
# 6) Locate and chmod the medomics-server binary
#-----------------------------------------------------------------------
echo "==> Locating medomics-server executable on remote..."
REMOTE_EXE="$(ssh_cmd "find '${VERSION_DIR}' -type f -name 'medomics-server' -print -quit")"
if [[ -z "${REMOTE_EXE}" ]]; then
  echo "Error: medomics-server executable not found under ${VERSION_DIR}" >&2
  exit 1
fi
ssh_cmd "chmod +x '${REMOTE_EXE}'"
echo "    Executable: ${REMOTE_EXE}"

#-----------------------------------------------------------------------
# 7) Also chmod the Go binary if present
#-----------------------------------------------------------------------
REMOTE_GO="$(ssh_cmd "find '${VERSION_DIR}' -type f -name 'server_go' -print -quit" || true)"
if [[ -n "${REMOTE_GO}" ]]; then
  ssh_cmd "chmod +x '${REMOTE_GO}'"
  echo "    Go binary:  ${REMOTE_GO}"
fi

#-----------------------------------------------------------------------
# 8) Create/update 'current' symlink
#-----------------------------------------------------------------------
CURRENT_LINK="${BASE_DIR}/current"
ssh_cmd "ln -sfn '${VERSION_DIR}' '${CURRENT_LINK}'"
echo "==> Symlink ${CURRENT_LINK} -> ${VERSION_DIR}"

#-----------------------------------------------------------------------
# Done
#-----------------------------------------------------------------------
echo ""
echo "==> Installation complete!"
echo "    Remote executable: ${REMOTE_EXE}"
echo "    To start the server, SSH in and run:"
echo "      cd ${VERSION_DIR} && ./start.sh"
