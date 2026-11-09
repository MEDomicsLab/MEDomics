package medfl

// Tailscale integration of the MEDfl real-world mode.
//
// The coordinator (the computer running MEDomics) and the client sites are in the same tailnet.
//   - Without credentials, the tailnet is read from the local Tailscale client (`tailscale status --json`):
//     this computer, its address and the other machines of the tailnet.
//   - With credentials of the tailnet (an OAuth client or an API access token, stored encrypted by the app and sent
//     with each request), the app also lists the machines through the Tailscale API and creates the single-use join
//     keys of the client sites.
//
// Roles of the machines, compatible with tailnets set up before this integration:
//   - server: the machine tagged tag:server, or else this computer
//   - clients: the machines tagged tag:medfl-client, or else (no machine has that tag) every other machine

import (
	"bytes"
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"text/template"
	"time"

	Utils "go_module/src"
)

const (
	serverTag    = "tag:server"
	clientTag    = "tag:medfl-client"
	tailscaleAPI = "https://api.tailscale.com/api/v2"
	// a client site joins once with its key, which expires if unused
	clientKeyTTL = 24 * time.Hour
	// name of the agent file on the client sites, and of its route on the coordinator
	agentFileName = "medfl_agent.py"
)

// Agent served to the client sites by their setup script (bundled with the app in pythonCode)
var agentSourcePath = "../pythonCode/modules/medfl/agent/medfl_agent_rebuilt.py"

//go:embed client_scripts/*
var clientScripts embed.FS

