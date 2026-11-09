package medfl

import (
	"encoding/json"
	"fmt"
	Utils "go_module/src"
	"log"
	"net/http"
	"net/smtp"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// --------------------------------------------------------
// Config / Globals
// --------------------------------------------------------

var prePath = "medfl"

// WS control base (mounted alongside your Utils routes)
var wsBase = "/" + prePath + "/rw/ws"

// --------------------------------------------------------
// Public: Register handlers
// --------------------------------------------------------

// AddHandleFunc adds the specific module handle function to the server
func AddHandleFunc() {
	// Existing MEDfl routes
	Utils.CreateHandleFunc(prePath+"/hello_world/", handleHelloWorld)
	Utils.CreateHandleFunc(prePath+"/progress/", handleProgress)
	Utils.CreateHandleFunc(prePath+"/config-db/", handleConfigFlDb)
	Utils.CreateHandleFunc(prePath+"/run-pipeline/", handleRunFlPipeline)
	Utils.CreateHandleFunc(prePath+"/param-optim/", handleOptimParams)

	// Tailscale (tailscale.go): only the app on this computer may read the tailnet and create join keys
	addLocalHandleFunc(prePath+"/devices/", handleGetDevices)
	addLocalHandleFunc(prePath+"/tailscale/status/", handleTailscaleStatus)
	addLocalHandleFunc(prePath+"/tailscale/test/", handleTailscaleTest)
	addLocalHandleFunc(prePath+"/tailscale/auth-key/", handleCreateAuthKey)
	addLocalHandleFunc(prePath+"/tailscale/client-script/", handleClientScript)
	// the setup script of a client site downloads the agent over the tailnet
	http.HandleFunc("/"+prePath+"/agent/"+agentFileName, handleAgentDownload)

	Utils.CreateHandleFunc(prePath+"/send-mail/", SendMail)

	// Real world
	Utils.CreateHandleFunc(prePath+"/rw/run-server/", handleRunServer)
	Utils.CreateHandleFunc(prePath+"/rw/stop-server/", handleStopServer)

	Utils.CreateHandleFunc(prePath+"/rw/run-xgb-server/", handleRunXGBServer)

	Utils.CreateHandleFunc(prePath+"/machine-specs/", handleMachineSpecs)

	// Realtime orchestrator (control endpoints using Utils pattern)
	// POST /medfl/rw/ws/agents/                    -> handleWsAgents (returns list)
	// POST /medfl/rw/ws/run/<AGENT_ID>             -> handleWsRun (forwards RUN_CLIENT)
	Utils.CreateHandleFunc(prePath+"/rw/ws/agents/", handleWsAgents)
	Utils.CreateHandleFunc(prePath+"/rw/ws/run/", handleWsRun)

	Utils.CreateHandleFunc(prePath+"/rw/ws/stats/", handleWsStats)

	Utils.CreateHandleFunc(prePath+"/rw/ws/logs/", handleWsLogs)
	Utils.CreateHandleFunc(prePath+"/rw/ws/check-ids/", handleWsCheckIDs)

	Utils.CreateHandleFunc(prePath+"/read-pkl/", handleReadPklModel)
	Utils.CreateHandleFunc(prePath+"/read-pth/", handleReadPthModel)

	// WebSocket upgrade endpoint (must be GET/Upgrade; cannot use CreateHandleFunc)
	addRealtimeOrchestratorRoutes()
}

// --------------------------------------------------------
// WebSocket Orchestrator
// --------------------------------------------------------

type Agent struct {
	ID string
	mu sync.Mutex
	ws *websocket.Conn
}

type Hub struct {
	mu     sync.RWMutex
	agents map[string]*Agent
}

func NewHub() *Hub                     { return &Hub{agents: map[string]*Agent{}} }
func (h *Hub) Set(id string, a *Agent) { h.mu.Lock(); h.agents[id] = a; h.mu.Unlock() }
func (h *Hub) Get(id string) (*Agent, bool) {
	h.mu.RLock()
	a, ok := h.agents[id]
	h.mu.RUnlock()
	return a, ok
}
func (h *Hub) List() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]string, 0, len(h.agents))
	for id := range h.agents {
		out = append(out, id)
	}
	return out
}

var wsHub = NewHub()
var up = websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}

// --------------------------------------------------------
// Request Manager for async responses
// --------------------------------------------------------

type pendingReq struct {
	ch   chan string
	done chan struct{}
}

var reqMgr = struct {
	sync.Mutex
	reqs map[string]*pendingReq
}{reqs: make(map[string]*pendingReq)}

func addPending(rid string) *pendingReq {
	pr := &pendingReq{
		ch:   make(chan string, 1),
		done: make(chan struct{}),
	}
	reqMgr.Lock()
	reqMgr.reqs[rid] = pr
	reqMgr.Unlock()
	return pr
}

