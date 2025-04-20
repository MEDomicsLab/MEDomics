APP_PATH="build/dist/mac-arm64/MEDomicsLab.app"
NEW_APP_PATH="build/dist/MEDomicsLab.app"
PKG_PATH="build/dist/MEDomicsLab.pkg"

# Get the DEVELOPER_ID_INSTALLER from the environment variable
if [ -z "$DEVELOPER_ID_INSTALLER" ]; then
    echo "DEVELOPER_ID_INSTALLER environment variable is not set"
    exit 1
fi

# Get the version from package.json
VERSION=$(jq -r '.version' package.json)
if [ -z "$VERSION" ]; then
    echo "Version not found in package.json"
    exit 1
fi

echo "Version: $VERSION"

ZIP_PATH="build/dist/MEDomicsLab-$VERSION-macOS.zip"
APP_NAME="MEDomicsLab"

# Create the app bundle
npm run build:mac

# Create the zip file
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

# Notarize the app
xcrun notarytool submit "$ZIP_PATH" --keychain-profile "notarytool-password" --wait

# Extract the ZIP file
unzip "$ZIP_PATH" -d build/dist

# Staple the notarization ticket to the app
xcrun stapler staple "$NEW_APP_PATH"

# Remove the ZIP file
rm "$ZIP_PATH"

# Create the signed PKG file
# productbuild --sign "$DEVELOPER_ID_INSTALLER" --component "$NEW_APP_PATH" /Applications --scripts build/pkg-scripts "$PKG_PATH"

# Notarize the PKG file
xcrun notarytool submit "$PKG_PATH" --keychain-profile "notarytool-password" --wait

# Staple the notarization ticket to the PKG file
xcrun stapler staple "$PKG_PATH"
