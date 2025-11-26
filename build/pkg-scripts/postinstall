#!/bin/bash
# Install MongoDB Community Edition on MacOS
# https://docs.mongodb.com/manual/tutorial/install-mongodb-on-os-x/
# Create a log file
LOG_FILE=/tmp/medomics_postinstall.log

# Default MEDomics configuration directory
MEDOMICS_DIR=~/.medomics

# Name of the requirements file
REQUIREMENTS_FILE=merged_requirements.txt

# Function to locate the MEDomics installation path
find_medomics_path() {
    if [ -d "/Applications/MEDomics.app" ]; then
        echo "/Applications/MEDomics.app"
    elif [ -d "$HOME/Applications/MEDomics.app" ]; then
        echo "$HOME/Applications/MEDomics.app"
    else
        echo ""
    fi
}

# Locate MEDomics installation path
MEDOMICS_PATH=$(find_medomics_path)

if [ -z "$MEDOMICS_PATH" ]; then
    echo "MEDomics installation not found." >>$LOG_FILE
    echo "Postinstall script failed: MEDomics not installed." >>$LOG_FILE
    # exit 1
    # Debugging purposes : Get all the paths in Applications directory
    echo "Debug: Listing all applications in /Applications" >>$LOG_FILE
    ls -l /Applications >>$LOG_FILE
    # Getting the requirements file from the git repository : https://raw.githubusercontent.com/MEDomicsLab/MEDomics/refs/heads/dev_autoupdater/pythonEnv/merged_requirements.txt
    echo "Debug: Downloading requirements file from GitHub" >>$LOG_FILE
    curl -fsSL https://raw.githubusercontent.com/MEDomicsLab/MEDomics/refs/heads/dev_autoupdater/pythonEnv/merged_requirements.txt -o "$HOME/Downloads/$REQUIREMENTS_FILE" >>$LOG_FILE 2>&1
    echo "Debug: Requirements file downloaded to $HOME/Downloads/$REQUIREMENTS_FILE" >>$LOG_FILE
    REQUIREMENTS_FULL_PATH="$HOME/Downloads/$REQUIREMENTS_FILE"
else
    # Construct the full requirements path
    REQUIREMENTS_FULL_PATH="$MEDOMICS_PATH/Contents/Resources/pythonEnv/$REQUIREMENTS_FILE"

fi

echo "Checking if $REQUIREMENTS_FULL_PATH exists" >>$LOG_FILE
if [ -f "$REQUIREMENTS_FULL_PATH" ]; then
    echo "Found requirements file at $REQUIREMENTS_FULL_PATH" >>$LOG_FILE

    # Check if pip3 exists in the specified directory
    if [ -f "$MEDOMICS_DIR/python/bin/pip3" ]; then
        echo "Installing requirements from $REQUIREMENTS_FULL_PATH" >>$LOG_FILE
        $MEDOMICS_DIR/python/bin/pip3 install -r "$REQUIREMENTS_FULL_PATH" >>$LOG_FILE 2>&1
        if [ $? -eq 0 ]; then
            echo "Requirements installed successfully." >>$LOG_FILE
        else
            echo "Failed to install requirements." >>$LOG_FILE
        fi
    else
        echo "pip3 not found in $MEDOMICS_DIR/python/bin" >>$LOG_FILE
    fi
else
    echo "Requirements file $REQUIREMENTS_FULL_PATH not found." >>$LOG_FILE
fi

echo "Postinstall script completed" >>$LOG_FILE

exit 0
