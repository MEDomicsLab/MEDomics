#!/bin/bash

# Request sudo privileges if not already root
if [ "$EUID" -ne 0 ]; then
    echo "This script requires elevated privileges to delete protected files."
    echo "You will be prompted for your password."
    # Get the absolute path of the script
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
    sudo "$SCRIPT_PATH" "$@"
    exit $?
fi

echo "This script will perform a hard reset of the MEDomics installation on your Mac. It will remove the application, associated files, and settings. Please ensure you have backed up any important data before proceeding."

rm -rf /Applications/MEDomics.app
rm -rf ~/Library/Application\ Support/medomics-platform
rm -rf ~/Library/Preferences/com.medomics.medapp.plist

# .medomics folder
rm -rf ~/.medomics