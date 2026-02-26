import React, { useState, useContext, useEffect } from "react"
import { LayoutModelContext } from "../layout/layoutContext"
import { Tag } from "primereact/tag"
import { Tooltip } from "primereact/tooltip"
import { Button } from "primereact/button"
import { IoClose } from "react-icons/io5"
import { getId } from "../../utilities/staticFunctions"
import { Stack } from "react-bootstrap"
import { Card } from "primereact/card"
import Input from "../learning/input"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { getTunnelState } from "../../utilities/tunnelState"

/**
 *
 * @param {String} uniqueId The unique id of the process
 * @param {String} pageId The page id
 * @param {Number} port The port of the backend
 * @param {Function} setError The function to set the error
 * @param {Function} onDelete The function to delete the process
 *
 * @returns A card with the D-Tale module
 */
const DTaleProcess = ({ uniqueId, pageId, setError, onDelete }) => {
  const [mainDataset, setMainDataset] = useState()
  const [mainDatasetHasWarning, setMainDatasetHasWarning] = useState({ state: false, tooltip: "" })
  const [isCalculating, setIsCalculating] = useState(false)
  const [serverPath, setServerPath] = useState("")
  const { dispatchLayout } = useContext(LayoutModelContext)
  const { workspace } = useContext(WorkspaceContext)
  const [name, setName] = useState("")

  const resolveExpressPort = async (isRemoteMode) => {
    const tunnel = getTunnelState()
    if (isRemoteMode && tunnel?.tunnelActive && tunnel.localExpressPort) {
      return Number(tunnel.localExpressPort)
    }
    const expressPort = await window.backend.getExpressPort()
    return Number(expressPort)
  }

  const resolveLocalDtaleUrl = async (requestId, remotePort, isRemoteMode) => {
    if (!isRemoteMode) {
      return `http://127.0.0.1:${remotePort}/`
    }

    const tunnelName = `dtale-${requestId}`
    const startRes = await window.backend.startPortTunnel({
      name: tunnelName,
      localPort: 0,
      remotePort: Number(remotePort),
      ensureRemoteOpen: true
    })

    let localPort = startRes?.localPort
    if (!localPort) {
      const tunnel = getTunnelState()
      const existing = (tunnel?.tunnels || []).find((entry) => entry.name === tunnelName && entry.status === "forwarding")
      localPort = existing?.localPort
    }
    if (!localPort) {
      throw new Error("Failed to resolve local D-Tale tunnel port")
    }
    return `http://127.0.0.1:${localPort}/`
  }

  /**
   *
   * @param {String} serverPath The server path
   * @description This function is used to shutdown the dtale server
   */
  const shutdownDTale = async () => {
    try {
      const isRemoteMode = !!workspace?.isRemote
      const expressPort = await resolveExpressPort(isRemoteMode)
      await window.backend.requestExpress({
        method: "post",
        port: expressPort,
        path: "/exploratory/dtale/stop",
        body: { requestId: uniqueId }
      })
      if (isRemoteMode) {
        await window.backend.stopPortTunnel({ name: `dtale-${uniqueId}` })
      }
    } catch (error) {
      console.warn("Error while stopping D-Tale service:", error)
    }
  }

  /**
   * @description This function is used to open the html viewer with the given file path
   */
  const generateReport = () => {
    setIsCalculating(true)
    setServerPath("")
    ;(async () => {
      try {
        await shutdownDTale()
        const isRemoteMode = !!workspace?.isRemote
        const expressPort = await resolveExpressPort(isRemoteMode)
        const response = await window.backend.requestExpress({
          method: "post",
          port: expressPort,
          path: "/exploratory/dtale/start",
          body: {
            requestId: uniqueId,
            pageId,
            dataset: mainDataset.value
          },
          timeout: 180000
        })
        const payload = response?.data || {}
        if (!payload.success) {
          throw new Error(payload.error || "Failed to start D-Tale")
        }
        const localUrl = await resolveLocalDtaleUrl(uniqueId, payload.remotePort, isRemoteMode)
        setServerPath(localUrl)
        setName(payload.name || mainDataset.value.name)
      } catch (error) {
        console.error(error)
        setError(error?.message || "Failed to start D-Tale")
      } finally {
        setIsCalculating(false)
      }
    })()
  }

  /**
   *
   * @param {String} urlPath The url path to open
   * @param {String} uniqueId The unique id of the process
   */
  const handleOpenWebServer = (urlPath, uniqueId) => {
    dispatchLayout({ type: "openInIFrame", payload: { path: urlPath, name: name, id: uniqueId } })
  }
  return (
    <>
      <div className="data-with-warning">
        {mainDatasetHasWarning.state && (
          <>
            <Tag className={`main-dataset-warning-tag-${pageId}`} icon="pi pi-exclamation-triangle" severity="warning" value="" rounded data-pr-position="left" data-pr-showdelay={200} />
            <Tooltip target={`.main-dataset-warning-tag-${pageId}`} autoHide={false}>
              <span>{mainDatasetHasWarning.tooltip}</span>
            </Tooltip>
          </>
        )}
        <div className="input-btn-group">
          <Input
            name="Choose main dataset"
            settingInfos={{ type: "data-input", tooltip: "" }}
            currentValue={mainDataset && mainDataset.value.id}
            onInputChange={(data) => setMainDataset(data)}
            setHasWarning={setMainDatasetHasWarning}
          />
          <Button onClick={generateReport} className="btn btn-primary" label="Generate report" icon="pi pi-chart-bar" iconPos="right" disabled={!mainDataset || mainDatasetHasWarning.state} />
          {serverPath && <Button onClick={() => handleOpenWebServer(serverPath, uniqueId)} className="btn btn-primary" label="Open D-Tale" icon="pi pi-table" iconPos="right" severity="success" />}
          <IoClose
            className="btn-close-output-card"
            onClick={() => {
              onDelete(uniqueId)
              shutdownDTale()
            }}
          />
        </div>
      </div>
      {isCalculating && <div style={{ fontSize: "0.9rem", opacity: 0.85 }}>Starting D-Tale service...</div>}
    </>
  )
}

