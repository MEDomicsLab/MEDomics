package src

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

type ScriptInfo struct {
	Cmd      *exec.Cmd
	Progress string
}

var Mu sync.Mutex // guards balance
var Scripts = make(map[string]ScriptInfo)

// RequestData is the data sent in the request
type RequestData struct {
	Message string `json:"message"`
}

// ResponseData is the data sent in the response
type ResponseData struct {
	Response string `json:"response_message"`
	Type     string `json:"type"`
}

// Progress is the data sent in the progress response
type Progress struct {
	Progress string
}

// CreateResponse creates the response data sent to the client side
// It returns the response data
func CreateResponse(requestData map[string]interface{}) ResponseData {
	var toParse string = ""
	if requestData["message"] != nil && strings.Contains(requestData["message"].(string), "{") {
		toParse = "toParse"
	} else {
		toParse = "notToParse"
	}
	response := ResponseData{
		Response: requestData["message"].(string),
		Type:     toParse,
	}
	return response
}

// JsonStr2map converts a json string to a map
func JsonStr2map(jsonStr string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := json.Unmarshal([]byte(jsonStr), &result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// Map2jsonStr converts a map to a json string
func Map2jsonStr(data map[string]string) (string, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	return string(jsonData), nil
}

// GetConfigFromMessage gets the config json from the message in input
func GetConfigFromMessage(w http.ResponseWriter, request []byte) (string, error) {
	data, err := JsonStr2map(string(request))
	if err != nil {
		http.Error(w, "Failed to parse JSON request body", http.StatusBadRequest)
		return "", err
	}
	return data["message"].(string), nil
}

// CreateHandleFunc creates the handle function for the server
func CreateHandleFunc(topic string, processRequest func(jsonConfig string, id string) (string, error)) {
	log.Println("Adding handle func for topic: " + topic)
	http.HandleFunc("/"+topic, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Invalid request method. Only POST is allowed.", http.StatusMethodNotAllowed)
			return
		}
		id := strings.ReplaceAll(r.URL.Path, "/"+topic, "")
		log.Printf("Go request: \"%s\"\n", r.URL.Path)
		// Read and reset the request body
		savedRequestBody, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}

		r.Body = io.NopCloser(bytes.NewBuffer(savedRequestBody))

		// Decode the request body
		jsonConfig, err := GetConfigFromMessage(w, savedRequestBody)
		if err != nil {
			http.Error(w, "Failed to parse JSON request body", http.StatusBadRequest)
			return
		}

		// Process the request on a separate thread if needed
		var wg sync.WaitGroup
		//get the value at the address of wg
		wg.Add(1)
		var processResponse string
		go func(wg *sync.WaitGroup) {
			processResponse, err = processRequest(jsonConfig, id)
			if err != nil {
				log.Println("Error processing request: " + id + ", " + err.Error())
				processResponse = "{\"error\":\"{\\\"toast\\\":\\\"" + err.Error() + "\\\", \\\"go_kill\\\":\\\"true\\\"}\"}"
			}
			defer wg.Done()
		}(&wg)
		wg.Wait()

		// Write the response
		response := CreateResponse(map[string]interface{}{
			"message": processResponse,
		})
		w.Header().Set("Content-Type", "application/json")
		encoder := json.NewEncoder(w)
		err = encoder.Encode(response)
		if err != nil {
			http.Error(w, "Failed to encode JSON response", http.StatusInternalServerError)
			return
		}

	})
}

