parent_folder=$(dirname "$0")

cd go_server
CGO_ENABLED=0 go build main.go
cd ..
echo "Go server built successfully."
