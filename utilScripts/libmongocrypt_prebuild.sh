git clone --branch node-v6.0.1 https://github.com/mongodb/libmongocrypt.git
cd libmongocrypt

# Build libmongocrypt node bindings
cd bindings/node

bash ./etc/build-static.sh

npm run rebuild

cd ../../..
# Copy and overwrite the existing node bindings
# Remove everything in the node_modules/mongodb-client-encryption directory
rm -rf node_modules/mongodb-client-encryption/*
cp -R libmongocrypt/bindings/node/ node_modules/mongodb-client-encryption