var (
	siteIDPattern  = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9-]{0,62}$`)
	authKeyPattern = regexp.MustCompile(`^tskey-[A-Za-z0-9-]+$`)
	// Tailscale addresses: 100.64.0.0/10 and fd7a:115c:a1e0::/48
	tailnetRanges = parseCIDRs("100.64.0.0/10", "fd7a:115c:a1e0::/48")
)

func parseCIDRs(cidrs ...string) []*net.IPNet {
	out := make([]*net.IPNet, 0, len(cidrs))
	for _, c := range cidrs {
		_, n, err := net.ParseCIDR(c)
		if err != nil {
			panic(err)
		}
		out = append(out, n)
	}
	return out
}

// --------------------------------------------------------
// Network access
// --------------------------------------------------------

func requestIP(r *http.Request) net.IP {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return net.ParseIP(host)
}

func isLocalRequest(r *http.Request) bool {
	ip := requestIP(r)
	return ip != nil && ip.IsLoopback()
}

// isLocalOrTailnetRequest accepts this computer and the Tailscale addresses.
// MEDFL_ALLOW_ANY_NETWORK=1 accepts any network (agents reaching the coordinator without Tailscale).
func isLocalOrTailnetRequest(r *http.Request) bool {
	if os.Getenv("MEDFL_ALLOW_ANY_NETWORK") == "1" || isLocalRequest(r) {
		return true
	}
	ip := requestIP(r)
	if ip == nil {
		return false
	}
	for _, n := range tailnetRanges {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// addLocalHandleFunc is Utils.CreateHandleFunc for the routes only the app on this computer may call
// (they read the tailnet and create join keys).
func addLocalHandleFunc(topic string, processRequest func(jsonConfig string, id string) (string, error)) {
	log.Println("Adding local handle func for topic: " + topic)
	http.HandleFunc("/"+topic, func(w http.ResponseWriter, r *http.Request) {
		if !isLocalRequest(r) {
			log.Printf("Refused %s from %s: only this computer may call it", r.URL.Path, r.RemoteAddr)
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "Invalid request method. Only POST is allowed.", http.StatusMethodNotAllowed)
			return
		}
		id := strings.ReplaceAll(r.URL.Path, "/"+topic, "")
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}
		jsonConfig, err := Utils.GetConfigFromMessage(w, body)
		if err != nil {
			return
		}
		response, err := processRequest(jsonConfig, id)
		if err != nil {
			response = errorJSON(err)
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(Utils.CreateResponse(map[string]interface{}{"message": response})); err != nil {
			http.Error(w, "Failed to encode JSON response", http.StatusInternalServerError)
		}
	})
}

// errorJSON is the {"error": "..."} response the MEDfl pages show to the user
func errorJSON(err error) string {
	b, _ := json.Marshal(map[string]string{"error": err.Error()})
	return string(b)
}

func toJSON(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// --------------------------------------------------------
// Local Tailscale client
// --------------------------------------------------------

var errTailscaleNotInstalled = errors.New("Tailscale is not installed on this computer: install it from https://tailscale.com/download")

type tsNode struct {
	ID           string   `json:"ID"`
	HostName     string   `json:"HostName"`
	DNSName      string   `json:"DNSName"`
	OS           string   `json:"OS"`
	TailscaleIPs []string `json:"TailscaleIPs"`
	Tags         []string `json:"Tags"`
	Online       bool     `json:"Online"`
	LastSeen     string   `json:"LastSeen"`
	KeyExpiry    string   `json:"KeyExpiry"`
	UserID       int64    `json:"UserID"`
	ShareeNode   bool     `json:"ShareeNode"`
}

type tsStatus struct {
	BackendState string             `json:"BackendState"`
	AuthURL      string             `json:"AuthURL"`
	Self         *tsNode            `json:"Self"`
	Peer         map[string]*tsNode `json:"Peer"`
	User         map[string]struct {
		LoginName string `json:"LoginName"`
	} `json:"User"`
	CurrentTailnet *struct {
		Name           string `json:"Name"`
		MagicDNSSuffix string `json:"MagicDNSSuffix"`
	} `json:"CurrentTailnet"`
}

// tailscaleCLI finds the tailscale command, also where the installers put it when it is not on the PATH
func tailscaleCLI() (string, error) {
	if p, err := exec.LookPath("tailscale"); err == nil {
		return p, nil
	}
	var candidates []string
	switch runtime.GOOS {
	case "windows":
		for _, dir := range []string{os.Getenv("ProgramFiles"), `C:\Program Files`} {
			if dir != "" {
				candidates = append(candidates, filepath.Join(dir, "Tailscale", "tailscale.exe"))
			}
		}
	case "darwin":
		candidates = []string{"/Applications/Tailscale.app/Contents/MacOS/Tailscale", "/opt/homebrew/bin/tailscale", "/usr/local/bin/tailscale"}
	default:
		candidates = []string{"/usr/bin/tailscale", "/usr/sbin/tailscale", "/usr/local/bin/tailscale"}
	}
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c, nil
		}
	}
	return "", errTailscaleNotInstalled
}

// localTailscaleStatus runs `tailscale status --json` on this computer
func localTailscaleStatus() (*tsStatus, error) {
	cli, err := tailscaleCLI()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, cli, "status", "--json")
	hideConsoleWindow(cmd)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	runErr := cmd.Run()
	// the JSON is printed also when the client is logged out or stopped
	var st tsStatus
	if stdout.Len() > 0 && json.Unmarshal(stdout.Bytes(), &st) == nil && st.BackendState != "" {
		return &st, nil
	}
	if runErr != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = runErr.Error()
		}
		return nil, fmt.Errorf("Tailscale is not running on this computer (%s): start it, then try again", msg)
	}
	return nil, errors.New("unexpected output of tailscale status")
}

// selfIPv4 is the Tailscale IPv4 address of this computer, or "" when Tailscale is not connected
func selfIPv4(st *tsStatus) string {
	if st == nil || st.Self == nil {
		return ""
	}
	for _, a := range st.Self.TailscaleIPs {
		if ip := net.ParseIP(a); ip != nil && ip.To4() != nil {
			return a
		}
	}
	return ""
}

func localCoordinatorIP() (string, error) {
	st, err := localTailscaleStatus()
	if err != nil {
		return "", err
	}
	if st.BackendState != "Running" {
		return "", fmt.Errorf("Tailscale is %s on this computer: connect it to the study tailnet first", strings.ToLower(st.BackendState))
	}
	ip := selfIPv4(st)
	if ip == "" {
		return "", errors.New("this computer has no Tailscale IPv4 address")
	}
	return ip, nil
}

// --------------------------------------------------------
// Devices
// --------------------------------------------------------

// tsDevice has the fields of a device of the Tailscale API that the MEDfl pages show, plus its MEDfl role
type tsDevice struct {
	ID              string   `json:"id"`
	NodeID          string   `json:"nodeId,omitempty"`
	Hostname        string   `json:"hostname"`
	Name            string   `json:"name"`
	OS              string   `json:"os"`
	Addresses       []string `json:"addresses"`
	Tags            []string `json:"tags,omitempty"`
	User            string   `json:"user,omitempty"`
	LastSeen        string   `json:"lastSeen,omitempty"`
	Expires         string   `json:"expires,omitempty"`
	Authorized      bool     `json:"authorized"`
	IsExternal      bool     `json:"isExternal"`
	ClientVersion   string   `json:"clientVersion,omitempty"`
	UpdateAvailable bool     `json:"updateAvailable"`
	// connected to Tailscale now (nil: unknown)
	Online *bool `json:"online,omitempty"`
	// "server", "client" or "other"
	Role string `json:"role"`
	// this computer
	IsSelf bool `json:"isSelf"`
}

func hasTag(tags []string, tag string) bool {
	for _, t := range tags {
		if t == tag {
			return true
		}
	}
	return false
}

func localDevice(n *tsNode, st *tsStatus, self bool) *tsDevice {
	online := n.Online || self
	d := &tsDevice{
		ID:         n.ID,
		NodeID:     n.ID,
		Hostname:   n.HostName,
		Name:       strings.TrimSuffix(n.DNSName, "."),
		OS:         n.OS,
		Addresses:  n.TailscaleIPs,
		Tags:       n.Tags,
		LastSeen:   n.LastSeen,
		Expires:    n.KeyExpiry,
		Authorized: true,
		IsExternal: n.ShareeNode,
		Online:     &online,
		IsSelf:     self,
	}
	if u, ok := st.User[fmt.Sprint(n.UserID)]; ok {
		d.User = u.LoginName
	}
	// the pages tell online machines by a recent lastSeen
	if online {
		d.LastSeen = time.Now().UTC().Format(time.RFC3339)
	}
	return d
}

func localDevices(st *tsStatus) []*tsDevice {
	var out []*tsDevice
	if st.Self != nil {
		out = append(out, localDevice(st.Self, st, true))
	}
	for _, p := range st.Peer {
		out = append(out, localDevice(p, st, false))
	}
	return out
}

func apiDevices(creds *tailscaleCredentials, st *tsStatus) ([]*tsDevice, error) {
	body, err := tailscaleAPIRequest(creds, http.MethodGet, "/tailnet/-/devices", nil)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Devices []struct {
			tsDevice
			ConnectedToControl *bool `json:"connectedToControl"`
		} `json:"devices"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("unexpected device list from Tailscale: %w", err)
	}
	selfAddrs := map[string]bool{}
	if st != nil && st.Self != nil {
		for _, a := range st.Self.TailscaleIPs {
			selfAddrs[a] = true
		}
	}
	out := make([]*tsDevice, 0, len(parsed.Devices))
	for i := range parsed.Devices {
		d := parsed.Devices[i].tsDevice
		d.Online = parsed.Devices[i].ConnectedToControl
		for _, a := range d.Addresses {
			if selfAddrs[a] {
				d.IsSelf = true
			}
		}
		out = append(out, &d)
	}
	return out, nil
}