// StartPythonScripts starts the python script
func StartPythonScripts(jsonParam string, filename string, id string) (string, error) {
	log.Println("Starting python script: " + filename)
	runMode := GetDotEnvVariable("RUN_MODE")
	if runMode == "" {
		runMode = os.Args[2]
	}
	log.Println("Run mode: " + runMode)
	cwd, err := os.Getwd()
	if err != nil {
		log.Println(err.Error())
	}
	log.Println("filename: " + filename)
	script, _ := filepath.Abs(filepath.Join(cwd, filename))
	condaEnv := os.Getenv("MED_ENV")
	Mu.Lock()
	if runMode == "prod" {
		prodDir := os.Args[3]
		filename = strings.ReplaceAll(filename, "..", "")
		script, _ = filepath.Abs(filepath.Join(prodDir, filename))
		log.Println("running script in prod: " + script)
	}
	log.Println("Conda env: " + condaEnv)

	Scripts[id] = ScriptInfo{
		Cmd:      exec.Command(condaEnv, "-u", script, "--json-param", jsonParam, "--id", id),
		Progress: "",
	}
	stdout, err := Scripts[id].Cmd.StdoutPipe()
	Mu.Unlock()
	if err != nil {
		log.Println("Error getting stdout pipe: " + err.Error())
	}
	Mu.Lock()
	stderr, err := Scripts[id].Cmd.StderrPipe()
	Mu.Unlock()
	if err != nil {
		log.Println("Error getting stderr pipe: " + err.Error())
	}
	Mu.Lock()
	err = Scripts[id].Cmd.Start()
	Mu.Unlock()
	if err != nil {
		log.Println("Error starting command " + Scripts[id].Cmd.String())
		return "", err
	}

	response := ""
	// stderrBuf collects every line from stderr so we can surface it on early
	// crashes (e.g. ModuleNotFoundError) that never reach send_response().
	var stderrBuf strings.Builder
	var stderrMu sync.Mutex

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		copyOutput(stdout, &response)
	}()
	go func() {
		defer wg.Done()
		copyOutputErr(stderr, &response, &stderrBuf, &stderrMu)
	}()
	wg.Wait()

	waitErr := Scripts[id].Cmd.Wait()

	// Happy path – the Python layer called send_response() successfully.
	if response != "" {
		log.Println("Finished running script: " + filename + " with id: " + id)
		return response, nil
	}

	// The script exited without ever emitting response-ready (early crash).
	// Build a structured error JSON that matches get_response_from_error() so
	// the frontend receives consistent error objects regardless of where in
	// Python the failure happened.
	stderrMu.Lock()
	capturedStderr := stderrBuf.String()
	stderrMu.Unlock()

	exitMsg := "unknown error"
	if waitErr != nil {
		exitMsg = waitErr.Error()
	}
	if capturedStderr == "" {
		capturedStderr = exitMsg
	}

	log.Println("Script crashed before send_response. stderr:\n" + capturedStderr)

	errorPayload := map[string]interface{}{
		"error": map[string]string{
			"message":     exitMsg,
			"stack_trace": capturedStderr,
			"value":       capturedStderr,
		},
	}
	jsonBytes, jsonErr := json.Marshal(errorPayload)
	if jsonErr != nil {
		// Last-resort fallback – should never happen.
		return "", waitErr
	}
	return string(jsonBytes), nil
}

// copyOutput handles stdout: detects response-ready and progress signals.
func copyOutput(r io.Reader, response *string) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		lineText := scanner.Text()
		if strings.Contains(lineText, "response-ready*_*") {
			path := strings.Split(lineText, "*_*")[1]
			path = path[:len(path)-1]
			*response = ReadFile(path)
			if err := os.Remove(path); err != nil {
				log.Println(err)
			}
		} else if strings.Contains(lineText, "progress*_*") {
			parts := strings.Split(lineText, "*_*")
			if len(parts) >= 3 {
				pid := parts[1]
				progress := parts[2][:len(parts[2])-1]
				log.Println("Progress: " + progress)
				Mu.Lock()
				Scripts[pid] = ScriptInfo{
					Cmd:      Scripts[pid].Cmd,
					Progress: progress,
				}
				Mu.Unlock()
			}
		}
	}
}

