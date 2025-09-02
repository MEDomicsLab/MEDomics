import React, { useEffect, useState, useContext, useRef } from "react"
import ModulePage from "./moduleBasics/modulePage"
import dynamic from "next/dynamic"

// Dynamically import with SSR disabled
const SyntaxHighlighter = dynamic(() => import("react-syntax-highlighter").then((mod) => mod.Prism), { ssr: false })

import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism"

import { IoCopyOutline } from "react-icons/io5"
import { MdOutlineSaveAlt } from "react-icons/md"
import { FaWindows, FaApple, FaAngleRight } from "react-icons/fa"
import { FcLinux } from "react-icons/fc"
import { IoMdKey } from "react-icons/io"
import { IoIosSend } from "react-icons/io"
import EmailSection from "../medfl/rw/MailSection"
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa"
import Path from "path"
import { EXPERIMENTS } from "../workspace/workspaceContext"
import { DataContext, UUID_ROOT } from "../workspace/dataContext"
import MedDataObject from "../workspace/medDataObject"

const MEDflrwConfig = ({ pageId, configPath = "" }) => {
  const { globalData } = useContext(DataContext)

  const [displayWelcomeMessage, setWelcomeMessage] = useState(configPath != "" ? false : true)

  const [flFlowType, setFlFlowType] = useState("fl") // this state has been implemented because of subflows implementation

  const [serverIP, setServerIP] = useState("123.22.32.1")
  const [port, setPort] = useState("8080")
  const [differentialPrivacy, setDifferentialPrivacy] = useState(true)
  const [repoUrl, setRepoUrl] = useState("https://github.com/ouaelesi/flower_test.git")
  const [os, setOS] = useState("linux")
  const [generatedScript, setGeneratedScript] = useState("")
  const [authKey, setAuthKey] = useState("")
  const [showEmailSection, setShowEmailSection] = useState(false)
  const [showScript, setShowScript] = useState(false)

  const getOsIcon = (os) => {
    if (os.includes("win")) return <FaWindows size={20} />
    if (os.includes("mac") || os.includes("apple") || os.includes("darwin"))  return <FaApple size={20} />
    if (os.includes("linux")) return <FcLinux size={23} />
    return null
  }

  const codeRef = useRef(null)

  useEffect(() => {
    generateScript()
  }, [serverIP, port, differentialPrivacy, repoUrl, os, authKey])

  useEffect(() => {
    if (codeRef.current && generatedScript) {
      // Create a custom dark theme similar to VS Code
      const customDarkTheme = `
        pre.prism-code {
          background: #1e1e1e !important;
          color: #d4d4d4 !important;
          border-radius: 4px;
          padding: 16px;
          overflow: auto;
          max-height: 70vh;
          font-family: 'Fira Code', 'Consolas', monospace;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .token.comment { color: #6a9955 !important; }
        .token.keyword { color: #c586c0 !important; }
        .token.function { color: #dcdcaa !important; }
        .token.string { color: #ce9178 !important; }
        .token.operator { color: #d4d4d4 !important; }
        .token.punctuation { color: #d4d4d4 !important; }
        .token.variable { color: #9cdcfe !important; }
        .token.builtin { color: #4ec9b0 !important; }
      `

      // Add custom theme to document head
      const style = document.createElement("style")
      style.textContent = customDarkTheme
      document.head.appendChild(style)

      // Highlight code
      Prism.highlightElement(codeRef.current)

      return () => {
        // Clean up style element
        document.head.removeChild(style)
      }
    }
  }, [generatedScript])

  const generateScript = () => {
    const script = {
      linux: `#!/bin/bash

set -e

echo "[INFO] Updating system and installing dependencies..."

# Install jq if not present
if ! command -v jq &> /dev/null; then
  echo "[INFO] Installing jq..."
  sudo apt update && sudo apt install -y jq
fi

# Install git
if ! command -v git &> /dev/null; then
  echo "[INFO] Installing Git..."
  sudo apt update && sudo apt install -y git
fi

# Install Python
sudo apt update
sudo apt install -y python3 python3-venv python3-pip

# Install Tailscale
if ! command -v tailscale &> /dev/null; then
  echo "[INFO] Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sh
else
  echo "[INFO] Tailscale already installed."
fi

# Tailscale authentication
AUTH_KEY="${authKey}"
echo "[INFO] Connecting to Tailscale..."
sudo tailscale up --authkey "$AUTH_KEY" || { echo "[ERROR] tailscale up failed."; exit 1; }

echo "[INFO] Waiting for Tailscale..."
for i in {1..30}; do
  IS_ONLINE=$(tailscale status --json | jq -r '.Self.Online')
  if [ "$IS_ONLINE" == "true" ]; then
    echo "[SUCCESS] Tailscale online!"
    break
  fi
  sleep 2
done

if [ "$IS_ONLINE" != "true" ]; then
  echo "[ERROR] Tailscale failed"
  exit 1
fi

# Get IP
tailscale ip -4

# Clone repo
REPO_URL="${repoUrl}"
CLONE_DIR="flower-client"

if [ ! -d "$CLONE_DIR" ]; then
  echo "[INFO] Cloning repo..."
  git clone "$REPO_URL" "$CLONE_DIR"
else
  echo "[INFO] Updating repo..."
  cd "$CLONE_DIR"
  git pull
  cd ..
fi

cd "$CLONE_DIR"

# Setup Python env
echo "[INFO] Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo "[INFO] Installing packages..."
pip install --upgrade pip
pip install flwr torch torchvision${differentialPrivacy ? "\npip install differential-privacy" : ""}

# Run client
echo "[INFO] Starting client..."
python3 client.py --server-address ${serverIP} --server-port ${port}
`,

      windows: `# PowerShell Script

Write-Host "Initializing setup..."

# Install chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install dependencies
choco install -y git python jq

# Install Tailscale
$tailscaleUrl = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
$installerPath = "$env:TEMP\\tailscale-installer.exe"
Invoke-WebRequest -Uri $tailscaleUrl -OutFile $installerPath
Start-Process -FilePath $installerPath -Args "/S" -Wait

# Authenticate Tailscale
$authKey = "${authKey}"
Start-Process "tailscale" -ArgumentList "up --authkey $authKey" -Verb RunAs -Wait

# Clone repo
$repoUrl = "${repoUrl}"
$cloneDir = "flower-client"

if (-Not (Test-Path $cloneDir)) {
  git clone $repoUrl $cloneDir
}
else {
  Set-Location $cloneDir
  git pull
  Set-Location ..
}

# Python setup
python -m venv venv
.\\venv\\Scripts\\activate

pip install --upgrade pip
pip install flwr torch torchvision${differentialPrivacy ? "`npip install differential-privacy" : ""}

# Start client
python client.py --server-address ${serverIP} --server-port ${port}
`,

      macos: `#!/bin/bash

echo "[INFO] Setting up macOS environment..."

# Install Homebrew if not installed
if ! command -v brew &> /dev/null; then
  echo "[INFO] Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install dependencies
brew install jq git python

# Install Tailscale
if ! command -v tailscale &> /dev/null; then
  echo "[INFO] Installing Tailscale..."
  brew install tailscale
fi

# Start Tailscale
sudo tailscale up --authkey ${authKey}

# Clone repo
REPO_URL="${repoUrl}"
CLONE_DIR="flower-client"

if [ ! -d "$CLONE_DIR" ]; then
  git clone "$REPO_URL" "$CLONE_DIR"
else
  cd "$CLONE_DIR"
  git pull
  cd ..
fi

cd "$CLONE_DIR"

# Python setup
python3 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install flwr torch torchvision${differentialPrivacy ? "\npip install differential-privacy" : ""}

# Run client
python3 client.py --server-address ${serverIP} --server-port ${port}
`
    }

    setGeneratedScript(script[os])
  }

  const styles = {
    container: {
      display: "flex",
      // gridTemplateColumns: "1fr 1fr",
      gap: "2rem",
      padding: "2rem",
      height: "85vh",
      backgroundColor: "#ffffff",
      color: "#333333"
    },
    configPanel: {
      backgroundColor: "transparent",
      padding: "1.5rem",
      // borderRadius: "8px",
      // boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      // border: "1px solid #e9ecef",
      width: "100%"
    },
    formGroup: {
      marginBottom: "1.5rem"
    },
    label: {
      display: "block",
      marginBottom: "0.5rem",
      fontWeight: "500",
      color: "#495057"
    },
    input: {
      width: "100%",
      padding: "0.5rem",
      backgroundColor: "#ffffff",
      border: "1px solid #ced4da",
      color: "#212529",
      borderRadius: "4px",
      fontSize: "14px"
    },
    button: {
      color: "black",
      border: "none",
      padding: "0.5rem 0.5rem",
      borderRadius: "4px",
      cursor: "pointer",
      transition: "background 0.2s",
      fontSize: "14px",
      ":hover": {
        backgroundColor: "#0056b3"
      }
    },
    scriptPreview: {
      backgroundColor: "#ffffff",
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid #e9ecef",
      width: "100%"
    },
    scriptHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "1rem",
      backgroundColor: "#f8f9fa",
      borderBottom: "1px solid #e9ecef"
    }
  }

  const saveScript = async () => {
    try {
      let path = Path.join(globalData[UUID_ROOT].path, EXPERIMENTS)

      MedDataObject.createFolderFromPath(path + "/Scripts")

      const fileName = os + "_script"
      // do custom actions in the folder while it is unzipped
      await MedDataObject.writeFileSync(generatedScript, path + "/Scripts", fileName, os == "windows" ? "bat" : "sh")

      toast.success("Script saved successfuly ")
    } catch {
      toast.error("Something went wrong ")
    }
  }
  return (
    <>
      <ModulePage pageId={pageId} configPath={configPath}>
        <EmailSection show={showEmailSection} onHide={() => setShowEmailSection(false)} os={os} script={generatedScript} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingRight: 16 }}>
          <div style={{ fontSize: 34, fontWeight: 600, marginBottom: 16, marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>Script configuration</div>
          <button className="btn btn-primary">
            Manage clients <FaAngleRight size={18} />
          </button>
        </div>
        <div className="container" style={styles.container}>
          <div className="config-panel" style={styles.configPanel}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h1>Script Configuration</h1>
              <button className="btn" onClick={() => setShowScript(!showScript)}>
                {!showScript ? (
                  <div className="d-flex gap-1 align-items-center">
                    Preview script
                    <FaRegEye size={20} />{" "}
                  </div>
                ) : (
                  <div className="d-flex gap-1 align-items-center">
                    {" "}
                    Hide script
                    <FaRegEyeSlash size={20} />{" "}
                  </div>
                )}
              </button>
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Server IP:</label>
              <input style={styles.input} type="text" value={serverIP} onChange={(e) => setServerIP(e.target.value)} placeholder="Enter server IP" />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Port:</label>
              <input style={styles.input} type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="Enter port number" />
            </div>
            <div className="form-group" style={styles.formGroup}>
              <button
                className="btn btn-secondary d-flex gap-1 mb-2"
                onClick={() => {
                  setAuthKey(Math.random().toString(36).substring(2, 15))
                }}
              >
                <IoMdKey size={20} />
                Generate key
              </button>
              {/* <label style={styles.label}>Auth key:</label> */}
              <input style={styles.input} type="text" value={authKey} onChange={(e) => setAuthKey(e.target.value)} placeholder="Enter the authentication key" />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>
                <input style={{ marginRight: 15 }} type="checkbox" checked={differentialPrivacy} onChange={(e) => setDifferentialPrivacy(e.target.checked)} />
                Enable Differential Privacy
              </label>
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>GitHub Repo URL:</label>
              <input style={styles.input} type="url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="Enter repository URL" />
            </div>

            <div className="form-group" style={styles.formGroup}>
              <label style={styles.label}>Operating System:</label>
              <div className="gap-2 d-flex">
                <button className={`${os == "windows" ? "border-primary bg-opacity-20 btn-primary" : ""} btn w-100 border`} onClick={() => setOS("windows")}>
                  {getOsIcon("win")}
                </button>
                <button className={`${os == "linux" ? "border-primary bg-opacity-20 btn-primary" : ""} btn w-100 border`} onClick={() => setOS("linux")}>
                  {getOsIcon("linux")}
                </button>
                <button className={`${os == "macos" ? "border-primary bg-opacity-20 btn-primary" : ""} btn w-100 border`} onClick={() => setOS("macos")}>
                  {getOsIcon("mac")}
                </button>
              </div>
              <div style={{ marginTop: "100px" }}>
                  <button
                className="btn btn-primary   mt-auto d-flex gap-1 px-5"
                onClick={() => setShowEmailSection(true)}
                style={{ marginLeft: "auto", width: "fit-content", display: "block", marginTop: "" }}
              >
                <IoIosSend size={20} />
                Send Script xzs
              </button></div>
          
            </div>
          </div>

          {showScript && (
            <div className="script-preview" style={styles.scriptPreview}>
              <div className="script-header" style={styles.scriptHeader}>
                <h2>{getOsIcon(os)} Installation Script</h2>
                <div className="gap-2 d-flex">
                  <button style={styles.button} onClick={() => navigator.clipboard.writeText(generatedScript)}>
                    <IoCopyOutline />
                  </button>
                  <button style={styles.button} onClick={() => saveScript()}>
                    <MdOutlineSaveAlt />
                  </button>
                  <button style={styles.button} onClick={() => setShowEmailSection(true)}>
                    <IoIosSend />
                  </button>
                </div>
              </div>
              <SyntaxHighlighter language="bash" style={vscDarkPlus} customStyle={{ maxHeight: "70vh" }}>
                {generatedScript}
              </SyntaxHighlighter>
              {/* 
              <pre
                className="language-bash"
                style={{
                  maxHeight: "70vh",
                  overflow: "auto",
                  padding: "1rem",
                  borderRadius: "0.25rem",
                  backgroundColor: "black",
                }}
              >
                <code ref={codeRef} className="language-bash" style={{ backgroundColor: "#000" }}>

                  {generatedScript}
                </code>
              </pre> */}
              {/* <LiveEditor
  code={generatedScript}
  language="bash"
  theme={nightOwl}
  style={{ 
    maxHeight: "70vh",
    overflow: "auto",
    borderRadius: "0.25rem"
  }}
  disabled // Makes it read-only
/> */}
            </div>
          )}
        </div>{" "}
      </ModulePage>
    </>
  )
}

export default MEDflrwConfig
