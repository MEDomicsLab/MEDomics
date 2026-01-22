cd go_server
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o main main.go
cd ..
echo F | cp -p go_server/main renderer/public/server_go
echo F | cp -p go_server/main go_executables/server_go
chmod +x go_executables/server_go
