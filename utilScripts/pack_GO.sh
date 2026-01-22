cd go_server
CGO_ENABLED=0 go build main.go
cd ..
echo F | cp go_server/main renderer/public/server_go
echo F | cp go_server/main resources/server_go