// copyOutputErr mirrors copyOutput for stderr.
// It still watches for response-ready/progress (some Python loggers write to
// stderr) and additionally accumulates every line into stderrBuf so early
// crashes (ImportError, SyntaxError, …) are never silently dropped.
func copyOutputErr(r io.Reader, response *string, stderrBuf *strings.Builder, mu *sync.Mutex) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		lineText := scanner.Text()
		log.Println("[stderr] " + lineText)

		// Accumulate for crash reporting.
		mu.Lock()
		stderrBuf.WriteString(lineText + "\n")
		mu.Unlock()

		// Handle structured signals even if they arrive on stderr.
		if strings.Contains(lineText, "response-ready*_*") {
			path := strings.Split(lineText, "*_*")[1]
			path = path[:len(path)-1]
			*response = ReadFile(path)
			if err := os.Remove(path); err != nil {
				log.Println(err)
			}
		} else if strings.Contains(lineText, "progress*_*") {
			parts := strings.Split(lineText, "*_*")
			if len(parts) >= 3 {
				pid := parts[1]
				progress := parts[2][:len(parts[2])-1]
				Mu.Lock()
				Scripts[pid] = ScriptInfo{
					Cmd:      Scripts[pid].Cmd,
					Progress: progress,
				}
				Mu.Unlock()
			}
		}
	}
}

// ReadFile reads a file and returns its content as a string
func ReadFile(filename string) string {
	cleanPath := strings.Trim(filename, "\" \t\n\r")
	absPath, _ := filepath.Abs(cleanPath)
	log.Println("Reading file: " + absPath)
	data, err := os.ReadFile(absPath)
	if err != nil {
		log.Panicf("failed reading data from file: %s", err)
	}
	return string(data)
}

// GetDotEnvVariable gets the variable from the .env.local file or from env variables set by client side
func GetDotEnvVariable(key string) string {
	electronKey := "ELECTRON_" + key
	if os.Getenv(electronKey) != "" {
		return os.Getenv(electronKey)
	} else {
		return os.Getenv(key)
	}
}

// RemoveIdFromScripts removes the id from the scripts
func RemoveIdFromScripts(id string) {
	Mu.Lock()
	delete(Scripts, id)
	Mu.Unlock()
}

// WriteScriptId writes the data to the script with the id
func WriteScriptId(data string, id string) error {
	Mu.Lock()
	script, ok := Scripts[id]
	if ok {
		stdin, err := script.Cmd.StdinPipe()
		if err != nil {
			return err
		}
		_, err2 := io.WriteString(stdin, data)
		if err2 != nil {
			return err2
		}
	}
	Mu.Unlock()
	return nil
}

// KillScript kills the script with the id
func KillScript(id string) bool {
	Mu.Lock()
	script, ok := Scripts[id]
	if ok {
		defer func() {
			if r := recover(); r != nil {
				log.Println("Recovered in KillScript", r)
				return
			}
		}()
		if script.Cmd != nil { // Check if script.Cmd is not nil
			if script.Cmd.Process != nil && (script.Cmd.ProcessState == nil || !script.Cmd.ProcessState.Exited()) {
				log.Println("Script is running, killing it now...")
				err := script.Cmd.Process.Kill()
				if err != nil {
					log.Print("Error killing process: ", err.Error())
				}
			} else {
				log.Println("Script process not killable")
			}
		} else {
			log.Println("script.Cmd is nil")
		}
	}
	log.Println("Killed script: ", id)
	Mu.Unlock()
	return ok
}

// HandlePanic handles the panic
func HandlePanic() {
	if r := recover(); r != nil {
		log.Println("RECOVER-------------------", r)
	}
}

// ClearAllScripts clears all the scripts
func ClearAllScripts() {
	Mu.Lock()
	for id, script := range Scripts {
		err := script.Cmd.Process.Kill()
		if err != nil {
			log.Print("Error killing process: ", err.Error())
		}
		delete(Scripts, id)
	}
	Mu.Unlock()
}
