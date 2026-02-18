package application

import (
	Utils "go_module/src"
	"log"
)

var prePath = "application"

// AddHandleFunc adds the specific module handle function to the server
func AddHandleFunc() {
	Utils.CreateHandleFunc(prePath+"/predict/", handlePredict)
	Utils.CreateHandleFunc(prePath+"/get_imputed_columns/", handleGetImputedColumns)
	Utils.CreateHandleFunc(prePath+"/progress/", handleProgress)
}

// handlePredict handles the request to retrieve predictions for a given input
// It returns the response from the python script
func handlePredict(jsonConfig string, id string) (string, error) {
	log.Println("Predict...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/learning/predict.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleGetImputedColumns handles the request to retrieve imputed columns for a given input
// It returns the response from the python script
func handleGetImputedColumns(jsonConfig string, id string) (string, error) {
	log.Println("GetImputedColumns...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/learning/get_optional_columns.py", id)
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
