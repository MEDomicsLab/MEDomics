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
    echo "lsb_release not found – will fallback to /etc/os-release." >>"$LOG_FILE"
fi

if command -v lsb_release &>/dev/null; then
    OS=$(lsb_release -si)
    VERSION=$(lsb_release -rs)
elif [ -r /etc/os-release ]; then
    . /etc/os-release
    OS="$NAME"
    VERSION="$VERSION_ID"
else
    echo "ERROR: Unable to detect OS version (lsb_release missing and /etc/os-release unavailable)." >>"$LOG_FILE"
    exit 0
fi

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

# ── Check required runtime tools/libraries (installed via deb Depends) ─────
if ! command -v curl &>/dev/null; then
    echo "WARNING: curl is missing. Ensure package dependencies are installed (apt install -f)." >>"$LOG_FILE"
    # Non-fatal – app can install MongoDB later if needed.
    exit 0
fi

if command -v ldconfig &>/dev/null; then
    if ldconfig -p 2>/dev/null | grep -q "libssl.so.3"; then
        echo "Detected OpenSSL runtime: libssl.so.3" >>"$LOG_FILE"
    elif ldconfig -p 2>/dev/null | grep -q "libssl.so.1.1"; then
        echo "Detected OpenSSL runtime: libssl.so.1.1" >>"$LOG_FILE"
    else
        echo "WARNING: Neither libssl.so.3 nor libssl.so.1.1 detected. mongod may fail to start." >>"$LOG_FILE"
    fi
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

# ── Verify tarball checksum when checksum file is available ───────────────
if command -v sha256sum &>/dev/null; then
    TARBALL_NAME=$(basename "$DOWNLOAD_URL")
    SHA256_FILE="$TEMP_DIR/mongodb.sha256"
    SHA256_URL_1="${DOWNLOAD_URL}.sha256"
    SHA256_URL_2="${DOWNLOAD_URL}.sha256sum"

    if curl -fSL -o "$SHA256_FILE" "$SHA256_URL_1" >>"$LOG_FILE" 2>&1 || \
       curl -fSL -o "$SHA256_FILE" "$SHA256_URL_2" >>"$LOG_FILE" 2>&1; then
        EXPECTED_SHA256=$(awk '{print $1; exit}' "$SHA256_FILE")

        if echo "$EXPECTED_SHA256" | grep -Eq '^[a-fA-F0-9]{64}$'; then
            ACTUAL_SHA256=$(sha256sum "$TARBALL" | awk '{print $1}')
            if [ "$ACTUAL_SHA256" = "$EXPECTED_SHA256" ]; then
                echo "Checksum verified for $TARBALL_NAME" >>"$LOG_FILE"
            else
                echo "ERROR: Checksum mismatch for $TARBALL_NAME" >>"$LOG_FILE"
                echo "Expected: $EXPECTED_SHA256" >>"$LOG_FILE"
                echo "Actual:   $ACTUAL_SHA256" >>"$LOG_FILE"
                rm -rf "$TEMP_DIR"
                # Non-fatal to package install; skip MongoDB bootstrap.
                exit 0
            fi
        else
            echo "WARNING: Invalid checksum format from MongoDB checksum file; skipping verification." >>"$LOG_FILE"
        fi
    else
        echo "WARNING: MongoDB checksum file not available; skipping checksum verification." >>"$LOG_FILE"
    fi
else
    echo "WARNING: sha256sum not available; skipping checksum verification." >>"$LOG_FILE"
fi

# ── Extract and install ───────────────────────────────────────────────────
echo "Extracting MongoDB..." >>"$LOG_FILE"
if ! tar -xzf "$TARBALL" -C "$TEMP_DIR" >>"$LOG_FILE" 2>&1; then
    echo "ERROR: Failed to extract MongoDB tarball." >>"$LOG_FILE"
    rm -rf "$TEMP_DIR"
    # Non-fatal – the app can install MongoDB at first launch.
    exit 0
fi

EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "mongodb-*" | head -1)
if [ -z "$EXTRACTED_DIR" ]; then
    echo "ERROR: Could not find extracted MongoDB directory." >>"$LOG_FILE"
    rm -rf "$TEMP_DIR"
    exit 0
fi

INSTALL_DIR="/usr/local/lib/mongodb"
echo "Installing MongoDB to $INSTALL_DIR" >>"$LOG_FILE"
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Also place in /usr/bin as a fallback (getMongoDBPath checks this directly).
# This can fail (e.g. read-only /usr, existing system-managed mongod, or lack
# of permissions) and is non-critical because /usr/local/bin already has the
# primary symlink and getMongoDBPath checks that before /usr/bin.
if ! cp -r "$EXTRACTED_DIR"/* "$INSTALL_DIR/" >>"$LOG_FILE" 2>&1; then
    echo "ERROR: Failed to copy MongoDB files into $INSTALL_DIR." >>"$LOG_FILE"
    rm -rf "$TEMP_DIR"
    # Non-fatal – the app can install MongoDB at first launch.
    exit 0
fi

# Symlink the binaries so they appear on PATH
if ! ln -sf "$INSTALL_DIR/bin/mongod" /usr/local/bin/mongod >>"$LOG_FILE" 2>&1; then
    echo "WARNING: Failed to symlink mongod into /usr/local/bin." >>"$LOG_FILE"
fi
ln -sf "$INSTALL_DIR/bin/mongos" /usr/local/bin/mongos 2>/dev/null || true
# Also place in /usr/bin as a fallback (getMongoDBPath checks this directly)
ln -sf "$INSTALL_DIR/bin/mongod" /usr/bin/mongod 2>/dev/null || true

# ── Clean up ──────────────────────────────────────────────────────────────
rm -rf "$TEMP_DIR"

# ── Verify MongoDB ─────────────────────────────────────────────────────────
if command -v mongod &>/dev/null; then
    MONGOD_PATH=$(command -v mongod)
    if MONGOD_VERSION=$($MONGOD_PATH --version 2>/dev/null | head -1); then
        echo "MongoDB installed successfully: $MONGOD_VERSION" >>"$LOG_FILE"
    else
        echo "WARNING: mongod found at $MONGOD_PATH but --version failed (possible missing runtime libs)." >>"$LOG_FILE"
    fi
else
    echo "WARNING: mongod not found on PATH after install." >>"$LOG_FILE"
fi

# ── Fix Electron chrome-sandbox SUID permissions ──────────────────────────
# Electron requires chrome-sandbox to be owned by root with mode 4755 (SUID).
# Without this, launching from the GNOME application menu crashes with:
#   FATAL:setuid_sandbox_host.cc - "chrome-sandbox is not configured correctly"
SANDBOX_PATH="/opt/MEDomics/chrome-sandbox"
if [ -f "$SANDBOX_PATH" ]; then
    if chown root:root "$SANDBOX_PATH" >>"$LOG_FILE" 2>&1 && chmod 4755 "$SANDBOX_PATH" >>"$LOG_FILE" 2>&1; then
        echo "chrome-sandbox SUID bit set on $SANDBOX_PATH" >>"$LOG_FILE"
    else
        echo "WARNING: Failed to set chrome-sandbox owner/mode on $SANDBOX_PATH" >>"$LOG_FILE"
    fi
else
    echo "WARNING: $SANDBOX_PATH not found – sandbox permissions not set" >>"$LOG_FILE"
fi

echo "After install script completed" >>"$LOG_FILE"
