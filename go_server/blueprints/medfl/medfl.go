package medfl

import (
	Utils "go_module/src"
	"log"
    "fmt"
    "io"
    "net/http"
    "time"
)

var prePath = "medfl"

// AddHandleFunc adds the specific module handle function to the server
func AddHandleFunc() {
	Utils.CreateHandleFunc(prePath+"/hello_world/", handleHelloWorld)
	Utils.CreateHandleFunc(prePath+"/progress/", handleProgress)
	Utils.CreateHandleFunc(prePath+"/config-db/", handleConfigFlDb)
	Utils.CreateHandleFunc(prePath+"/run-pipeline/", handleRunFlPipeline)
	Utils.CreateHandleFunc(prePath+"/param-optim/", handleOptimParams)

	Utils.CreateHandleFunc(prePath+"/devices/", handleGetDevices)

}

var (
    apiKey    = "tskey-api-kWSTR44ZoH11CNTRL-47uggCMtTpKEQvtVbyjhpKdmBm9e1fpX"
    tailnet   = "taild030b7.ts.net"
)

// handleGetDevices proxies a GET to Tailscale’s devices API.
// Expects JSON: { "api_key": "...", "tailnet": "your-ts-net" }
func handleGetDevices(_ string, id string) (string, error) {
    log.Println("Fetching Tailscale devices (hard-coded)...", id)

    url := fmt.Sprintf("https://api.tailscale.com/api/v2/tailnet/%s/devices", tailnet)
    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return "", fmt.Errorf("creating request: %w", err)
    }
    req.Header.Set("Authorization", "Bearer "+apiKey)

    client := &http.Client{Timeout: 10 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        return "", fmt.Errorf("calling Tailscale API: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        bodyBytes, _ := io.ReadAll(resp.Body)
        return "", fmt.Errorf("Tailscale API error %s: %s", resp.Status, string(bodyBytes))
    }

    bodyBytes, err := io.ReadAll(resp.Body)
    if err != nil {
        return "", fmt.Errorf("reading response: %w", err)
    }
    return string(bodyBytes), nil
}

// handleStartSweetviz handles the request to run a sweetviz analysis
// It returns the response from the python script
func handleHelloWorld(jsonConfig string, id string) (string, error) {
	log.Println("Hello World MEDfl...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/hello_world_medfl.py", id)
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

// handleConfigFlDb handles the request to set the DB config of MEDfl
// It returns DB config
func handleConfigFlDb(jsonConfig string, id string) (string, error) {
	log.Println("Setting DB configuration of MEDfl...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/fl_setDB_config.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleRunFlPipeline handles the request to run the fl pipeline of MEDfl
// It returns DB config
func handleRunFlPipeline(jsonConfig string, id string) (string, error) {
	log.Println("Setting FL pipeline...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/run_fl_pipeline.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleRunFlPipeline handles the request to run the fl pipeline of MEDfl
// It returns DB config
func handleOptimParams(jsonConfig string, id string) (string, error) {
	log.Println("Setting hyperparameters optimisation...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/flParamsOptim.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}
