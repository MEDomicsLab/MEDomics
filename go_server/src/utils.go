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

	// UNCOMMENT TO WRITE JSON PARAM TO FILE FOR DEBUGGING
	// jsonParamBytes := []byte(jsonParam)
	// err = os.WriteFile("jsonParam.txt", jsonParamBytes, 0644)
	// if err != nil {
	// 	log.Println("Error writing jsonParam to file")
	// 	return "", err
	// }
	
	Scripts[id] = ScriptInfo{
		Cmd:      exec.Command(condaEnv, "-u", script, "--json-param", jsonParam, "--id", id),
		Progress: "",
	}
	stdout, err := Scripts[id].Cmd.StdoutPipe()
	Mu.Unlock()
	if err != nil {
		log.Println("Error getting stdout pipe")
		log.Println(err.Error())
	}
	Mu.Lock()
	stderr, err := Scripts[id].Cmd.StderrPipe()
	Mu.Unlock()
	if err != nil {
		log.Println("Error getting stderr pipe")
		log.Println(err.Error())
	}
	Mu.Lock()
	err = Scripts[id].Cmd.Start()
	Mu.Unlock()
	if err != nil {
		log.Println("Error starting command " + script)
		return "", err
	}
	response := ""
	go copyOutput(stdout, &response)
	go copyOutput(stderr, &response)
	err = Scripts[id].Cmd.Wait()
	if err != nil {
		log.Println("Error waiting for command to finish")
		return "", err
	}
	log.Println("Finished running script: " + filename + " with id: " + id)
	return response, nil
}

// It is used to transfer stdout and stderr to the terminal
func copyOutput(r io.Reader, response *string) {
	scanner := bufio.NewScanner(r)
	lineText := ""
	for scanner.Scan() {
		lineText = scanner.Text()
		if strings.Contains(lineText, "response-ready*_*") {
			path := strings.Split(lineText, "*_*")[1]
			path = path[:len(path)-1]
			*response = ReadFile(path)
			//	delete this file
			err := os.Remove(path)
			if err != nil {
				log.Println(err)
			}
		} else if strings.Contains(lineText, "progress*_*") {
			id := strings.Split(lineText, "*_*")[1]
			progress := strings.Split(lineText, "*_*")[2]
			progress = progress[:len(progress)-1]
			log.Println("Progress: " + progress)
			Mu.Lock()
			Scripts[id] = ScriptInfo{
				Cmd:      Scripts[id].Cmd,
				Progress: progress,
			}
			Mu.Unlock()
		} else {
			log.Println(lineText)
			*response = lineText
		}
	}
}

// ReadFile reads a file and returns its content as a string
func ReadFile(filename string) string {
	absPath, _ := filepath.Abs(filename)
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
			if script.Cmd.ProcessState != nil && script.Cmd.ProcessState.Exited() {
				log.Println("Script can be killed")
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
