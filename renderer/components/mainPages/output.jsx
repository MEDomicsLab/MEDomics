/* eslint-disable no-undef */
import React, { useContext, useEffect, useState } from "react"
import useInterval from "@khalidalansi/use-interval"
import ModulePage from "./moduleBasics/modulePage"
import { requestBackend } from "../../utilities/requests"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { DataContext } from "../workspace/dataContext"
import { SelectButton } from "primereact/selectbutton"
import { Card } from "primereact/card"
import { ProgressBar } from "primereact/progressbar"
import { Tooltip } from "primereact/tooltip"
import MEDconfig from "../../../medomics.dev"
import { IoClose } from "react-icons/io5"
import { PageInfosContext } from "./moduleBasics/pageInfosContext"
import { InputNumber } from "primereact/inputnumber"

/**
 *
 * @param {Object} activeElement the active element to show
 * @returns the active element card
 */
const ActiveElement = ({ activeElement }) => {
  const { globalData } = useContext(DataContext)
  const [metadata, setMetadata] = useState(undefined)
  const { port } = useContext(WorkspaceContext) // we get the port for server connexion
  const { pageId } = useContext(PageInfosContext) // we get the pageId to send to the server

  // handle updating the metadata of the active element when it changes
  useEffect(() => {
    if (globalData) {
      if (activeElement.id in globalData) {
        let element = globalData[activeElement.id]
        if (!("activities" in element)) {
          element.activities = []
        }
        let isActivityAlreadyIn = false
        element.activities.forEach((activity) => {
          if (activity["id"] == activeElement["id"]) {
            isActivityAlreadyIn = true
          }
        })
        !isActivityAlreadyIn && element.activities.push(activeElement)
        let metadata = {
          name: element.name,
          lastModified: element.lastModified,
          activities: element.activities,
          id: element.id,
          urlId: activeElement.urlId,
          absPath: element.path,
          pid: activeElement.pid,
          processState: activeElement.ProcessState,
          progress: activeElement.progress,
          isProgress: activeElement.progress != ""
        }
        setMetadata(metadata)
      } else {
        let metadata = {
          name: activeElement.id,
          urlId: activeElement.urlId,
          pid: activeElement.pid,
          processState: activeElement.ProcessState,
          progress: activeElement.progress,
          isProgress: activeElement.progress != ""
        }
        setMetadata(metadata)
        // toast.error("No element with id: " + activeElement.id + " in globalData")
      }
    }
  }, [activeElement, globalData])

  /**
   *
   * @param {Object} metadata the metadata of the active element
   *
   * @description This function is used to get the output to show depending on the type of the active element
   * @returns the output to show
   */
  const getOutput2Show = (metadata) => {
    if (!metadata) return <></>
    switch (metadata.progress.type) {
      case "dashboard":
        return (
          <>
            {metadata.progress.dashboard_url ? (
              <h5>
                Opened webserver on url:{" "}
                <a
                  className="web-server-link"
                  onClick={() => {
                    require("electron").shell.openExternal(metadata.progress.dashboard_url)
                  }}
                >
                  {metadata.progress.dashboard_url}
                </a>
              </h5>
            ) : (
              <>
                <h5>Dashboard is building... </h5>
                <h6 className="margin-0.25">Approximate duration: {metadata.progress.duration} min</h6>
                <ProgressBar value={metadata.progress.now >= 100 ? 100 : metadata.progress.now} />
              </>
            )}
          </>
        )
      case "webserver":
        return (
          <>
            {metadata.progress.web_server_url ? (
              <h5>
                Opened webserver on url:{" "}
                <a
                  className="web-server-link"
                  onClick={() => {
                    require("electron").shell.openExternal(metadata.progress.web_server_url)
                  }}
                >
                  {metadata.progress.web_server_url}
                </a>
              </h5>
            ) : (
              <>
                <h5>WebServer is building... </h5>
                <h6 className="margin-0.25">Approximate duration: {metadata.progress.duration} min</h6>
                <ProgressBar value={metadata.progress.now >= 100 ? 100 : metadata.progress.now} />
              </>
            )}
          </>
        )
      case "process":
        return (
          <>
            <ProgressBar className={"tooltip-progressBar-" + metadata.id} value={metadata.progress.now >= 100 ? 100 : metadata.progress.now} />
            <Tooltip target={".tooltip-progressBar-" + metadata.id} showDelay={200} position="top">
              {metadata.progress.currentLabel ? metadata.progress.currentLabel : ""}
            </Tooltip>
          </>
        )
      default:
        return (
          <>
            <h5>Gathering informations...</h5>
          </>
        )
    }
  }

  return (
    <>
      {metadata && (
        <Card
          title={
            <>
              {metadata.name}
              <IoClose
                className="btn-close-output-card"
                onClick={() => {
                  let topic = "removeId/" + metadata.urlId
                  if (metadata.name == "D-Tale" && metadata.progress.web_server_url) {
                    topic = metadata.progress.web_server_url + "/shutdown"

                    fetch(topic, {
                      mode: "no-cors",
                      credentials: "include",
                      method: "GET"
                    }).then((response) => console.log(response))
                  } else {
                    requestBackend(
                      port,
                      topic,
                      { pageId: pageId },
                      (data) => {
                        if (data.error) {
                          console.error(data)
                        }
                        console.log("closing", data, "with id:", pageId)
                      },
                      (error) => {
                        console.error(error)
                      }
                    )
                  }
                }}
              />
            </>
          }
          subTitle={
            <>
              {metadata.lastModified && (
                <table>
                  <tbody>
                    <tr>
                      <td style={{ paddingRight: "1rem" }}>Last modified date:</td>
                      <td>{metadata.lastModified}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: "1rem" }}>Path:</td>
                      <td>{metadata.absPath}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </>
          }
        >
          {getOutput2Show(metadata)}
        </Card>
      )}
    </>
  )
}

