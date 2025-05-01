parent_folder=$(dirname "$0")

cd go_server
go build main.go
cd ..
echo "Go server built successfully."