// assignRoles sets the MEDfl role of each device and returns the server and whether the client tag is in use
func assignRoles(devices []*tsDevice) (server *tsDevice, clientTagInUse bool) {
	for _, d := range devices {
		if hasTag(d.Tags, serverTag) {
			server = d
			break
		}
	}
	if server == nil {
		for _, d := range devices {
			if d.IsSelf {
				server = d
				break
			}
		}
	}
	for _, d := range devices {
		if d != server && hasTag(d.Tags, clientTag) {
			clientTagInUse = true
		}
	}
	for _, d := range devices {
		switch {
		case d == server:
			d.Role = "server"
		case !clientTagInUse || hasTag(d.Tags, clientTag):
			d.Role = "client"
		default:
			d.Role = "other"
		}
	}
	return server, clientTagInUse
}

type tailscaleRequest struct {
	Credentials *tailscaleCredentials `json:"credentials"`
}

func parseTailscaleRequest(jsonConfig string, v any) error {
	if strings.TrimSpace(jsonConfig) == "" {
		return nil
	}
	if err := json.Unmarshal([]byte(jsonConfig), v); err != nil {
		return fmt.Errorf("invalid request: %w", err)
	}
	return nil
}

// handleGetDevices lists the machines of the tailnet with their MEDfl roles.
// Payload JSON: { "credentials": {...} } (optional: without them the local Tailscale client is read)
func handleGetDevices(jsonConfig string, _ string) (string, error) {
	var req tailscaleRequest
	if err := parseTailscaleRequest(jsonConfig, &req); err != nil {
		return errorJSON(err), nil
	}
	st, localErr := localTailscaleStatus()

	var devices []*tsDevice
	source := "local"
	if req.Credentials.configured() {
		var err error
		if devices, err = apiDevices(req.Credentials, st); err != nil {
			return errorJSON(err), nil
		}
		source = "api"
	} else {
		if localErr != nil {
			return errorJSON(localErr), nil
		}
		if st.BackendState != "Running" {
			return errorJSON(fmt.Errorf("Tailscale is %s on this computer: connect it to the study tailnet first", strings.ToLower(st.BackendState))), nil
		}
		devices = localDevices(st)
	}

	server, clientTagInUse := assignRoles(devices)
	serverID := ""
	if server != nil {
		serverID = server.ID
	}
	return toJSON(map[string]any{
		"devices":           devices,
		"server_id":         serverID,
		"source":            source,
		"client_tag":        clientTag,
		"client_tag_in_use": clientTagInUse,
	})
}

