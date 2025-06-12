import { useState, useEffect, useContext } from "react";
import { Dialog } from "primereact/dialog"
import { toast } from "react-toastify"
import { ipcRenderer } from "electron"
import { requestBackend } from "../../utilities/requests"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { useTunnel } from "../tunnel/TunnelContext";
import { setTunnelState, clearTunnelState } from "../../utilities/tunnelState";
/**
 *
 * @returns {JSX.Element} The connection modal used for establishing a connection to a remote server
 */
const ConnectionModal = ({ visible, closable, onClose, onConnect }) =>{
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("user");
  const [password, setPassword] = useState("");
  const [remotePort, setRemotePort] = useState("22");
  const [localPort, setLocalPort] = useState("8888");
  const [backendPort, setBackendPort] = useState("8888");
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [keyComment, setKeyComment] = useState("medomicslab-app");
  const [keyGenerated, setKeyGenerated] = useState(false);
  const [registerStatus, setRegisterStatus] = useState("");
  const [tunnelStatus, setTunnelStatus] = useState("");
  const [tunnelActive, setTunnelActive] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 3;
  const reconnectDelay = 3000; // ms
  const [connectionInfo, setConnectionInfo] = useState(null);

  const { port } = useContext(WorkspaceContext) // we get the port for server connexion
  const { setTunnelInfo, clearTunnelInfo } = useTunnel();

  const registerPublicKey = async (publicKeyToRegister, usernameToRegister) => {
    setRegisterStatus("Registering...");
    toast.info("Registering your SSH public key with the backend...");
    await requestBackend(
      port,
      "/connection/register_ssh_key",
      {
        username: usernameToRegister,
        publicKey: publicKeyToRegister
      },
      async (jsonResponse) => {
        console.log("received results:", jsonResponse)
        if (!jsonResponse.error) {
          setRegisterStatus("Public key registered successfully!");
          toast.success("Your SSH public key was registered successfully.");
        } else {
          setRegisterStatus("Failed to register public key: " + jsonResponse.error);
          toast.error(jsonResponse.error);
        }
      },
      (err) => {
        setRegisterStatus("Failed to register public key: " + err);
        toast.error(err);
      }
    )
      };

  const handleGenerateKey = async () => {
    try {
      const result = await ipcRenderer.invoke('generate-ssh-key', { comment: keyComment, username });
      if (result && result.publicKey && result.privateKey) {
        setPublicKey(result.publicKey);
        setPrivateKey(result.privateKey);
        setKeyGenerated(true);
        toast.success("A new SSH key pair was generated.");
        // Automatically register the public key after generation
        registerPublicKey(result.publicKey, username);
      } else if (result && result.error) {
        alert('Key generation failed: ' + result.error);
        toast.error("Key Generation Failed: " + result.error);
      } else {
        alert('Key generation failed: Unknown error.');
        toast.error("Key Generation Failed: Unknown error.");
      }
    } catch (err) {
      alert('Key generation failed: ' + err.message);
      toast.error("Key Generation Failed: " + err.message);
    }
  };

  // Tunnel error handler and auto-reconnect
  useEffect(() => {
    if (!tunnelActive && reconnectAttempts > 0 && reconnectAttempts <= maxReconnectAttempts && connectionInfo) {
      setTunnelStatus(`Reconnecting... (attempt ${reconnectAttempts} of ${maxReconnectAttempts})`);
      toast.warn(`Attempt ${reconnectAttempts} of ${maxReconnectAttempts} to reconnect SSH tunnel.`);
      const timer = setTimeout(() => {
        handleConnect(connectionInfo, true);
      }, reconnectDelay);
      return () => clearTimeout(timer);
    }
    if (reconnectAttempts > maxReconnectAttempts) {
      setTunnelStatus("Failed to reconnect SSH tunnel after multiple attempts.");
      toast.error("Failed to reconnect SSH tunnel after multiple attempts.");
    }
  }, [tunnelActive, reconnectAttempts, connectionInfo]);

  const handleConnect = async (info, isReconnect = false) => {
    setTunnelStatus(isReconnect ? "Reconnecting..." : "Connecting...");
    toast.info(isReconnect ? "Reconnecting SSH tunnel..." : "Establishing SSH tunnel...");
    const connInfo = info || { host, username, privateKey, remotePort, localPort, backendPort };
    setConnectionInfo(connInfo);
    try {
      if (!connInfo.host) {
        setTunnelStatus("Error: Remote host is required.");
        toast.error("Remote host is required.");
        return;
      }
      if (!connInfo.username) {
        setTunnelStatus("Error: Username is required.");
        toast.error("Username is required.");
        return;
      }
      if (!connInfo.privateKey) {
        setTunnelStatus("Error: SSH private key is missing. Please generate a key first.");
       toast.error("SSH private key is missing. Please generate a key first.");
        return;
      }
      if (!connInfo.remotePort || isNaN(Number(connInfo.remotePort))) {
        setTunnelStatus("Error: Remote SSH port is invalid.");
        toast.error("Remote SSH port is invalid.");
        return;
      }
      if (!connInfo.localPort || isNaN(Number(connInfo.localPort))) {
        setTunnelStatus("Error: Local port is invalid.");
        toast.error("Local port is invalid.");
        return;
      }
      if (!connInfo.backendPort || isNaN(Number(connInfo.backendPort))) {
        setTunnelStatus("Error: Remote backend port is invalid.");
        toast.error("Remote backend port is invalid.");
        return;
      }
      const result = await ipcRenderer.invoke('start-ssh-tunnel', connInfo);
      if (result && result.success) {
        setTunnelStatus("SSH tunnel established!");
        setTunnelActive(true);
        setReconnectAttempts(0);
        toast.success("SSH tunnel established and ready.");
        setTunnelInfo({
          tunnelActive: true,
          localAddress: "localhost",
          localPort: connInfo.localPort,
          remoteHost: connInfo.host,
          remotePort: connInfo.remotePort,
          backendPort: connInfo.backendPort,
          username: connInfo.username,
        });
        setTunnelState({
          tunnelActive: true,
          localAddress: "localhost",
          localPort: connInfo.localPort,
          remoteHost: connInfo.host,
          remotePort: connInfo.remotePort,
          backendPort: connInfo.backendPort,
          username: connInfo.username,
        });
        onConnect && onConnect({ ...connInfo, publicKey });
      } else if (result && result.error) {
        setTunnelStatus("Failed to establish SSH tunnel: " + result.error);
        setTunnelActive(false);
        setReconnectAttempts((prev) => prev + 1);
        toast.error("Tunnel failed: " + result.error);
      } else {
        setTunnelStatus("Failed to establish SSH tunnel: Unknown error.");
        setTunnelActive(false);
        setReconnectAttempts((prev) => prev + 1);
        toast.error("Tunnel Failed, Unknown error.");
      }
    } catch (err) {
      let errorMsg = err && err.message ? err.message : String(err);
      if (err && err.stack) {
        errorMsg += "\nStack: " + err.stack;
      }
      setTunnelStatus("Failed to establish SSH tunnel: " + errorMsg);
      setTunnelActive(false);
      setReconnectAttempts((prev) => prev + 1);
      toast.error("Tunnel Failed: " + errorMsg);
    }
  };

  const handleDisconnect = async () => {
    setTunnelStatus("Disconnecting...");
    toast.info("Disconnecting SSH tunnel...");
    try {
      const result = await ipcRenderer.invoke('stop-ssh-tunnel');
      if (result && result.success) {
        setTunnelStatus("SSH tunnel disconnected.");
        setTunnelActive(false);
        setReconnectAttempts(0);
        toast.success("SSH tunnel successfully disconnected.");
        clearTunnelInfo();
        clearTunnelState();
      } else {
        setTunnelStatus("Failed to disconnect tunnel: " + (result?.error || 'Unknown error'));
        toast.error("Disconnect Failed: " + result?.error || 'Unknown error');
      }
    } catch (err) {
      setTunnelStatus("Failed to disconnect tunnel: " + (err.message || err));
      toast.error("Disconnect Failed: ", err.message || String(err));
    }
  };

  useEffect(() => {
    // When modal opens and username is set, check for existing SSH key (do NOT generate)
    if (visible && username) {
      (async () => {
        try {
          const result = await ipcRenderer.invoke('get-ssh-key', { username });
          if (result && result.publicKey && result.privateKey) {
            setPublicKey(result.publicKey);
            setPrivateKey(result.privateKey);
            setKeyGenerated(!!result.publicKey);
          } else {
            setPublicKey("");
            setPrivateKey("");
            setKeyGenerated(false);
          }
        } catch {
          setPublicKey("");
          setPrivateKey("");
          setKeyGenerated(false);
        }
      })();
    }
    // Optionally clear key if modal is closed
    if (!visible) {
      setKeyGenerated(false);
      setPublicKey("");
      setPrivateKey("");
    }
  }, [visible, username, keyComment]);

  return (
    <Dialog className="modal" visible={visible} style={{ width: "50vw" }} closable={closable} onHide={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2>SSH Tunnel Connection</h2>
        <label>
          Remote Host:
          <input type="text" value={host} onChange={e => setHost(e.target.value)} placeholder="e.g. example.com" />
        </label>
        <label>
          Username:
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="SSH username" />
        </label>
        <label>
          Password:
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="SSH password" />
        </label>
        <label>
          Remote SSH Port:
          <input type="number" value={remotePort} onChange={e => setRemotePort(e.target.value)} placeholder="22" />
        </label>
        <label>
          Local Port:
          <input type="number" value={localPort} onChange={e => setLocalPort(e.target.value)} placeholder="8888" />
        </label>
        <label>
          Remote Backend Port:
          <input type="number" value={backendPort} onChange={e => setBackendPort(e.target.value)} placeholder="8888" />
        </label>
        <label>
          SSH Key Comment:
          <input type="text" value={keyComment} onChange={e => setKeyComment(e.target.value)} placeholder="medomicslab-app" />
        </label>
        <button onClick={handleGenerateKey} disabled={keyGenerated} style={{ background: keyGenerated ? '#ccc' : '#007ad9', color: 'white' }}>
          {keyGenerated ? 'Key Generated' : 'Generate SSH Key'}
        </button>
        {keyGenerated && (
          <div>
            <strong>Public Key:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f4f4f4', padding: '0.5em' }}>{publicKey}</pre>
            {registerStatus && <div style={{ marginTop: '0.5em', color: registerStatus.includes('success') ? 'green' : 'red' }}>{registerStatus}</div>}
          </div>
        )}
        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
          <button onClick={onClose}>Close</button>
          <button onClick={() => handleConnect()} style={{ background: "#007ad9", color: "white" }} disabled={tunnelActive}>Connect</button>
          {tunnelActive && (
            <button onClick={handleDisconnect} style={{ background: "#d9534f", color: "white" }}>Disconnect</button>
          )}
        </div>
        {tunnelStatus && (
          <div style={{ marginTop: '0.5em', color: tunnelStatus.includes('established') ? 'green' : tunnelStatus.includes('Reconnecting') ? 'orange' : 'red' }}>{tunnelStatus}</div>
        )}
      </div>
    </Dialog>
  );
}

export default ConnectionModal
