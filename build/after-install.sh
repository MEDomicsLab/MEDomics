#!/bin/bash
# ---------------------------------------------------------------------------
# MEDomics – MongoDB post-install script (deb)
#
# Downloads the official MongoDB tarball directly from fastdl.mongodb.org
# so we no longer depend on apt repository GPG keys (which can rotate and
# break unattended installs).
#
# The mongod binary is installed to /usr/local/lib/mongodb/ and symlinked
# into /usr/local/bin/ (and /usr/bin/ as a fallback).  The Electron app
# locates it via getMongoDBPath() which checks PATH and these locations.
# ---------------------------------------------------------------------------
set -e

# ── Logging ────────────────────────────────────────────────────────────────
TIME=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE=/tmp/after-install-$TIME.log
echo "After install script is running" >"$LOG_FILE"

# ── Clean up old apt-based MongoDB repo config (from previous installs) ───
rm -f /usr/share/keyrings/mongodb-server-8.0.gpg 2>/dev/null || true
rm -f /etc/apt/sources.list.d/mongodb-org-8.0.list 2>/dev/null || true

# ── Detect OS, version, and architecture ──────────────────────────────────
if ! command -v lsb_release &>/dev/null; then
    echo "lsb_release not found – installing lsb-release..." >>"$LOG_FILE"
    apt-get install -y lsb-release >>"$LOG_FILE" 2>&1
fi

OS=$(lsb_release -si)
VERSION=$(lsb_release -rs)
ARCH=$(uname -m)   # x86_64 or aarch64

echo "OS: $OS"           >>"$LOG_FILE"
echo "Version: $VERSION" >>"$LOG_FILE"
echo "Arch: $ARCH"       >>"$LOG_FILE"

# ── Resolve the download URL ──────────────────────────────────────────────
MONGO_VERSION=""
DOWNLOAD_URL=""

if [ "$OS" = "Ubuntu" ]; then
    case "$VERSION" in
        24.04)
            MONGO_VERSION="8.0.9"
            UBUNTU_CODE="ubuntu2404"
            ;;
        22.04)
            MONGO_VERSION="7.0.15"
            UBUNTU_CODE="ubuntu2204"
            ;;
        20.04)
            MONGO_VERSION="7.0.15"
            UBUNTU_CODE="ubuntu2004"
            ;;
        *)
            echo "Unsupported Ubuntu version: $VERSION" >>"$LOG_FILE"
            # Non-fatal – the app can install MongoDB at first launch.
            exit 0
            ;;
    esac

    if [ "$ARCH" = "x86_64" ]; then
        DOWNLOAD_URL="https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-${UBUNTU_CODE}-${MONGO_VERSION}.tgz"
    elif [ "$ARCH" = "aarch64" ]; then
        DOWNLOAD_URL="https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-${UBUNTU_CODE}-${MONGO_VERSION}.tgz"
    else
        echo "Unsupported architecture: $ARCH" >>"$LOG_FILE"
        exit 0
    fi
else
    echo "Unsupported OS: $OS (expected Ubuntu)" >>"$LOG_FILE"
    exit 0
fi

echo "Download URL: $DOWNLOAD_URL" >>"$LOG_FILE"

# ── Install runtime dependencies required by the mongod binary ────────────
echo "Installing runtime dependencies..." >>"$LOG_FILE"
if apt-get install -y curl libcurl4 libssl3 >>"$LOG_FILE" 2>&1; then
    echo "Runtime dependencies installed with libssl3." >>"$LOG_FILE"
elif apt-get install -y curl libcurl4 libssl1.1 >>"$LOG_FILE" 2>&1; then
    echo "Runtime dependencies installed with libssl1.1 (fallback)." >>"$LOG_FILE"
else
    echo "WARNING: Failed to install runtime dependencies (libssl3 and libssl1.1)." >>"$LOG_FILE"
    echo "WARNING: MongoDB may fail to run due to missing SSL dependencies." >>"$LOG_FILE"
fi

# ── Download the tarball ──────────────────────────────────────────────────
TEMP_DIR=$(mktemp -d)
TARBALL="$TEMP_DIR/mongodb.tgz"

echo "Downloading MongoDB ${MONGO_VERSION}..." >>"$LOG_FILE"
if ! curl -fSL -o "$TARBALL" "$DOWNLOAD_URL" >>"$LOG_FILE" 2>&1; then
    echo "ERROR: Failed to download MongoDB tarball." >>"$LOG_FILE"
    rm -rf "$TEMP_DIR"
    # Non-fatal – the app can install MongoDB at first launch.
    exit 0
fi

# ── Extract and install ───────────────────────────────────────────────────
echo "Extracting MongoDB..." >>"$LOG_FILE"
tar -xzf "$TARBALL" -C "$TEMP_DIR" >>"$LOG_FILE" 2>&1

EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "mongodb-*" | head -1)
if [ -z "$EXTRACTED_DIR" ]; then
    echo "ERROR: Could not find extracted MongoDB directory." >>"$LOG_FILE"
    rm -rf "$TEMP_DIR"
    exit 0
fi

INSTALL_DIR="/usr/local/lib/mongodb"
echo "Installing MongoDB to $INSTALL_DIR" >>"$LOG_FILE"
rm -rf "$INSTALL_DIR"
# Also place in /usr/bin as a fallback (getMongoDBPath checks this directly).
# This can fail (e.g. read-only /usr, existing system-managed mongod, or lack
# of permissions) and is non-critical because /usr/local/bin already has the
# primary symlink and getMongoDBPath checks that before /usr/bin.
cp -r "$EXTRACTED_DIR"/* "$INSTALL_DIR/"

# Symlink the binaries so they appear on PATH
ln -sf "$INSTALL_DIR/bin/mongod" /usr/local/bin/mongod
ln -sf "$INSTALL_DIR/bin/mongos" /usr/local/bin/mongos 2>/dev/null || true
# Also place in /usr/bin as a fallback (getMongoDBPath checks this directly)
ln -sf "$INSTALL_DIR/bin/mongod" /usr/bin/mongod 2>/dev/null || true

# ── Clean up ──────────────────────────────────────────────────────────────
rm -rf "$TEMP_DIR"

# ── Verify MongoDB ─────────────────────────────────────────────────────────
if command -v mongod &>/dev/null; then
    echo "MongoDB installed successfully: $(mongod --version | head -1)" >>"$LOG_FILE"
else
    echo "WARNING: mongod not found on PATH after install." >>"$LOG_FILE"
fi

# ── Fix Electron chrome-sandbox SUID permissions ──────────────────────────
# Electron requires chrome-sandbox to be owned by root with mode 4755 (SUID).
# Without this, launching from the GNOME application menu crashes with:
#   FATAL:setuid_sandbox_host.cc - "chrome-sandbox is not configured correctly"
SANDBOX_PATH="/opt/MEDomics/chrome-sandbox"
if [ -f "$SANDBOX_PATH" ]; then
    chown root:root "$SANDBOX_PATH"
    chmod 4755 "$SANDBOX_PATH"
    echo "chrome-sandbox SUID bit set on $SANDBOX_PATH" >>"$LOG_FILE"
else
    echo "WARNING: $SANDBOX_PATH not found – sandbox permissions not set" >>"$LOG_FILE"
fi

echo "After install script completed" >>"$LOG_FILE"