// handleTailscaleStatus describes the Tailscale connection of this computer.
// Payload JSON: { "credentials": {...} } (optional, only reported as configured or not)
func handleTailscaleStatus(jsonConfig string, _ string) (string, error) {
	var req tailscaleRequest
	if err := parseTailscaleRequest(jsonConfig, &req); err != nil {
		return errorJSON(err), nil
	}
	out := map[string]any{
		"installed":              true,
		"state":                  "",
		"agents_connected":       len(wsHub.List()),
		"port":                   serverPort(),
		"credentials_configured": req.Credentials.configured(),
	}
	st, err := localTailscaleStatus()
	if err != nil {
		if errors.Is(err, errTailscaleNotInstalled) {
			out["installed"] = false
		}
		out["local_error"] = err.Error()
		return toJSON(out)
	}
	out["state"] = st.BackendState
	out["auth_url"] = st.AuthURL
	if st.CurrentTailnet != nil {
		out["tailnet"] = st.CurrentTailnet.Name
		out["dns_suffix"] = st.CurrentTailnet.MagicDNSSuffix
	}
	if st.Self != nil {
		ip := selfIPv4(st)
		out["self"] = map[string]any{
			"hostname":  st.Self.HostName,
			"dns_name":  strings.TrimSuffix(st.Self.DNSName, "."),
			"os":        st.Self.OS,
			"addresses": st.Self.TailscaleIPs,
			"ip":        ip,
			"tags":      st.Self.Tags,
		}
		if ip != "" {
			out["coordinator_url"] = fmt.Sprintf("ws://%s:%s%s/agent", ip, serverPort(), wsBase)
		}
	}
	online := 0
	for _, p := range st.Peer {
		if p.Online {
			online++
		}
	}
	out["peers"] = len(st.Peer)
	out["peers_online"] = online
	return toJSON(out)
}

// serverPort is the port the app started this server on
func serverPort() string {
	if len(os.Args) > 1 {
		return os.Args[1]
	}
	return ""
}

// --------------------------------------------------------
// Tailscale API
// --------------------------------------------------------

// tailscaleCredentials are the Tailscale API credentials of the coordinator: an OAuth client (scopes: devices:core
// and auth_keys, allowed to assign tag:medfl-client) or an API access token
type tailscaleCredentials struct {
	Type         string `json:"type"` // "oauth" or "api_key"
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	APIKey       string `json:"api_key"`
}

func (c *tailscaleCredentials) configured() bool {
	if c == nil {
		return false
	}
	if c.Type == "oauth" {
		return c.ClientID != "" && c.ClientSecret != ""
	}
	return c.APIKey != ""
}

type cachedToken struct {
	token   string
	expires time.Time
}

var oauthTokens = struct {
	sync.Mutex
	byClient map[string]cachedToken
}{byClient: map[string]cachedToken{}}

var tailscaleHTTP = &http.Client{Timeout: 15 * time.Second}

