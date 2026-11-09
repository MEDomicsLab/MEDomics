import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Alert, Badge, Button, ButtonGroup, Card, Form, Nav, Spinner, Tab } from "react-bootstrap"
import { toast } from "react-toastify"
import { ipcRenderer, shell } from "electron"
import { FaWindows, FaApple, FaCheckCircle, FaRegCircle } from "react-icons/fa"
import { FcLinux } from "react-icons/fc"
import { IoCopyOutline, IoReload } from "react-icons/io5"
import { MdOutlineSaveAlt } from "react-icons/md"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"
import { requestBackend } from "../../../utilities/requests"
import { CLIENT_TAG, fetchTailnetDevices, getTailscaleCredentials, requestTailscale } from "./tailscale"

// Network setup of the real-world mode: the Tailscale connection of this computer, and the setup scripts of the client sites

const OS_OPTIONS = [
  { key: "windows", label: "Windows", icon: <FaWindows /> },
  { key: "macos", label: "macOS", icon: <FaApple /> },
  { key: "linux", label: "Linux", icon: <FcLinux /> }
]

const RUN_COMMANDS = {
  windows: (file) => `powershell -ExecutionPolicy Bypass -File ${file}`,
  macos: (file) => `bash ${file}`,
  linux: (file) => `sudo bash ${file}`
}

const RUN_WHERE = {
  windows: "in PowerShell opened as administrator, in the folder of the file",
  macos: "in Terminal, in the folder of the file (without sudo)",
  linux: "in a terminal, in the folder of the file"
}

const POLICY_SNIPPET = `"tagOwners": {
  "${CLIENT_TAG}": ["autogroup:admin"]
}`

const copyText = (text, what = "Copied") => {
  navigator.clipboard.writeText(text)
  toast.success(what)
}

const maskSecret = (value = "") => (value.length > 12 ? value.slice(0, 10) + "…" + value.slice(-4) : "…")

const formatDate = (iso) => {
  const d = new Date(iso)
  return isNaN(d) ? iso : d.toLocaleString()
}

/**
 * Tailscale connection of this computer and the API credentials of the tailnet
 */
