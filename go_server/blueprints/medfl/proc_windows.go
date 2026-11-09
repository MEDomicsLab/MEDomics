//go:build windows

package medfl

import (
	"os/exec"
	"syscall"
)

// hideConsoleWindow keeps a command started by the server from opening a console window
func hideConsoleWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