// accessToken returns the API token of the credentials (an OAuth access token lasts one hour)
func accessToken(c *tailscaleCredentials) (string, error) {
	if c.Type != "oauth" {
		return c.APIKey, nil
	}
	cacheKey := c.ClientID + ":" + c.ClientSecret
	oauthTokens.Lock()
	defer oauthTokens.Unlock()
	if t, ok := oauthTokens.byClient[cacheKey]; ok && time.Now().Before(t.expires) {
		return t.token, nil
	}
	form := url.Values{"client_id": {c.ClientID}, "client_secret": {c.ClientSecret}, "grant_type": {"client_credentials"}}
	resp, err := tailscaleHTTP.PostForm(tailscaleAPI+"/oauth/token", form)
	if err != nil {
		return "", fmt.Errorf("cannot reach Tailscale: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Tailscale refused the OAuth client (%s): check its ID and secret", resp.Status)
	}
	var parsed struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil || parsed.AccessToken == "" {
		return "", errors.New("unexpected OAuth response from Tailscale")
	}
	ttl := time.Duration(parsed.ExpiresIn) * time.Second
	if ttl <= 0 {
		ttl = time.Hour
	}
	oauthTokens.byClient[cacheKey] = cachedToken{token: parsed.AccessToken, expires: time.Now().Add(ttl - time.Minute)}
	return parsed.AccessToken, nil
}

type tailscaleAPIError struct {
	Status int
	Body   string
}

func (e *tailscaleAPIError) Error() string {
	var parsed struct {
		Message string `json:"message"`
	}
	msg := strings.TrimSpace(e.Body)
	if json.Unmarshal([]byte(e.Body), &parsed) == nil && parsed.Message != "" {
		msg = parsed.Message
	}
	switch e.Status {
	case http.StatusUnauthorized:
		return "Tailscale refused the credentials: they are invalid, revoked or expired"
	case http.StatusForbidden:
		return "the Tailscale credentials are missing a permission: " + msg
	}
	return fmt.Sprintf("Tailscale API error %d: %s", e.Status, msg)
}

func tailscaleAPIRequest(c *tailscaleCredentials, method, path string, payload any) ([]byte, error) {
	token, err := accessToken(c)
	if err != nil {
		return nil, err
	}
	var body io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, tailscaleAPI+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := tailscaleHTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cannot reach Tailscale: %w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &tailscaleAPIError{Status: resp.StatusCode, Body: string(b)}
	}
	return b, nil
}

type authKey struct {
	ID      string `json:"id"`
	Key     string `json:"key"`
	Expires string `json:"expires"`
	// carries tag:medfl-client
	Tagged bool `json:"tagged"`
}

// createClientAuthKey creates the single-use, pre-authorized join key of a client site, tagged tag:medfl-client.
// An API access token of a tailnet whose policy has no tag:medfl-client gets an untagged key instead
// (an OAuth client must assign a tag, so it never does).
func createClientAuthKey(c *tailscaleCredentials, siteID string, ttl time.Duration) (*authKey, error) {
	create := func(tags []string) (*authKey, error) {
		deviceCaps := map[string]any{"reusable": false, "ephemeral": false, "preauthorized": true}
		if len(tags) > 0 {
			deviceCaps["tags"] = tags
		}
		payload := map[string]any{
			"capabilities":  map[string]any{"devices": map[string]any{"create": deviceCaps}},
			"expirySeconds": int(ttl.Seconds()),
			"description":   "MEDfl site " + siteID,
		}
		b, err := tailscaleAPIRequest(c, http.MethodPost, "/tailnet/-/keys", payload)
		if err != nil {
			return nil, err
		}
		var k authKey
		if err := json.Unmarshal(b, &k); err != nil || k.Key == "" {
			return nil, errors.New("no key in the Tailscale response")
		}
		k.Tagged = len(tags) > 0
		return &k, nil
	}

	key, err := create([]string{clientTag})
	var apiErr *tailscaleAPIError
	if err != nil && errors.As(err, &apiErr) && (apiErr.Status == http.StatusBadRequest || apiErr.Status == http.StatusForbidden) && strings.Contains(strings.ToLower(apiErr.Body), "tag") {
		if c.Type == "oauth" {
			return nil, fmt.Errorf("the OAuth client may not assign %s: add it to tagOwners in the tailnet policy and to the tags of the OAuth client (%s)", clientTag, apiErr.Error())
		}
		log.Printf("[tailscale] %s is not usable in this tailnet (%s): creating an untagged key", clientTag, apiErr.Error())
		return create(nil)
	}
	return key, err
}

func deleteAuthKey(c *tailscaleCredentials, id string) error {
	_, err := tailscaleAPIRequest(c, http.MethodDelete, "/tailnet/-/keys/"+url.PathEscape(id), nil)
	return err
}

