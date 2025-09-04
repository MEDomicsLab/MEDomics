package extraction_image

import (
	Utils "go_module/src"
	"log"
)

var prePath = "extraction_image"

// AddHandleFunc adds the specific module handle function to the server
func AddHandleFunc() {
	Utils.CreateHandleFunc(prePath+"/initialize_DenseNet_extraction/", handleInitializeDenseNetExtraction)
	Utils.CreateHandleFunc(prePath+"/DenseNet_extraction/", handleDenseNetExtraction)
	Utils.CreateHandleFunc(prePath+"/progress/", handleProgress)
}

// handleInitializeDenseNetExtraction handles the request to run the DenseNet extraction initialization
// It returns the response from the python script
func handleInitializeDenseNetExtraction(jsonConfig string, id string) (string, error) {
	log.Println("Running Initialize DenseNet extraction", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/extraction_image/initialize_DenseNet_extraction.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleDenseNetExtraction handles the request to run a DenseNet extraction
// It returns the response from the python script
func handleDenseNetExtraction(jsonConfig string, id string) (string, error) {
	log.Println("Running DenseNet extraction", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/extraction_image/DenseNet_extraction.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleProgress handles the request to get the progress of the execution
// It returns the progress of the execution
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
