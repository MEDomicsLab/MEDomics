package connection

import (
	Utils "go_module/src"
	"log"
)

var prePath = "connection"

// AddHandleFunc adds the specific module handle function to the server
func AddHandleFunc() {
	Utils.CreateHandleFunc(prePath+"/register_ssh_key/", registerSSHKey)
	Utils.CreateHandleFunc(prePath+"/connection_test_request/", connectionTestRequest)
}

// validateSSHKey checks if the key is valid and saves it locally to the server
// Returns the status of the validation
func registerSSHKey(jsonConfig string, id string) (string, error) {
	log.Println("Registering SSH Key: ", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/connection/register_ssh_key.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleProgress handles the request to get the progress of the experiment
// It returns the progress of the experiment
func connectionTestRequest(jsonConfig string, id string) (string, error) {
	log.Println("Connection test request: ", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/connection/connection_test_request.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}