/**
 *
 * @param {String} pageId The page id
 * @param {Number} port The port of the backend
 * @param {Function} setError The function to set the error
 *
 * @returns the exploratory page with the module page
 */
const DTale = ({ pageId, setError }) => {
  const [processes, setProcesses] = useState([])

  // when the component is mounted, add a new process
  useEffect(() => {
    handleAddDTaleComp()
  }, [])

  // when the processes change, log them
  useEffect(() => {
    console.log("processes", processes)
  }, [processes])

  /**
   *
   * @param {String} uniqueId The unique id of the process
   */
  const onDelete = (uniqueId) => {
    console.log("deleting", uniqueId)
    let newProcesses = []
    processes.forEach((processId) => {
      if (processId != uniqueId) {
        newProcesses.push(processId)
      }
    })
    console.log("newProcesses", newProcesses)
    setProcesses(newProcesses)
  }

  /**
   * @description This function is used to add a new process
   */
  const handleAddDTaleComp = () => {
    let newId = getId()
    console.log(newId)
    processes.push(newId)
    setProcesses([...processes])
  }

  return (
    <Card
      title={
        <>
          <div className="p-card-title">
            <a
              className="web-server-link"
              onClick={() => {
                require("electron").shell.openExternal("https://github.com/man-group/dtale")
              }}
            >
              D-Tale
            </a>
          </div>
        </>
      }
    >
      <Stack gap={2}>
        {processes.map((id) => (
          <DTaleProcess onDelete={onDelete} uniqueId={id} key={id} pageId={pageId} setError={setError} />
        ))}
        <Button className="add-compare" label="Add new D-Tale analysis" onClick={handleAddDTaleComp} />
      </Stack>
    </Card>
  )
}

export default DTale
