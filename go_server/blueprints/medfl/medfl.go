package medfl

import (
	Utils "go_module/src"
	"log"
    "fmt"
    "io"
    "net/http"
    "time"
	"net/smtp"
	"strings"
	"encoding/json"
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
	Utils.CreateHandleFunc(prePath+"/send-mail/", SendMail)

	// real world 
	Utils.CreateHandleFunc(prePath+"/rw/run-server/", handleRunServer)
	Utils.CreateHandleFunc(prePath+"/rw/stop-server/", handleStopServer)

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

type EmailAttachment struct {
      FileContentBase64 string `json:"fileContentBase64"`
      Filename         string `json:"filename"`
	  Subject		  string `json:"subject"`
	  Body			  string `json:"body"`
	  Recipients              []string `json:"recipients"`
}

func SendMail(jsonConfig string, id string) (string, error) {
	log.Println("Sending email with attachment...", jsonConfig)
	var attachment EmailAttachment
	jsonerr := json.Unmarshal([]byte(jsonConfig), &attachment)
	log.Println("Attachment", attachment)
	if jsonerr != nil {
		fmt.Println("Error decoding JSON:", jsonerr)
		return "", jsonerr
	}

	from := "ouael2019esi@gmail.com"
	password := "ajzz hzcv itib ffur" // App password

	to := attachment.Recipients
	subject := attachment.Subject
	body := attachment.Body

	smtpHost := "smtp.gmail.com"
	smtpPort := "587"

	// -- MIME HEADERS
	header := make(map[string]string)
	header["From"] = from
	header["To"] = to[0]
	header["Subject"] = subject
	header["MIME-Version"] = "1.0"
	header["Content-Type"] = `multipart/mixed; boundary="MIXEDBOUNDARY"`

	var msg strings.Builder
	for k, v := range header {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}

	// -- PLAIN TEXT PART
	msg.WriteString("\r\n--MIXEDBOUNDARY\r\n")
	msg.WriteString("Content-Type: text/plain; charset=\"utf-8\"\r\n\r\n")
	msg.WriteString(body + "\r\n")

	// -- ATTACHMENT PART
	msg.WriteString("\r\n--MIXEDBOUNDARY\r\n")
	msg.WriteString("Content-Type: application/octet-stream\r\n")
	msg.WriteString("Content-Transfer-Encoding: base64\r\n")
	msg.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=\"%s\"\r\n\r\n", attachment.Filename))
	log.Println("Attachment filename:", attachment.Filename)
	log.Println("Attachment content length:", len(attachment.FileContentBase64))

	// Split base64 content into lines of 76 chars (MIME rule)
	for i := 0; i < len(attachment.FileContentBase64); i += 76 {
		end := i + 76
		if end > len(attachment.FileContentBase64) {
			end = len(attachment.FileContentBase64)
		}
		msg.WriteString(attachment.FileContentBase64[i:end] + "\r\n")
	}

	msg.WriteString("--MIXEDBOUNDARY--")

	// -- AUTH & SEND
	auth := smtp.PlainAuth("", from, password, smtpHost)
	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, from, to, []byte(msg.String()))
	if err != nil {
		log.Println("Failed to send email:", err)
		return "", err
	}

	log.Println("Email sent successfully with attachment.")
	return "Email sent", nil
}

// real world
func handleRunServer(jsonConfig string, id string) (string, error) {
	log.Println("Running central server...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/runServer.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}
func handleStopServer(jsonConfig string, id string) (string, error) {
	log.Println("Stopping central server...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/stopServer.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}