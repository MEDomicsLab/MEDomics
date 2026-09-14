#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -d "libmongocrypt/.git" ]; then
	echo "Using existing libmongocrypt repository"
else
	git clone --branch node-v6.0.1 https://github.com/mongodb/libmongocrypt.git
fi

cd libmongocrypt

# Build libmongocrypt node bindings
cd bindings/node

# Upstream's build-static.sh hardcodes -DENABLE_MORE_WARNINGS_AS_ERRORS=ON (it
# overwrites CMAKE_FLAGS, so the env var cannot be used to override it). Newer
# Apple clang then fails libmongocrypt's own test target on
# -Wgnu-folding-constant. We link against the library, not its tests, so turn
# the warnings-as-errors escalation off. Uses -i.bak for BSD/macOS sed
# compatibility, and is a no-op if the clone was already patched.
sed -i.bak 's/-DENABLE_MORE_WARNINGS_AS_ERRORS=ON/-DENABLE_MORE_WARNINGS_AS_ERRORS=OFF/' ./etc/build-static.sh
rm -f ./etc/build-static.sh.bak

bash ./etc/build-static.sh

npm run rebuild

cd ../../..
# Copy and overwrite the existing node bindings
# Remove everything in the node_modules/mongodb-client-encryption directory
rm -rf node_modules/mongodb-client-encryption/*
cp -R libmongocrypt/bindings/node/ node_modules/mongodb-client-encryption