func resolvePending(rid, data string) {
	reqMgr.Lock()
	if pr, ok := reqMgr.reqs[rid]; ok {
		pr.ch <- data
		close(pr.done)
		delete(reqMgr.reqs, rid)
	}
	reqMgr.Unlock()
}

// --------------------------------------------------------
// WebSocket setup
// --------------------------------------------------------

func addRealtimeOrchestratorRoutes() {
	http.HandleFunc(wsBase+"/agent", func(w http.ResponseWriter, r *http.Request) {
		// agents connect from the tailnet (or from this computer)
		if !isLocalOrTailnetRequest(r) {
			log.Printf("Refused agent connection from %s: not a Tailscale address (set MEDFL_ALLOW_ANY_NETWORK=1 to accept any network)", r.RemoteAddr)
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		ws, err := up.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		defer ws.Close()

		var id string
		for {
			var m struct {
				Type  string          `json:"type"`
				ID    string          `json:"id,omitempty"`
				Token string          `json:"token,omitempty"`
				RID   string          `json:"rid,omitempty"`
				Args  json.RawMessage `json:"args,omitempty"`
			}
			if err := ws.ReadJSON(&m); err != nil {
				log.Printf("agent disconnected (%s): %v", id, err)
				if id != "" {
					wsHub.mu.Lock()
					if cur, ok := wsHub.agents[id]; ok && cur.ws == ws {
						delete(wsHub.agents, id)
					}
					wsHub.mu.Unlock()
				}
				return
			}

			switch m.Type {
			case "HELLO":
				if m.ID == "" {
					m.ID = "unknown-agent"
				}
				// agents set up by a client script send the study token; agents started by hand may send none
				if m.Token != "" {
					expected, err := agentToken()
					if err != nil || m.Token != expected {
						log.Printf("Refused agent %s from %s: wrong study token", m.ID, r.RemoteAddr)
						_ = ws.WriteJSON(map[string]string{"type": "HELLO_REJECTED", "error": "wrong study token: run the setup script generated by this coordinator again"})
						return
					}
				} else {
					log.Printf("Agent %s connected without a study token (started by hand)", m.ID)
				}
				id = m.ID
				wsHub.Set(id, &Agent{ID: id, ws: ws})
				log.Printf("HELLO from %s (%s)", id, r.RemoteAddr)

			case "STATS_RESULT":
				resolvePending(m.RID, string(m.Args))
			case "LOG_RESULT":
				// <- THIS was missing; unblock handleWsLogs
				resolvePending(m.RID, string(m.Args))
			case "CHECK_IDS_RESULT":
				resolvePending(m.RID, string(m.Args))

			case "CLIENT_STATUS":
				// optional: just log it
				log.Printf("CLIENT_STATUS from %s: %s", id, string(m.Args))

			}

		}
	})
	log.Printf("WS endpoint mounted: %s/agent (WebSocket)", wsBase)
}

// --------------------------------------------------------
// Handlers
// --------------------------------------------------------

func handleWsAgents(_ string, _ string) (string, error) {
	b, err := json.Marshal(wsHub.List())
	if err != nil {
		return "", err
	}
	return string(b), nil
}

type runReq struct {
	ServerAddr string `json:"ServerAddr"`
	DP         string `json:"DP"`
	ID         string `json:"id"`
	ModelType  string `json:"model_type"`
	// Optional holdout file name in the agent data folder (federated holdout test)
	HoldoutFile string `json:"holdout_file"`
}

func handleWsRun(jsonConfig string, id string) (string, error) {
	agent := ""
	var payload runReq

	log.Printf("handleWsRun: received jsonConfig=%s id=%s\n", jsonConfig, id)

	if err := json.Unmarshal([]byte(jsonConfig), &payload); err == nil && payload.ID != "" {
		agent = payload.ID
	}

	if agent == "" {
		return "", fmt.Errorf("missing agent id in path")
	}

	ag, ok := wsHub.Get(agent)
	if !ok {
		return "", fmt.Errorf("agent %q not found", agent)
	}

	modelType := strings.TrimSpace(payload.ModelType)

	// Backward compatibility: existing NN behavior
	if modelType == "" {
		modelType = "nn"
	}

	modelType = strings.ToLower(modelType)

	if modelType != "nn" && modelType != "xgboost" {
		return "", fmt.Errorf("unsupported model_type %q", modelType)
	}

	args := map[string]any{
		"server_addr": withCoordinatorHost(payload.ServerAddr),
		"dp":          payload.DP,
		"force":       true,
		"model_type":  modelType,
	}
	// The agent keeps only the file name and looks for it in its data folder
	if holdoutFile := strings.TrimSpace(payload.HoldoutFile); holdoutFile != "" {
		args["holdout_file"] = holdoutFile
	}

	cmd := map[string]any{
		"type": "RUN_CLIENT",
		"args": args,
	}

	ag.mu.Lock()
	err := ag.ws.WriteJSON(cmd)
	ag.mu.Unlock()

	if err != nil {
		return "", fmt.Errorf("write to agent %q failed: %w", agent, err)
	}

	return fmt.Sprintf(
		`{"status":"sent","agent":"%s","model_type":"%s"}`,
		agent,
		modelType,
	), nil
}

// handleWsCheckIDs forwards a CHECK_IDS request to a connected agent and waits for CHECK_IDS_RESULT.
// Payload JSON:
//
//	{
//	  "id": "agent-id",
//	  "column": "PatientID",
//	  "ids": ["A12","B77","C09","X999"]   // also accepts a single comma-separated string
//	}
func handleWsCheckIDs(jsonConfig string, _ string) (string, error) {
	// Parse payload
	var payload struct {
		ID     string        `json:"id"`
		Column string        `json:"column"`
		IDs    []interface{} `json:"ids"` // accept any, we’ll coerce to []string
	}

	if err := json.Unmarshal([]byte(jsonConfig), &payload); err != nil {
		return "", fmt.Errorf("invalid payload: %w", err)
	}
	if payload.ID == "" {
		return "", fmt.Errorf("invalid payload: missing agent id (id)")
	}
	if strings.TrimSpace(payload.Column) == "" {
		return "", fmt.Errorf("invalid payload: missing column")
	}

	// Coerce IDs to []string; also support a single comma-separated string
	ids := make([]string, 0, len(payload.IDs))
	if len(payload.IDs) == 0 {
		// try to see if the raw JSON had: "ids":"a,b,c"
		var raw map[string]json.RawMessage
		if err := json.Unmarshal([]byte(jsonConfig), &raw); err == nil {
			if v, ok := raw["ids"]; ok {
				var s string
				if err2 := json.Unmarshal(v, &s); err2 == nil && strings.TrimSpace(s) != "" {
					for _, t := range strings.Split(s, ",") {
						t = strings.TrimSpace(t)
						if t != "" {
							ids = append(ids, t)
						}
					}
				}
			}
		}
	}
	if len(ids) == 0 {
		for _, v := range payload.IDs {
			switch t := v.(type) {
			case string:
				s := strings.TrimSpace(t)
				if s != "" {
					ids = append(ids, s)
				}
			case float64:
				// JSON numbers arrive as float64; stringify without .0 if integer
				if t == float64(int64(t)) {
					ids = append(ids, fmt.Sprintf("%d", int64(t)))
				} else {
					ids = append(ids, fmt.Sprintf("%v", t))
				}
			case bool:
				ids = append(ids, fmt.Sprintf("%v", t))
			default:
				b, _ := json.Marshal(t)
				if len(b) > 0 {
					ids = append(ids, string(b))
				}
			}
		}
	}
	if len(ids) == 0 {
		return "", fmt.Errorf("invalid payload: empty ids")
	}

	// Find agent
	ag, ok := wsHub.Get(payload.ID)
	if !ok {
		return "", fmt.Errorf("agent %q not found", payload.ID)
	}

	// Prepare request/await response
	rid := fmt.Sprintf("req-%d", time.Now().UnixNano())
	pr := addPending(rid)

	cmd := map[string]any{
		"type": "CHECK_IDS",
		"rid":  rid,
		"args": map[string]any{
			"column": payload.Column,
			"ids":    ids,
		},
	}

	ag.mu.Lock()
	err := ag.ws.WriteJSON(cmd)
	ag.mu.Unlock()
	if err != nil {
		return "", fmt.Errorf("write to agent %q failed: %w", payload.ID, err)
	}

	select {
	case res := <-pr.ch:
		// res is exactly the agent's args JSON (present_ids/missing_ids/exists_all/...)
		return res, nil
	case <-time.After(10 * time.Second):
		return "", fmt.Errorf("timeout waiting for CHECK_IDS_RESULT from agent %q", payload.ID)
	}
}

// NEW: Request dataset stats from an agent
func handleWsStats(jsonConfig string, id string) (string, error) {
	agent := ""
	var payload struct {
		ID string `json:"id"`
		// Optional: also return the stats of this holdout file
		HoldoutFile string `json:"holdout_file"`
	}
	if err := json.Unmarshal([]byte(jsonConfig), &payload); err == nil && payload.ID != "" {
		agent = payload.ID
	}
	if agent == "" {
		return "", fmt.Errorf("missing agent id in path")
	}
	ag, ok := wsHub.Get(agent)
	if !ok {
		return "", fmt.Errorf("agent %q not found", agent)
	}

	rid := fmt.Sprintf("req-%d", time.Now().UnixNano())
	pr := addPending(rid)

	cmd := map[string]any{
		"type": "GET_STATS",
		"rid":  rid,
	}
	if holdoutFile := strings.TrimSpace(payload.HoldoutFile); holdoutFile != "" {
		cmd["args"] = map[string]any{"holdout_file": holdoutFile}
	}
	ag.mu.Lock()
	err := ag.ws.WriteJSON(cmd)
	ag.mu.Unlock()
	if err != nil {
		return "", fmt.Errorf("write to agent %q failed: %w", agent, err)
	}

	select {
	case res := <-pr.ch:
		return res, nil
	case <-time.After(10 * time.Second):
		return "", fmt.Errorf("timeout waiting for stats from agent %q", agent)
	}
}

// --------------------------------------------------------
// Existing MEDfl handlers
// --------------------------------------------------------
func handleWsLogs(jsonConfig string, id string) (string, error) {
	var payload struct {
		ID    string `json:"id"`
		Lines int    `json:"lines"` // optional, default 200
	}

	log.Println("[handleWsLogs] raw jsonConfig:", jsonConfig, "| pageID:", id)

	if err := json.Unmarshal([]byte(jsonConfig), &payload); err != nil {
		log.Println("[handleWsLogs] JSON unmarshal error:", err)
		return "", fmt.Errorf("invalid payload (need id): %w", err)
	}

	log.Printf("[handleWsLogs] after unmarshal: payload.ID=%q payload.Lines=%d\n",
		payload.ID, payload.Lines)

	if payload.ID == "" {
		return "", fmt.Errorf("invalid payload: missing agent id")
	}
	if payload.Lines <= 0 {
		payload.Lines = 200
	}

	ag, ok := wsHub.Get(payload.ID)
	if !ok {
		log.Printf("[handleWsLogs] agent %q not found in wsHub\n", payload.ID)
		return "", fmt.Errorf("agent %q not found", payload.ID)
	}
	log.Printf("[handleWsLogs] agent %q found, sending GET_LOG (lines=%d)\n",
		payload.ID, payload.Lines)

	rid := fmt.Sprintf("req-%d", time.Now().UnixNano())
	pr := addPending(rid)

	cmd := map[string]any{
		"type": "GET_LOG",
		"rid":  rid,
		"args": map[string]any{
			"lines": payload.Lines,
		},
	}

	ag.mu.Lock()
	err := ag.ws.WriteJSON(cmd)
	ag.mu.Unlock()
	if err != nil {
		log.Printf("[handleWsLogs] write to agent %q failed: %v\n", payload.ID, err)
		return "", fmt.Errorf("write to agent %q failed: %w", payload.ID, err)
	}
	log.Printf("[handleWsLogs] GET_LOG sent to agent %q, waiting for response (rid=%s)\n", payload.ID, rid)

	select {
	case res := <-pr.ch:
		log.Printf("[handleWsLogs] received response from agent %q: len(res)=%d\n", payload.ID, len(res))
		return res, nil
	//
	case <-time.After(10 * time.Second):
		log.Printf("[handleWsLogs] timeout waiting for log from agent %q\n", payload.ID)
		return "", fmt.Errorf("timeout waiting for log from agent %q", payload.ID)
	}
}

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

// DB config
func handleConfigFlDb(jsonConfig string, id string) (string, error) {
	log.Println("Setting DB configuration of MEDfl...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/fl_setDB_config.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// Run pipeline
func handleRunFlPipeline(jsonConfig string, id string) (string, error) {
	log.Println("Setting FL pipeline...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/run_fl_pipeline_copy.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

func handleReadPklModel(jsonConfig string, id string) (string, error) {

	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/readPKLmodel.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

func handleReadPthModel(jsonConfig string, id string) (string, error) {

	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/readPTHmodel.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// Hyperparam optim
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
	FileContentBase64 string   `json:"fileContentBase64"`
	Filename          string   `json:"filename"`
	Subject           string   `json:"subject"`
	Body              string   `json:"body"`
	Recipients        []string `json:"recipients"`
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

// Real world
func handleRunServer(jsonConfig string, id string) (string, error) {
	log.Println("Running central server...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/runServer.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}
func handleRunXGBServer(jsonConfig string, id string) (string, error) {
	log.Println("Running central server...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/run_xgb_rw_server.py", id)
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

func handleMachineSpecs(jsonConfig string, id string) (string, error) {
	log.Println("getting the machine specs...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/medfl/machine_specs.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}
