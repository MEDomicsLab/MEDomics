import React, { useContext, useEffect, useRef, useState } from "react"
import Image from "next/image"
import myimage from "../../../resources/medomics_transparent_bg.png"
import { Button, Stack } from "react-bootstrap"
import { ProgressBar } from "primereact/progressbar"
import { ProgressSpinner } from "primereact/progressspinner"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { ipcRenderer } from "electron"
import FirstSetupModal from "../generalPurpose/installation/firstSetupModal"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import { insertMEDDataObjectIfNotExists, findMEDDataObjectByName } from "../mongoDB/mongoDBUtils"
import { randomUUID } from "crypto"
import { requestBackend } from "../../utilities/requests"
import { ServerConnectionContext } from "../serverConnection/connectionContext"
import { toast } from "react-toastify"
import { FaRegQuestionCircle } from "react-icons/fa";
import ConnectionModal from "./connectionModal"

/**
 * @returns the home page component
 */
const HomePage = () => {
  const { workspace, setWorkspace, recentWorkspaces } = useContext(WorkspaceContext)
  const [hasBeenSet, setHasBeenSet] = useState(workspace.hasBeenSet)
  const [appVersion, setAppVersion] = useState("")
  const [sampleGenerated, setSampleGenerated] = useState(false)
  const { port } = useContext(ServerConnectionContext)
  const [showConnectionModal, setShowConnectionModal] = useState(false)


  const [requirementsMet, setRequirementsMet] = useState(true)
  // Local backend presence (Express/GO orchestration) check
  const [localBackend, setLocalBackend] = useState({ checking: true, installed: false, detail: null })
  const localBackendPollRef = useRef(null)
  const [installState, setInstallState] = useState({ active: false, phase: '', percent: 0, speed: 0 })

  const checkLocalBackendNow = async () => {
    try {
      const res = await ipcRenderer.invoke('checkLocalBackend')
      setLocalBackend({ checking: false, installed: !!(res && res.installed), detail: res })
    } catch {
      // If the check fails, don't flip UI into a blocked state indefinitely; assume installed=true to avoid hard lock
      toast.error('Error checking local server installation status')
      setLocalBackend(prev => ({ ...prev, checking: false }))
    }
  }

  async function handleWorkspaceChange() {
    ipcRenderer.send("messageFromNext", "requestDialogFolder")
  }

  const generateSampleData = async () => {
    // Create a new MEDDataObject with the sample data
    const sampleID = randomUUID()
    const object = new MEDDataObject({
      id: sampleID,
      name: "SampleData.csv",
      type: "csv",
      parentID: "DATA",
      childrenIDs: [],
      inWorkspace: false
    })

    const jsonToSend = {
      datasetRequested: "diabetes", // Choose which dataset to generate from pycaret
      newSampleID: sampleID
    }

    // Request the creation of the sample data to the go server
    requestBackend(
      port,
      "/input/generate_sample_data/",
      jsonToSend,
      async (jsonResponse) => {
        if (jsonResponse.error) {
          if (jsonResponse.error.message) {
            console.error("Sample data generating error: ", jsonResponse.error.message)
            toast.error(jsonResponse.error.message)
          } else {
            console.error("Sample data generating error: ", jsonResponse.error)
            toast.error(jsonResponse.error)
          }
        } else {
          // Insert the MEDDataObject in the mongoDB database
          await insertMEDDataObjectIfNotExists(object)
          MEDDataObject.updateWorkspaceDataObject()
          setSampleGenerated(true)
          toast.success("Sample data generated successfully.")
        }
      },
      (error) => {
        console.log(error)
        toast.error("Error generating sample data :", error)
      }
    )
  }

  // Check if the requirements are met
  useEffect(() => {
    // Initial local backend presence check (stub-aware)
    checkLocalBackendNow()

    ipcRenderer.invoke("checkRequirements").then((data) => {
      console.log("Requirements: ", data)
      if (data && data.result && data.result.pythonInstalled && data.result.mongoDBInstalled) {
        setRequirementsMet(true)
      } else {
        setRequirementsMet(false)
      }
    })
    ipcRenderer.invoke("getAppVersion").then((data) => {
      setAppVersion(data)
    })
  }, [])

  // Auto-refresh local install status: poll until installed, and refresh on window focus
  useEffect(() => {
    // Listen for installer progress events to surface success toasts
    const onProgress = (_event, payload) => {
      try {
        if (!payload || !payload.phase) return
        // Map phases to progress bands
        const bands = {
          download: { start: 0, end: 70 },
          verify: { start: 70, end: 80 },
          extract: { start: 80, end: 95 },
          finalize: { start: 95, end: 100 }
        }

        const setActive = () => setInstallState(prev => ({ ...prev, active: true }))
        const setPhase = (phase) => setInstallState(prev => ({ ...prev, phase }))

        switch (payload.phase) {
          case 'fetch-manifest':
          case 'github-fetch-releases':
          case 'github-pick-release':
          case 'github-select-asset':
          case 'download-start':
            setActive(); setPhase('download')
            setInstallState(prev => ({ ...prev, percent: bands.download.start }))
            break
          case 'download-progress': {
            setActive(); setPhase('download')
            const raw = Number(payload.percent || 0)
            const pct = Math.max(0, Math.min(100, raw))
            const mapped = bands.download.start + (bands.download.end - bands.download.start) * (pct / 100)
            const speed = Number(payload.speed || 0)
            setInstallState(prev => ({ ...prev, percent: mapped, speed }))
            break
          }
          case 'download-complete':
            setActive(); setPhase('verify')
            setInstallState(prev => ({ ...prev, percent: bands.download.end }))
            break
          case 'verify-start':
            setActive(); setPhase('verify')
            setInstallState(prev => ({ ...prev, percent: bands.verify.start }))
            break
          case 'verify-ok':
          case 'verify-skip':
            setActive(); setPhase('extract')
            setInstallState(prev => ({ ...prev, percent: bands.verify.end }))
            break
          case 'extract-start':
            setActive(); setPhase('extract')
            setInstallState(prev => ({ ...prev, percent: bands.extract.start }))
            break
          case 'extract-complete':
            setActive(); setPhase('finalize')
            setInstallState(prev => ({ ...prev, percent: bands.extract.end }))
            break
          case 'done':
          toast.success('Local server installed and ready.')
          // Refresh local backend status immediately
          checkLocalBackendNow()
            setInstallState({ active: false, phase: '', percent: 0, speed: 0 })
        }
      } catch(e) {
        console.error("Error handling localBackendInstallProgress event:", e)
      }
    }
    ipcRenderer.on('localBackendInstallProgress', onProgress)

    // Always clear any existing poller first
    if (localBackendPollRef.current) {
      clearInterval(localBackendPollRef.current)
      localBackendPollRef.current = null
    }

    const onFocus = () => {
      // On focus, do a quick re-check (useful if user completed install outside the app)
      checkLocalBackendNow()
    }

    window.addEventListener('focus', onFocus)

    if (!localBackend.installed) {
      // Poll every 5s until installed; lightweight IPC call
      localBackendPollRef.current = setInterval(() => {
        checkLocalBackendNow()
      }, 5000)
    }

    return () => {
      window.removeEventListener('focus', onFocus)
      if (localBackendPollRef.current) {
        clearInterval(localBackendPollRef.current)
        localBackendPollRef.current = null
      }
      try { ipcRenderer.removeListener('localBackendInstallProgress', onProgress) } catch(e) {
        console.error("Error removing localBackendInstallProgress listener:", e)
      }
    }
  }, [localBackend.installed])

  // We set the workspace hasBeenSet state
  useEffect(() => {
    const checkDataSampleExists = async () => {
      findMEDDataObjectByName("SampleData.csv").then((data) => {
        if (data) {
          setSampleGenerated(true)
        } else {
          console.log("Sample data not found")
          setSampleGenerated(false)
        }
      })
    }

    if (workspace.hasBeenSet == false) {
      setHasBeenSet(true)
    } else {
      setHasBeenSet(false)
      setTimeout(() => { // Small delay to prevent the check from re-enabling the button after generating
        checkDataSampleExists().then(() => { console.log("Data sample checked") })
      }, 1000)
    }
  }, [workspace])

  // We set the recent workspaces -> We send a message to the main process to get the recent workspaces, the workspace context will be updated by the main process in _app.js
  useEffect(() => {
    ipcRenderer.invoke("checkRequirements").then((data) => {
      if (!data) {
        return
      }
      setRequirementsMet(data.result.pythonInstalled && data.result.mongoDBInstalled)
    })
  }, [])

  useEffect(() => {
    setHasBeenSet(!workspace.hasBeenSet)
  }, [workspace])

  useEffect(() => {
    ipcRenderer.send("messageFromNext", "getRecentWorkspaces")
  }, [])

  const handleRemoteConnect = () => {
    toast.success("Connected to remote workspace!");
  };

  const handleInstallLocalBackend = async () => {
    try {
      const res = await ipcRenderer.invoke('installLocalBackendFromURL', { version: null })
      if (res && res.success) {
        toast.success('Local server installed.')
      } else {
        toast.info(res?.error || 'Installer not available yet')
      }
    } catch (e) {
      toast.error(e?.message || String(e))
    } finally {
      const chk = await ipcRenderer.invoke('checkLocalBackend')
      setLocalBackend({ checking: false, installed: !!(chk && chk.installed), detail: chk })
    }
  }

  const handleLocateLocalBackend = async () => {
    try {
      const pick = await ipcRenderer.invoke('open-dialog-backend-exe')
      if (pick && pick.success && pick.path) {
        const setRes = await ipcRenderer.invoke('setLocalBackendPath', pick.path)
        if (setRes && setRes.success) toast.success('Server path saved.')
      }
    } catch (e) {
      toast.error(e?.message || String(e))
    } finally {
      const chk = await ipcRenderer.invoke('checkLocalBackend')
      setLocalBackend({ checking: false, installed: !!(chk && chk.installed), detail: chk })
    }
  }

  return (
    <>
      <div 
        className="container"
        style={{
          paddingTop: "1rem",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          scrollbarColor: "#b0b0b0 #f5f5f5"
        }}
      >
        <Stack direction="vertical" gap={1} style={{ alignContent: "center", flexGrow: 1 }}>
          <h2>Home page</h2>
          <Stack direction="horizontal" gap={0} style={{ alignContent: "center" }}>
            <h1 style={{ fontSize: "5rem" }}>MEDomicsLab </h1>
            <h2 style={{ fontSize: "2rem", marginTop: "1.5rem" }}>v{appVersion}</h2>
            <Image src={myimage} alt="" style={{ height: "175px", width: "175px" }} />
          </Stack>
          {hasBeenSet ? (
            <>
              {/* Local backend install/locate prompt (blocks local workspace until resolved) */}
              {!localBackend.checking && !localBackend.installed && (
                <div style={{
                  width: '100%',
                  background: '#fff3cd',
                  border: '1px solid #ffeeba',
                  borderLeft: '4px solid var(--warning)',
                  borderRadius: 6,
                  padding: '12px 14px',
                  margin: '8px 0 12px 0'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: '#000000' }}>Local server not found!</div>
                  <div style={{ fontSize: 14, color: '#5c5c5c', marginBottom: 10 }}>
                    To work with a local workspace, MEDomicsLab needs its local server. Install it now or locate an existing executable.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button onClick={handleInstallLocalBackend} variant="warning">Install (Download)</Button>
                    <Button onClick={handleLocateLocalBackend} variant="secondary">Locate Executable…</Button>
                  </div>
                  {installState.active && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {(installState.phase === 'verify' || installState.phase === 'extract' || installState.phase === 'finalize') && (
                          <ProgressSpinner style={{ width: '20px', height: '20px' }} strokeWidth="6"/>
                        )}
                        <div style={{ fontSize: 12, color: '#6c757d' }}>
                          {installState.phase === 'download' && `Downloading… ${installState.speed ? `${(installState.speed/1024/1024).toFixed(2)} MB/s` : ''}`}
                          {installState.phase === 'verify' && 'Verifying checksum…'}
                          {installState.phase === 'extract' && 'Extracting files…'}
                          {installState.phase === 'finalize' && 'Finalizing installation…'}
                        </div>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <ProgressBar value={Math.round(installState.percent)} showValue style={{ height: '14px' }}></ProgressBar>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!localBackend.checking && localBackend.installed && (
                <div style={{ display: "flex", flexDirection: "column"}}>
                  <h5>Set up your workspace to get started</h5>
                  <Button onClick={handleWorkspaceChange} style={{ margin: "1rem"}}>
                    Set Workspace
                  </Button>
                  <h5>Or open a recent workspace</h5>
                  <Stack direction="vertical" gap={0} style={{ padding: "0 0 0 0", alignContent: "center", flex: "0 1 auto", marginBottom: "3rem" }}>
                    {recentWorkspaces.map((workspace, index) => {
                      if (index > 4) return
                      return (
                        <a
                        key={index}
                        onClick={() => {
                          if (!localBackend.checking && !localBackend.installed) return
                          ipcRenderer.invoke("setWorkingDirectory", workspace.path).then((data) => {
                            if (workspace !== data) {
                              let workspaceToSet = { ...data }
                              setWorkspace(workspaceToSet)
                            }
                          })
                        }}
                        style={{ margin: "0rem", color: "var(--blue-600)"}}
                        >
                          <h6>{workspace.path}</h6>
                        </a>
                      )
                    })}
                  </Stack>
                </div>
              )}
              <h5>Or connect to a remote workspace</h5>
              <Button onClick={() => setShowConnectionModal(true)} style={{ margin: "1rem" }}>
                Connect to a remote workspace
              </Button>
            </>
          ) : (
            <div className="workspace-set" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <h5>Workspace is set to {workspace.workingDirectory.path}</h5>
              {!sampleGenerated && (
                <div>
                  <Button style={{ marginTop: "0.5rem" }} onClick={generateSampleData}>Import sample data</Button>
                  <FaRegQuestionCircle title="Creates a SampleData.csv file in your workspace filled with a default PyCaret dataset (currently 'Diabetes')" style={{fontSize: "30px", color: "#444", marginTop: "0.5rem", marginLeft: "0.5rem"}} />
                </div>
              )}
            </div>
          )}
        </Stack>

        {/* Getting Started Section (Full Width) */}
        <div
          style={{
            marginTop: "2rem",
            padding: "2rem",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            boxShadow: "0px 2px 5px rgba(0,0,0,0.1)",
            textAlign: "left",
            width: "100%",
          }}
        >
          <h3 style={{ marginBottom: "1rem", color: "#0056b3" }}>
            Getting Started 🚀
          </h3>
          
          <p>
          To effectively navigate MEDomicsLab and its functionalities, we recommend consulting the official documentation and tutorial resources.
          These materials will help you understand how to manage datasets, perform analyses, and evaluate machine learning models within the platform.
          </p>

          <p>We provide dedicated tutorials and documentation to guide you step by step:</p>

          <ul style={{ paddingLeft: "1.5rem", listStyleType: "none" }}>
            <li>📖 Documentation:  
              <a href="https://medomics-udes.gitbook.io/medomicslab-docs/medomicslab-docs-v0/tutorials" 
                 target="_blank" rel="noopener noreferrer" style={{ color: "#0056b3", textDecoration: "none", marginLeft: "5px" }}>
                MEDomicsLab Documentation
              </a>
            </li>

            <li>🎥 Module Tutorials:  
              <a href="https://www.youtube.com/playlist?list=PLEPy2VhC4-D6B7o0MuNNEz2DeHDR8NICj" 
                 target="_blank" rel="noopener noreferrer" style={{ color: "#0056b3", textDecoration: "none", marginLeft: "5px" }}>
                YouTube Module Guides
              </a>
            </li>

            <li>🎥 Testing Phase Tutorials:  
              <a href="https://www.youtube.com/playlist?list=PLEPy2VhC4-D4vuJO3X7fHboLv1k_HbGsW" 
                 target="_blank" rel="noopener noreferrer" style={{ color: "#0056b3", textDecoration: "none", marginLeft: "5px" }}>
                YouTube Playlist
              </a>
            </li>

            </ul>

          {/* Warning section */}
          <div 
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#ffeeba",
            borderLeft: "4px solid #ffc107",
            borderRadius: "5px"
          }}
        >
          ⚠️ <strong>Note:</strong> The Testing Phase offers the first official tutorials of MEDomicsLab, based on the pre-released version launched in January 2024. Despite subsequent improvements, these tutorials are still a valuable starting point for new users.
        </div>

        </div>
      </div>
      {!requirementsMet && process.platform !=="darwin" && <FirstSetupModal visible={!requirementsMet} closable={false} setRequirementsMet={setRequirementsMet} />}
      {showConnectionModal && <ConnectionModal
        visible={showConnectionModal}
        closable={false}
        onClose={() => setShowConnectionModal(false)}
        onConnect={handleRemoteConnect}
      />}

      {!requirementsMet && process.platform !== "darwin" && (
        <FirstSetupModal visible={!requirementsMet} closable={false} setRequirementsMet={setRequirementsMet} />
      )}
    </>
  )
}

export default HomePage
