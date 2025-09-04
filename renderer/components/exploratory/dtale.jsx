import React, { useState, useContext, useEffect } from "react"
import { LayoutModelContext } from "../layout/layoutContext"
import { requestBackend } from "../../utilities/requests"
import { Tag } from "primereact/tag"
import { Tooltip } from "primereact/tooltip"
import { Button } from "primereact/button"
import ProgressBarRequests from "../generalPurpose/progressBarRequests"
import { IoClose } from "react-icons/io5"
import { getId } from "../../utilities/staticFunctions"
import { Stack } from "react-bootstrap"
import { Card } from "primereact/card"
import Input from "../learning/input"

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
const DTaleProcess = ({ uniqueId, pageId, port, setError, onDelete }) => {
  const [mainDataset, setMainDataset] = useState()
  const [mainDatasetHasWarning, setMainDatasetHasWarning] = useState({ state: false, tooltip: "" })
  const [isCalculating, setIsCalculating] = useState(false)
  const [progress, setProgress] = useState({ now: 0, currentLabel: 0 })
  const [serverPath, setServerPath] = useState("")
  const { dispatchLayout } = useContext(LayoutModelContext)
  const [name, setName] = useState("")

  /**
   *
   * @param {String} serverPath The server path
   * @description This function is used to shutdown the dtale server
   */
  const shutdownDTale = (serverPath) => {
    console.log("shutting down dtale: ", serverPath)
    if (serverPath != "") {
      fetch(serverPath + "/shutdown", {
        mode: "no-cors",
        credentials: "include",
        method: "GET"
      })
        .then((response) => console.log(response))
        .catch((error) => console.log(error))
    }
  }

  /**
   * @description This function is used to open the html viewer with the given file path
   */
  const generateReport = () => {
    shutdownDTale(serverPath)
    requestBackend(
      port,
      "removeId/" + uniqueId + "/" + pageId + "-" + mainDataset.value.name,
      { dataset: mainDataset.value },
      (response) => {
        console.log(response)
        setIsCalculating(true)
        setServerPath("")
        requestBackend(
          port,
          "exploratory/start_dtale/" + uniqueId + "/" + pageId + "-" + mainDataset.value.name,
          { dataset: mainDataset.value },
          (response) => {
            console.log(response)
            if (response.error) {
              setError(response.error)
            }
            setServerPath("")
          },
          (error) => {
            console.log(error)
            setIsCalculating(false)
          }
        )
      },
      (error) => {
        console.log(error)
      }
    )
  }

  /**
   *
   * @param {Object} data Data received from the server on progress update
   */
  const onProgressDataReceived = (data) => {
    if (data.web_server_url) {
      setServerPath(data.web_server_url)
      setName(data.name)
      setIsCalculating(false)
    }
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
              shutdownDTale(serverPath)
            }}
          />
        </div>
      </div>
      {isCalculating && (
        <ProgressBarRequests
          delayMS={1000}
          progressBarProps={{ animated: true, variant: "success" }}
          isUpdating={isCalculating}
          setIsUpdating={setIsCalculating}
          progress={progress}
          setProgress={setProgress}
          requestTopic={"exploratory/progress/" + uniqueId + "/" + pageId + "-" + mainDataset.value.name}
          onDataReceived={onProgressDataReceived}
        />
      )}
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
const DTale = ({ pageId, port, setError }) => {
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
          <DTaleProcess onDelete={onDelete} uniqueId={id} key={id} port={port} pageId={pageId} setError={setError} />
        ))}
        <Button className="add-compare" label="Add new D-Tale analysis" onClick={handleAddDTaleComp} />
      </Stack>
    </Card>
  )
}

export default DTale
