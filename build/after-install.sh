# Create a log file
TIME=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE=/tmp/after-install-$TIME.log
echo "After install script is running" >$LOG_FILE
sudo rm /usr/share/keyrings/mongodb-server-8.0.gpg
# sudo rm /etc/apt/sources.list.d/mongodb-org-8.0.list

# Print environment variables
# echo "Environment variables :" >>$LOG_FILE
# printenv >>$LOG_FILE
# # Determine if the OS is Ubuntu or Debian
# if [ -f /etc/debian_version ]; then
#     # Debian
#     echo "Debian" >>/tmp/after-install.log
#     OS="Debian"
#     sudo apt-get install gnupg curl
#     curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
#     echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
#     sudo apt-get update >>/tmp/after-install.log
#     sudo apt-get install -y mongodb-org >>/tmp/after-install.log
# Ubuntu
echo "Ubuntu" >>$LOG_FILE
OS="Ubuntu"
VERSION=$(lsb_release -rs)

# Get the user name by searching for the user ID

echo "Version: $VERSION" >>$LOG_FILE
sudo apt-get install gnupg curl -y >>$LOG_FILE
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc |
    sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg \
        --dearmor --yes

if [ "$VERSION" = "20.04" ]; then
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
elif [ "$VERSION" = "22.04" ]; then
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
elif [ "$VERSION" = "24.04" ]; then
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
fi

echo "Sources list created" >>$LOG_FILE
# Try to update the package list, ignore errors
echo "Updating package list" >>$LOG_FILE
sudo apt-get update >>$LOG_FILE

echo "Installing MongoDB" >>$LOG_FILE
sudo apt-get install -y mongodb-org >>$LOG_FILE

# Start the MongoDB service
echo "Starting MongoDB" >>$LOG_FILE
sudo systemctl daemon-reload >>$LOG_FILE
echo "Daemon reloaded" >>$LOG_FILE

sudo systemctl start mongod >>$LOG_FILE
echo "MongoDB started" >>$LOG_FILE
