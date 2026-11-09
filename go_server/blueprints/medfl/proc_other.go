//go:build !windows

package medfl

import "os/exec"

func hideConsoleWindow(cmd *exec.Cmd) {}
