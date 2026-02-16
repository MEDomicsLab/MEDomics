#!/bin/bash
# This script performs a hard reset of the MEDomics platform on Ubuntu by removing the application, its data, and configuration files. Use with caution.

# Make sure the script is run with root privileges
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script with sudo or as root."
    exit 1
fi

apt remove medomics-platform --purge
apt autoremove --purge -y
rm -rf /opt/MEDomics
rm -rf ~/.medomics
rm -rf /usr/local/lib/mongodb
rm -f /usr/local/bin/mongod
rm -f /usr/local/bin/mongos
rm -f /usr/bin/mongod
rm -f /usr/share/keyrings/mongodb-server-8.0.gpg
rm -f /etc/apt/sources.list.d/mongodb-org-8.0.list