/**
 *
 * @param {String} pageId the id of the page
 *
 * @returns the output page
 */
const OutputPage = ({ pageId = "output" }) => {
  const { port } = useContext(WorkspaceContext) // we get the port for server connexion
  const [activeElements, setActiveElements] = useState([])
  const [isUpdating, setIsUpdating] = useState(true)
  const options = [
    { action: "Play", icon: "pi pi-Play" },
    { action: "Pause", icon: "pi pi-Pause" }
  ]

  const [value, setValue] = useState(options[0])
  const [requestDelay, setRequestDelay] = useState(2500)

  // handle when the page is mounted and unmounted
  useEffect(() => {
    console.log("OutputPage mounted")
    setIsUpdating(true)
    return () => {
      console.log("OutputPage unmounted")
      setIsUpdating(false)
    }
  }, [])

  // handle periodic request to get the active elements
  useInterval(
    () => {
      requestBackend(
        port,
        "get_server_health",
        { pageId: pageId },
        (data) => {
          let activeElements = []
          Object.keys(data).forEach((key) => {
            let element = JSON.parse(data[key])
            element.progress = element.progress != "" ? JSON.parse(element.progress) : ""
            element.urlId = key
            element.id = key.split("/")[key.split("/").length - 1]
            activeElements.push(element)
          })
          setActiveElements(activeElements)
        },
        () => {
          setIsUpdating(false)
          setValue(options[1])
        }
      )
    },
    isUpdating ? requestDelay : null
  )

  /**
   *
   * @param {Object} option the option of the select button
   * @returns the template of the select button
   */
  const btnTemplate = (option) => {
    return (
      <div className="p-d-flex p-ai-center btn-play-pause">
        <span className="p-text-bold">{option.action}</span>
        <i className={`${option.icon.toLowerCase()}`} />
      </div>
    )
  }

  /**
   *
   * @param {Event} e event of the select button
   *
   * @description This function is used to handle the change of the select button.
   */
  const handleOnSelectBtnChange = (e) => {
    if (e.value && e.value != value) {
      setValue(e.value)
      console.log("e.value:", e.value)
      if (e.value.action == "Play") {
        setIsUpdating(true)
      } else {
        setIsUpdating(false)
      }
    }
  }

  return (
    <>
      <ModulePage pageId={pageId} additionnalClassName="outputPage" shadow scrollable={false}>
        <div>
          <div className="header">
            <h1>Active processes - {MEDconfig.serverChoice} server</h1>
            <div className="output-btns">
              {isUpdating && <InputNumber inputId="stacked-buttons" value={requestDelay} onValueChange={(e) => setRequestDelay(e.value)} showButtons suffix=" Ms" min={250} step={250} />}
              <SelectButton value={value} onChange={handleOnSelectBtnChange} itemTemplate={btnTemplate} options={options} />
            </div>
          </div>
          <div className="eval-body">
            {activeElements.map((activeElement, index) => (
              <ActiveElement key={index} activeElement={activeElement} />
            ))}
          </div>
        </div>
      </ModulePage>
    </>
  )
}

export default OutputPage
