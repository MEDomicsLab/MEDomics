#!/bin/bash
# Install MongoDB Community Edition on MacOS
# https://docs.mongodb.com/manual/tutorial/install-mongodb-on-os-x/
# Create a log file
LOG_FILE=/tmp/medomics_preinstall.log

xcode-select --install

MEDOMICS_DIR=~/.medomics
echo "Creating directory $MEDOMICS_DIR" >>$LOG_FILE
if [ ! -d "$MEDOMICS_DIR" ]; then
    mkdir $MEDOMICS_DIR
    echo "Directory $MEDOMICS_DIR created" >>$LOG_FILE
fi

echo "Checking if Homebrew is installed..." >>$LOG_FILE
test $(which brew) >>$LOG_FILE
# Check if Homebrew is installed
if test $(which brew); then
    echo "Installing Homebrew..." >>$LOG_FILE
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
fi

# installing mongodb without homebrew
# https://fastdl.mongodb.org/osx/mongodb-macos-arm64-7.0.15.tgz
# https://fastdl.mongodb.org/osx/mongodb-macos-x86_64-7.0.15.tgz

if [ "$(uname -m)" == "arm64" ]; then
    echo "Downloading MongoDB for arm64" >>$LOG_FILE
    MONGODB_URL=https://fastdl.mongodb.org/osx/mongodb-macos-arm64-7.0.15.tgz
    MONGODB_FILE=mongodb-macos-arm64-7.0.15.tgz
else
    echo "Downloading MongoDB for x86_64" >>$LOG_FILE
    MONGODB_URL=https://fastdl.mongodb.org/osx/mongodb-macos-x86_64-7.0.15.tgz
    MONGODB_FILE=mongodb-macos-x86_64-7.0.15.tgz
fi

/bin/bash -c "$(curl -fsSLO $MONGODB_URL)" >>$LOG_FILE
echo "MongoDB downloaded" >>$LOG_FILE
tar -xvf $MONGODB_FILE -C $MEDOMICS_DIR >>$LOG_FILE
mv $MEDOMICS_DIR/mongodb-macos-* $MEDOMICS_DIR/mongodb >>$LOG_FILE
echo "MongoDB installed in $MEDOMICS_DIR" >>$LOG_FILE
rm $MONGODB_FILE >>$LOG_FILE

# echo "Checking if MongoDB is installed..." >>$LOG_FILE
# test $(which mongod) >>$LOG_FILE
# # Check if MongoDB is installed
# if test $(which mongod); then
#     echo "MongoDB is already installed" >>$LOG_FILE
# else
#     echo "Installing MongoDB..." >>$LOG_FILE
#     # Tap the MongoDB Homebrew Tap
#     brew tap mongodb/brew
#     brew install mongodb-community@7.0
#     echo "MongoDB installed" >>$LOG_FILE
# fi

if [ "$(uname -m)" == "arm64" ]; then
    echo "Downloading Python for arm64" >>$LOG_FILE
    PYTHON_URL=https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.9.18+20240224-aarch64-apple-darwin-install_only.tar.gz
    PYTHON_FILE=cpython-3.9.18+20240224-aarch64-apple-darwin-install_only.tar.gz
else
    echo "Downloading Python for x86_64" >>$LOG_FILE
    PYTHON_URL=https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.9.18+20240224-x86_64-apple-darwin-install_only.tar.gz
    PYTHON_FILE=cpython-3.9.18+20240224-x86_64-apple-darwin-install_only.tar.gz
fi

/bin/bash -c "$(curl -fsSLO $PYTHON_URL)" >>$LOG_FILE
echo "Python downloaded" >>$LOG_FILE
tar -xvf $PYTHON_FILE -C $MEDOMICS_DIR >>$LOG_FILE
echo "Python installed in $MEDOMICS_DIR" >>$LOG_FILE
rm $PYTHON_FILE >>$LOG_FILE

# Upgrade pip
echo "Upgrading pip" >>$LOG_FILE
if [ -f "$MEDOMICS_DIR/python/bin/pip3" ]; then
    $MEDOMICS_DIR/python/bin/pip3 install --upgrade pip >>$LOG_FILE
fi

echo "Preinstall script completed" >>$LOG_FILE

exit 0