// handleTailscaleTest checks credentials before the app saves them: they list the devices and create a join key
// (a test key, deleted at once).
// Payload JSON: { "credentials": {...} }
func handleTailscaleTest(jsonConfig string, _ string) (string, error) {
	var req tailscaleRequest
	if err := parseTailscaleRequest(jsonConfig, &req); err != nil {
		return errorJSON(err), nil
	}
	if !req.Credentials.configured() {
		return errorJSON(errors.New("enter the Tailscale credentials first")), nil
	}
	out := map[string]any{"devices_ok": false, "keys_ok": false}
	devices, err := apiDevices(req.Credentials, nil)
	if err != nil {
		out["devices_error"] = err.Error()
		return toJSON(out)
	}
	out["devices_ok"] = true
	out["devices"] = len(devices)

	key, err := createClientAuthKey(req.Credentials, "connection-test", 5*time.Minute)
	if err != nil {
		out["keys_error"] = err.Error()
		return toJSON(out)
	}
	out["keys_ok"] = true
	out["tagged"] = key.Tagged
	if err := deleteAuthKey(req.Credentials, key.ID); err != nil {
		log.Printf("[tailscale] could not delete the test key %s: %v", key.ID, err)
	}
	return toJSON(out)
}

// handleCreateAuthKey creates the join key of a client site.
// Payload JSON: { "credentials": {...}, "site_id": "siteA" }
func handleCreateAuthKey(jsonConfig string, _ string) (string, error) {
	var req struct {
		tailscaleRequest
		SiteID string `json:"site_id"`
	}
	if err := parseTailscaleRequest(jsonConfig, &req); err != nil {
		return errorJSON(err), nil
	}
	if !req.Credentials.configured() {
		return errorJSON(errors.New("add the Tailscale credentials of the tailnet in Network setup first")), nil
	}
	siteID := strings.TrimSpace(req.SiteID)
	if siteID == "" {
		siteID = "client"
	}
	if !siteIDPattern.MatchString(siteID) {
		return errorJSON(errors.New("the site name may only contain letters, digits and hyphens")), nil
	}
	key, err := createClientAuthKey(req.Credentials, siteID, clientKeyTTL)
	if err != nil {
		return errorJSON(err), nil
	}
	return toJSON(key)
}

// --------------------------------------------------------
// Client sites
// --------------------------------------------------------

var agentTokenState struct {
	sync.Mutex
	token string
}

// agentToken is the study token the agents of the client sites send when they connect. It is created once and kept
// in the user configuration folder of this computer.
func agentToken() (string, error) {
	agentTokenState.Lock()
	defer agentTokenState.Unlock()
	if agentTokenState.token != "" {
		return agentTokenState.token, nil
	}
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, "MEDomics", "medfl_agent_token")
	if b, err := os.ReadFile(path); err == nil {
		if t := strings.TrimSpace(string(b)); len(t) >= 32 {
			agentTokenState.token = t
			return t, nil
		}
	}
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := hex.EncodeToString(raw)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return "", err
	}
	if err := os.WriteFile(path, []byte(token), 0o600); err != nil {
		return "", err
	}
	agentTokenState.token = token
	return token, nil
}

// agentSourceFile is the agent bundled with the app (same resolution as the python scripts of Utils)
func agentSourceFile() string {
	runMode := Utils.GetDotEnvVariable("RUN_MODE")
	if runMode == "" && len(os.Args) > 2 {
		runMode = os.Args[2]
	}
	if runMode == "prod" && len(os.Args) > 3 {
		return filepath.Join(os.Args[3], strings.ReplaceAll(agentSourcePath, "..", ""))
	}
	cwd, _ := os.Getwd()
	return filepath.Join(cwd, agentSourcePath)
}

// handleAgentDownload serves the agent to the setup script of a client site (over the tailnet)
func handleAgentDownload(w http.ResponseWriter, r *http.Request) {
	if !isLocalOrTailnetRequest(r) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Only GET is allowed", http.StatusMethodNotAllowed)
		return
	}
	path := agentSourceFile()
	b, err := os.ReadFile(path)
	if err != nil {
		log.Printf("[tailscale] agent file not found at %s: %v", path, err)
		http.Error(w, "Agent file not found on the coordinator", http.StatusNotFound)
		return
	}
	log.Printf("[tailscale] agent downloaded by %s", r.RemoteAddr)
	w.Header().Set("Content-Type", "text/x-python; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename="+agentFileName)
	_, _ = w.Write(b)
}

