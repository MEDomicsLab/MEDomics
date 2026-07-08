package extraction_text

import (
	Utils "go_module/src"
	"log"
)

var prePath = "extraction_text"

// AddHandleFunc adds the specific module handle function to the server
func AddHandleFunc() {
	Utils.CreateHandleFunc(prePath+"/BioBERT_extraction/", handleBioBERTExtraction)
	Utils.CreateHandleFunc(prePath+"/TransformerText_extraction/", handleTransformerExtraction)
	Utils.CreateHandleFunc(prePath+"/progress/", handleProgress)
	Utils.CreateHandleFunc(prePath+"/check_models_downloaded/", handleCheckModelsDownloaded)
}

// handleBioBERTExtraction handles the request to run a BioBERT extraction
// It returns the response from the python script
func handleBioBERTExtraction(jsonConfig string, id string) (string, error) {
	log.Println("Running BioBERT extraction", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/extraction_text/BioBERT_extraction.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleTransformerExtraction handles the request to run generic Transformer text extraction
// It returns the response from the python script
func handleTransformerExtraction(jsonConfig string, id string) (string, error) {
	log.Println("Running Transformer text extraction", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/extraction_text/text_feature_extraction.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleCheckModelsDownloaded handles the request to check which predefined text
// models are already present in the local HuggingFace cache.
// It returns the response from the python script
func handleCheckModelsDownloaded(jsonConfig string, id string) (string, error) {
	log.Println("Checking downloaded text models", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/extraction_text/check_models_downloaded.py", id)
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