const TailscaleTab = ({ port, pageId, onCredentialsChange }) => {
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [saved, setSaved] = useState(null)
  const [type, setType] = useState("oauth")
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const loadStatus = useCallback(() => {
    setStatusLoading(true)
    requestTailscale(port, "/medfl/tailscale/status/", pageId)
      .then(setStatus)
      .catch((err) => setStatus({ request_error: err.message }))
      .finally(() => setStatusLoading(false))
  }, [port, pageId])

  const loadSaved = useCallback(async () => {
    const credentials = await getTailscaleCredentials()
    setSaved(credentials)
    onCredentialsChange(credentials)
  }, [onCredentialsChange])

  useEffect(() => {
    loadStatus()
    loadSaved()
  }, [loadStatus, loadSaved])

  const formCredentials = () => (type === "oauth" ? { type, client_id: clientId.trim(), client_secret: clientSecret.trim() } : { type, api_key: apiKey.trim() })

  const testCredentials = async (credentials, save) => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await requestTailscale(port, "/medfl/tailscale/test/", pageId, { credentials })
      setTestResult(result)
      if (save && result.devices_ok) {
        const res = await ipcRenderer.invoke("tailscale-save-credentials", credentials)
        if (!res.success) throw new Error(res.message)
        toast.success(res.encrypted ? "Credentials saved (encrypted)" : "Credentials saved")
        setClientId("")
        setClientSecret("")
        setApiKey("")
        await loadSaved()
        loadStatus()
      }
    } catch (err) {
      setTestResult({ devices_ok: false, devices_error: err.message })
    } finally {
      setTesting(false)
    }
  }

  const removeCredentials = async () => {
    await ipcRenderer.invoke("tailscale-delete-credentials")
    setTestResult(null)
    await loadSaved()
    toast.success("Credentials removed")
  }

  const formComplete = type === "oauth" ? clientId.trim() && clientSecret.trim() : apiKey.trim()
  const self = status?.self

  return (
    <div className="d-flex flex-column gap-3">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <strong>This computer</strong>
          <Button size="sm" variant="outline-secondary" onClick={loadStatus} disabled={statusLoading}>
            {statusLoading ? <Spinner size="sm" /> : <IoReload />} Refresh
          </Button>
        </Card.Header>
        <Card.Body>
          {!status && <Spinner size="sm" />}
          {status?.request_error && <Alert variant="danger">The MEDfl server did not answer: {status.request_error}</Alert>}
          {status && !status.request_error && status.installed === false && (
            <Alert variant="warning" className="mb-0">
              Tailscale is not installed on this computer.{" "}
              <a href="#" onClick={() => shell.openExternal("https://tailscale.com/download")}>
                Download Tailscale
              </a>
              , sign in to the study tailnet, then click Refresh.
            </Alert>
          )}
          {status?.local_error && status.installed !== false && <Alert variant="warning">{status.local_error}</Alert>}
          {status?.state && status.state !== "Running" && (
            <Alert variant="warning" className="mb-0">
              Tailscale is <strong>{status.state}</strong> on this computer. Open the Tailscale app and connect, or run <code>sudo tailscale up</code> on Linux.
              {status.auth_url && (
                <div className="mt-2">
                  Sign-in link:{" "}
                  <a href="#" onClick={() => shell.openExternal(status.auth_url)}>
                    {status.auth_url}
                  </a>
                </div>
              )}
            </Alert>
          )}
          {status?.state === "Running" && self && (
            <div className="d-flex flex-column gap-1">
              <div>
                <Badge bg="success">Connected</Badge> <strong>{self.hostname}</strong> · {self.ip}{" "}
                <Button size="sm" variant="link" className="p-0" onClick={() => copyText(self.ip, "Address copied")}>
                  <IoCopyOutline />
                </Button>
                {(self.tags || []).map((t) => (
                  <Badge key={t} bg="secondary" className="ms-1">
                    {t}
                  </Badge>
                ))}
              </div>
              <div className="text-muted small">
                Tailnet: {status.tailnet || "?"} · machines online: {status.peers_online} / {status.peers} · agents connected: {status.agents_connected}
              </div>
              {status.coordinator_url && (
                <div className="small">
                  Agent connection address (MEDFL_CTRL, for agents started by hand): <code>{status.coordinator_url}</code>{" "}
                  <Button size="sm" variant="link" className="p-0" onClick={() => copyText(status.coordinator_url, "Address copied")}>
                    <IoCopyOutline />
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <strong>Tailscale API credentials</strong> <span className="text-muted small">(optional: they create the join keys of the client sites)</span>
        </Card.Header>
        <Card.Body className="d-flex flex-column gap-2">
          {saved ? (
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <Badge bg="success">Saved</Badge>
              <span>{saved.type === "oauth" ? `OAuth client ${saved.client_id}` : `API access token ${maskSecret(saved.api_key)}`}</span>
              <Button size="sm" variant="outline-primary" disabled={testing} onClick={() => testCredentials(saved, false)}>
                {testing ? <Spinner size="sm" /> : "Test"}
              </Button>
              <Button size="sm" variant="outline-danger" onClick={removeCredentials}>
                Remove
              </Button>
            </div>
          ) : (
            <div className="text-muted small">No credentials saved: the network is read from the Tailscale app of this computer, and sites join with an invitation.</div>
          )}

          <Form.Group>
            <Form.Label className="mb-1">{saved ? "Replace them with" : "Add"}</Form.Label>
            <div>
              <Form.Check inline type="radio" id="ts-type-oauth" label="OAuth client (recommended)" checked={type === "oauth"} onChange={() => setType("oauth")} />
              <Form.Check inline type="radio" id="ts-type-api" label="API access token" checked={type === "api_key"} onChange={() => setType("api_key")} />
            </div>
          </Form.Group>
          {type === "oauth" ? (
            <>
              <Form.Control placeholder="OAuth client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} />
              <Form.Control type="password" placeholder="OAuth client secret (tskey-client-…)" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
              <div className="small text-muted">
                In the Tailscale admin console: Settings, OAuth clients, Generate OAuth client. Give it write access to <strong>Devices: Core</strong> and <strong>Keys: Auth Keys</strong>, both with
                the tag <code>{CLIENT_TAG}</code>. Add the tag to the tailnet policy first (if the policy restricts access, also let <code>{CLIENT_TAG}</code> reach this computer on the ports{" "}
                {status?.port || 3000} and 8080):
              </div>
              <pre className="small bg-light p-2 mb-0 position-relative">
                {POLICY_SNIPPET}
                <Button size="sm" variant="link" className="position-absolute top-0 end-0" onClick={() => copyText(POLICY_SNIPPET, "Policy copied")}>
                  <IoCopyOutline />
                </Button>
              </pre>
            </>
          ) : (
            <>
              <Form.Control type="password" placeholder="API access token (tskey-api-…)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <div className="small text-muted">
                In the Tailscale admin console: Settings, Keys, Generate access token. It expires after at most 90 days. Join keys are tagged <code>{CLIENT_TAG}</code> when the tailnet policy has that
                tag, and untagged otherwise.
              </div>
            </>
          )}
          <div>
            <Button disabled={!formComplete || testing} onClick={() => testCredentials(formCredentials(), true)}>
              {testing ? <Spinner size="sm" /> : "Test and save"}
            </Button>
          </div>

          {testResult && (
            <div className="small">
              <div className={testResult.devices_ok ? "text-success" : "text-danger"}>
                {testResult.devices_ok ? `✓ Can list the machines (${testResult.devices})` : `✗ Cannot list the machines: ${testResult.devices_error}`}
              </div>
              {testResult.devices_ok && (
                <div className={testResult.keys_ok ? "text-success" : "text-danger"}>
                  {testResult.keys_ok
                    ? `✓ Can create join keys${testResult.tagged ? ` tagged ${CLIENT_TAG}` : " (untagged: the tailnet policy has no " + CLIENT_TAG + ")"}`
                    : `✗ Cannot create join keys: ${testResult.keys_error}`}
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}

/**
 * Setup script of a client site, and its progress until its agent connects
 */
const ClientSiteTab = ({ port, pageId, credentials }) => {
  const [siteId, setSiteId] = useState("")
  const [os, setOS] = useState("windows")
  const [join, setJoin] = useState(credentials ? "key" : "invite")
  const [manualKey, setManualKey] = useState("")
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [showScript, setShowScript] = useState(false)
  const [progress, setProgress] = useState({ joined: false, connected: false })
  const pollRef = useRef(null)

  useEffect(() => {
    if (credentials && join === "invite") setJoin("key")
    if (!credentials && join === "key") setJoin("invite")
  }, [credentials])

  useEffect(() => () => clearInterval(pollRef.current), [])

  const siteValid = /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/.test(siteId)

  const watchSite = (id) => {
    clearInterval(pollRef.current)
    const check = () => {
      fetchTailnetDevices(port, pageId)
        .then((json) => {
          const joined = (json.devices || []).some((d) => (d.hostname || "").toLowerCase() === id.toLowerCase() && d.online !== false)
          setProgress((p) => ({ ...p, joined }))
        })
        .catch(() => {})
      requestBackend(
        port,
        "/medfl/rw/ws/agents/" + pageId,
        {},
        (agents) => {
          const connected = Array.isArray(agents) && agents.includes(id)
          setProgress((p) => ({ ...p, connected }))
          if (connected) clearInterval(pollRef.current)
        },
        () => {}
      )
    }
    check()
    pollRef.current = setInterval(check, 5000)
  }

  const generate = async () => {
    setGenerating(true)
    setResult(null)
    setProgress({ joined: false, connected: false })
    try {
      const res = await requestTailscale(port, "/medfl/tailscale/client-script/", pageId, { site_id: siteId, os, join, auth_key: join === "manual_key" ? manualKey.trim() : "" })
      setResult(res)
      watchSite(siteId)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const saveScript = async () => {
    const res = await ipcRenderer.invoke("medfl-save-text-file", { defaultName: result.file_name, content: result.script })
    if (res.success) toast.success("Saved to " + res.filePath)
  }

  const step = (done, text) => (
    <div className={done ? "text-success" : "text-muted"}>
      {done ? <FaCheckCircle /> : <FaRegCircle />} {text}
    </div>
  )

  return (
    <div className="d-flex flex-column gap-3">
      <Alert variant="info" className="mb-0">
        The script joins the site to the Tailscale network, installs the MEDfl agent and starts it at every boot. Generate one script per site, and send it only to that site.
      </Alert>

      <Form.Group>
        <Form.Label>Site name</Form.Label>
        <Form.Control placeholder="for example siteA" value={siteId} isInvalid={siteId !== "" && !siteValid} onChange={(e) => setSiteId(e.target.value.trim())} />
        <Form.Control.Feedback type="invalid">Letters, digits and hyphens only, starting with a letter or a digit</Form.Control.Feedback>
        <Form.Text>The site appears under this name in the network and in the results.</Form.Text>
      </Form.Group>

      <Form.Group>
        <Form.Label>Operating system of the site</Form.Label>
        <div>
          <ButtonGroup>
            {OS_OPTIONS.map((o) => (
              <Button key={o.key} variant={os === o.key ? "primary" : "outline-primary"} onClick={() => setOS(o.key)}>
                {o.icon} {o.label}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      </Form.Group>

      <Form.Group>
        <Form.Label>How the site joins the Tailscale network</Form.Label>
        <Form.Check
          type="radio"
          id="join-key"
          disabled={!credentials}
          checked={join === "key"}
          onChange={() => setJoin("key")}
          label={credentials ? "Automatically: the script carries a single-use join key, valid 24 hours" : "Automatically (add Tailscale API credentials in the Tailscale tab first)"}
        />
        <Form.Check type="radio" id="join-manual" checked={join === "manual_key"} onChange={() => setJoin("manual_key")} label="With a join key I created in the Tailscale admin console" />
        {join === "manual_key" && <Form.Control className="mt-1" type="password" placeholder="tskey-auth-…" value={manualKey} onChange={(e) => setManualKey(e.target.value)} />}
        <Form.Check type="radio" id="join-invite" checked={join === "invite"} onChange={() => setJoin("invite")} label="The site signs in itself (I invite it to the tailnet)" />
      </Form.Group>

      <div>
        <Button disabled={!siteValid || generating || (join === "manual_key" && !manualKey.trim())} onClick={generate}>
          {generating ? <Spinner size="sm" /> : "Generate the setup script"}
        </Button>
      </div>

      {result && (
        <Card>
          <Card.Header>
            <strong>{result.file_name}</strong>
          </Card.Header>
          <Card.Body className="d-flex flex-column gap-2">
            <ol className="mb-1">
              <li>
                Send the file to the site:{" "}
                <Button size="sm" variant="outline-primary" onClick={saveScript}>
                  <MdOutlineSaveAlt /> Save as file
                </Button>{" "}
                <Button size="sm" variant="outline-secondary" onClick={() => copyText(result.script, "Script copied")}>
                  <IoCopyOutline /> Copy
                </Button>
              </li>
              <li>
                The site runs it once, {RUN_WHERE[os]}: <code>{RUN_COMMANDS[os](result.file_name)}</code>
              </li>
              <li>
                The site puts <code>dataset.csv</code> (and <code>holdout.csv</code> for the holdout test) in {os === "windows" ? <code>C:\medfl\data</code> : <code>~/medfl/data</code>}.
              </li>
            </ol>
            {result.key_expires && (
              <div className="small text-muted">
                The join key works once and expires on {formatDate(result.key_expires)}.
                {result.tagged === false && ` It is untagged: the site appears as a client only while no machine has ${CLIENT_TAG}.`}
              </div>
            )}
            <div className="small">
              {step(progress.joined, `${siteId} joined the Tailscale network`)}
              {step(progress.connected, `${siteId} agent connected (the first start installs MEDfl: 10 to 20 minutes)`)}
            </div>
            <div>
              <Button size="sm" variant="link" className="p-0" onClick={() => setShowScript(!showScript)}>
                {showScript ? "Hide the script" : "Show the script"}
              </Button>
            </div>
            {showScript && <pre style={{ maxHeight: "40vh", overflow: "auto", fontSize: 12, background: "#1e1e1e", color: "#d4d4d4", padding: 12, borderRadius: 4 }}>{result.script}</pre>}
          </Card.Body>
        </Card>
      )}
    </div>
  )
}

const ManageScripts = () => {
  const { port } = useContext(WorkspaceContext)
  const { pageId } = useContext(PageInfosContext)
  const [tab, setTab] = useState("tailscale")
  const [credentials, setCredentials] = useState(null)

  return (
    <Tab.Container activeKey={tab} onSelect={(k) => setTab(k)}>
      <Nav variant="tabs" className="mb-3">
        <Nav.Item>
          <Nav.Link eventKey="tailscale">Tailscale</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="site">Add a client site</Nav.Link>
        </Nav.Item>
      </Nav>
      <Tab.Content>
        <Tab.Pane eventKey="tailscale">
          <TailscaleTab port={port} pageId={pageId} onCredentialsChange={setCredentials} />
        </Tab.Pane>
        <Tab.Pane eventKey="site">
          <ClientSiteTab port={port} pageId={pageId} credentials={credentials} />
        </Tab.Pane>
      </Tab.Content>
    </Tab.Container>
  )
}

export default ManageScripts