type clientScriptData struct {
	SiteID        string
	CoordinatorIP string
	Port          string
	AuthKey       string
	Token         string
	FileName      string
	GeneratedAt   string
}

var clientScriptFiles = map[string]struct{ template, extension string }{
	"linux":   {"client_scripts/linux.sh", "sh"},
	"macos":   {"client_scripts/macos.sh", "sh"},
	"windows": {"client_scripts/windows.ps1", "ps1"},
}

// handleClientScript generates the setup script of a client site: it joins the tailnet, installs the agent and starts
// it at every boot.
// Payload JSON: { "credentials": {...}, "site_id": "siteA", "os": "linux" | "macos" | "windows",
//
//	"join": "key" | "manual_key" | "invite", "auth_key": "tskey-auth-..." (join = manual_key) }
func handleClientScript(jsonConfig string, _ string) (string, error) {
	var req struct {
		tailscaleRequest
		SiteID  string `json:"site_id"`
		OS      string `json:"os"`
		Join    string `json:"join"`
		AuthKey string `json:"auth_key"`
	}
	if err := parseTailscaleRequest(jsonConfig, &req); err != nil {
		return errorJSON(err), nil
	}
	siteID := strings.TrimSpace(req.SiteID)
	if !siteIDPattern.MatchString(siteID) {
		return errorJSON(errors.New("the site name may only contain letters, digits and hyphens (for example siteA)")), nil
	}
	file, ok := clientScriptFiles[req.OS]
	if !ok {
		return errorJSON(errors.New("choose the operating system of the site")), nil
	}
	coordinatorIP, err := localCoordinatorIP()
	if err != nil {
		return errorJSON(err), nil
	}
	token, err := agentToken()
	if err != nil {
		return errorJSON(fmt.Errorf("cannot create the study token: %w", err)), nil
	}

	out := map[string]any{"coordinator": coordinatorIP + ":" + serverPort(), "join": req.Join}
	key := ""
	switch req.Join {
	case "key":
		if !req.Credentials.configured() {
			return errorJSON(errors.New("add the Tailscale credentials in the Tailscale tab to create join keys, or choose another way to join")), nil
		}
		k, err := createClientAuthKey(req.Credentials, siteID, clientKeyTTL)
		if err != nil {
			return errorJSON(err), nil
		}
		key = k.Key
		out["key_expires"] = k.Expires
		out["tagged"] = k.Tagged
	case "manual_key":
		key = strings.TrimSpace(req.AuthKey)
		if !authKeyPattern.MatchString(key) {
			return errorJSON(errors.New("a Tailscale join key starts with tskey-")), nil
		}
	case "invite":
	default:
		return errorJSON(errors.New("choose how the site joins the tailnet")), nil
	}

	src, err := clientScripts.ReadFile(file.template)
	if err != nil {
		return "", err
	}
	tmpl, err := template.New(file.template).Parse(string(src))
	if err != nil {
		return "", err
	}
	data := clientScriptData{
		SiteID:        siteID,
		CoordinatorIP: coordinatorIP,
		Port:          serverPort(),
		AuthKey:       key,
		Token:         token,
		FileName:      fmt.Sprintf("medfl_setup_%s.%s", siteID, file.extension),
		GeneratedAt:   time.Now().Format("2006-01-02 15:04"),
	}
	var script bytes.Buffer
	if err := tmpl.Execute(&script, data); err != nil {
		return "", err
	}
	text := script.String()
	if req.OS == "windows" {
		text = strings.ReplaceAll(text, "\r\n", "\n")
		text = strings.ReplaceAll(text, "\n", "\r\n")
	}
	out["script"] = text
	out["file_name"] = data.FileName
	return toJSON(out)
}

// withCoordinatorHost replaces a wildcard host (0.0.0.0, ::, empty) of the server address sent to the clients by the
// Tailscale address of this computer: the server listens on every interface, but the clients must dial a real one
func withCoordinatorHost(addr string) string {
	host, port, err := net.SplitHostPort(strings.TrimSpace(addr))
	if err != nil || (host != "" && host != "0.0.0.0" && host != "::") {
		return addr
	}
	ip, err := localCoordinatorIP()
	if err != nil {
		log.Printf("[tailscale] keeping the server address %s: %v", addr, err)
		return addr
	}
	return net.JoinHostPort(ip, port)
}
