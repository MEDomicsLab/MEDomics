package superset

import (
	Utils "go_module/src"
	"log"
)

var prePath = "superset"

// AddHandleFunc adds the specific module handle function to the server
func AddHandleFunc() {
	Utils.CreateHandleFunc(prePath+"/launch/", handleLaunch)
	Utils.CreateHandleFunc(prePath+"/create_user/", handleCreateUser)
	Utils.CreateHandleFunc(prePath+"/progress/", handleProgress)
}

// handleStartSweetviz handles the request to run a sweetviz analysis
// It returns the response from the python script
func handleLaunch(jsonConfig string, id string) (string, error) {
	log.Println("launching superset...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/superset/launch.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleCreateUser handles the request to create a user in superset
// It returns the response from the python script
func handleCreateUser(jsonConfig string, id string) (string, error) {
	log.Println("creating user in superset...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/superset/create_user.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleProgress handles the request to get the progress of the experiment
// It returns the progress of the experiment
func handleProgress(jsonConfig string, id string) (string, error) {
	Utils.Mu.Lock()
	progress := Utils.Scripts[id].Progress
	Utils.Mu.Unlock()
	if progress != "" {
		return progress, nil
	} else {
		return "{\"now\":\"0\", \"currentLabel\":\"Warming up\"}", nil
	}
}
