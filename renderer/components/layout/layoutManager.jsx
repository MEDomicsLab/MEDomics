import React, { useEffect, useState, useCallback, useRef, useContext } from "react"
import { ipcRenderer } from "electron"
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"
import Image from "next/image"
import resizable from "../../styles/resizable.module.css"
import IconSidebar from "../layout/iconSidebar"
import Home from "../mainPages/home"
import Learning from "../mainPages/learning"
import ExtractionMEDimagePage from "../mainPages/extractionMEDimage"
import ExtractionImagePage from "../mainPages/extractionImage"
import ExtractionTextPage from "../mainPages/extractionText"
import MEDprofilesViewer from "../input/MEDprofiles/MEDprofilesViewer"
import ExtractionTSPage from "../mainPages/extractionTS"
import ExploratoryPage from "../mainPages/exploratory"
import ResultsPage from "../mainPages/results"
import ApplicationPage from "../mainPages/application"
import HomeSidebar from "./sidebarTools/pageSidebar/homeSidebar"
import GeneralModuleSidebar from "./sidebarTools/pageSidebar/generalModuleSidebar"
import ExplorerSidebar from "./sidebarTools/pageSidebar/explorerSidebar"
import FlowSceneSidebar from "./sidebarTools/pageSidebar/flowSceneSidebar"
import EvaluationSidebar from "./sidebarTools/pageSidebar/evaluationSidebar"
import { MainContainer } from "./flexlayout/mainContainerClass"
import EvaluationPage from "../mainPages/evaluation"
import { LayoutModelContext } from "./layoutContext"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { requestBackend } from "../../utilities/requests"
import { toast } from "react-toastify"
import NotificationOverlay from "../generalPurpose/notificationOverlay"

import os from "os"

const LayoutManager = (props) => {
  const [activeSidebarItem, setActiveSidebarItem] = useState("home") // State to keep track of active nav item
  const [workspaceIsSet, setWorkspaceIsSet] = useState(true) // State to keep track of active nav item
  const sidebarRef = useRef(null) // Reference to the sidebar object
  const { developerMode } = useContext(LayoutModelContext)
  const { workspace, port } = useContext(WorkspaceContext)

  // This is a useEffect that will be called when the workspace change
  useEffect(() => {
    if (workspace.hasBeenSet == false) {
      setWorkspaceIsSet(false)
    } else {
      setWorkspaceIsSet(true)
    }
  }, [workspace])

  // This is a useEffect that will be called when the component is mounted to send a clearAll request to the backend
  useEffect(() => {
    console.log("port set to: ", port)
    if (port) {
      ipcRenderer.invoke("getBundledPythonEnvironment").then((res) => {
        console.log("Python embedded: " + res)
        if (res !== null) {
          requestBackend(
            port,
            "clearAll",
            { data: "clearAll" },
            (data) => {
              console.log("clearAll received data:", data)
              toast.success("Go server is connected and ready !")
            },
            (error) => {
              console.log("clearAll error:", error)
              toast.error("Go server is not connected !")
            }
          )
        }
      })
    }
  }, [port])

  // This is a callback that will be called when the user presses a key
  // It will check if the user pressed ctrl+b and if so, it will collapse or expand the sidebar
  const handleKeyPress = useCallback((event) => {
    if (event.ctrlKey && event.key === "b") {
      let newShowSidebar = sidebarRef.current.getCollapsed()
      if (newShowSidebar) {
        sidebarRef.current.expand()
      } else {
        sidebarRef.current.collapse()
      }
    } else if (os.platform() === "darwin" && event.metaKey && event.key === "b") {
      let newShowSidebar = sidebarRef.current.getCollapsed()
      if (newShowSidebar) {
        sidebarRef.current.expand()
      } else {
        sidebarRef.current.collapse()
      }
    }
  }, [])

  // This is a useEffect that will be called when a key is pressed
  useEffect(() => {
    // attach the event listener
    document.addEventListener("keydown", handleKeyPress)
    // remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyPress)
    }
  }, [handleKeyPress])

  /**
   *
   * @param {Array} selectedItem Array of selected item
   *
   * This function is called when a sidebar item is selected
   * It will update the activeSidebarItem state and send a message to the backend to update the working directory
   */
  const handleSidebarItemSelect = (selectedItem) => {
    setActiveSidebarItem(selectedItem) // Update activeNavItem state with selected item
    //ipcRenderer.send("messageFromNext", "updateWorkingDirectory")
  }

  // Render content component based on activeNavItem state
  const renderContentComponent = () => {
    if (developerMode && workspaceIsSet) {
      return <MainContainer />
    } else {
      switch (activeSidebarItem) {
        case "home":
          return <Home />
        case "learning":
          return <Learning pageId="123" />
        case "extractionMEDimage":
          return <ExtractionMEDimagePage pageId="1234" />
        case "extractionText":
          return <ExtractionTextPage pageId="4567" />
        case "extractionTS":
          return <ExtractionTSPage pageId="456" />
        case "extractionImage":
          return <ExtractionImagePage pageId="678" />
        case "MEDprofilesViewer":
          return <MEDprofilesViewer pageId="72" />
        case "exploratory":
          return <ExploratoryPage />
        case "results":
          return <ResultsPage />
        case "evaluation":
          return <EvaluationPage />
        case "application":
          return <ApplicationPage />
        default:
      }
    }
  }

  const renderSidebarComponent = () => {
    switch (activeSidebarItem) {
      case "home":
        return <HomeSidebar />
      case "explorer":
        return <ExplorerSidebar />
      case "learning":
        return (
          <GeneralModuleSidebar pageTitle="Learning">
            <FlowSceneSidebar type="learning" />
          </GeneralModuleSidebar>
        )
      case "extractionMEDimage":
        return (
          <GeneralModuleSidebar pageTitle="Extraction MEDimage">
            <FlowSceneSidebar type="extractionMEDimage" />
          </GeneralModuleSidebar>
        )
      case "evaluation":
        return <EvaluationSidebar />
      default:
        return (
          <>
            <GeneralModuleSidebar pageTitle={activeSidebarItem.charAt(0).toUpperCase() + activeSidebarItem.slice(1)} />
          </>
        )
    }
  }

  // START - QUEBEC FLAG DISPLAY
  const [quebecFlagDisplay, setQuebecFlagDisplay] = useState(false)
  const [quebecFlagDisplayHeight, setQuebecFlagDisplayHeight] = useState("0px")
  const [quebecFlagZIndex, setQuebecFlagZIndex] = useState(-1)
  let globalVar = true
  let sequence = []

  // handle hiding and showing the quebec flag
  const handleQuebecFlagDisplay = () => {
    globalVar = !globalVar
    setQuebecFlagDisplay(!globalVar)
    if (!globalVar) {
      setQuebecFlagDisplayHeight("100%")
      setQuebecFlagZIndex(1000)
    } else {
      // wait 4s before hiding the flag
      setTimeout(() => {
        setQuebecFlagDisplayHeight("0px")
        setQuebecFlagZIndex(-1)
      }, 4000)
    }
  }
  //  handle when user press ctrl+m+e+d
  const handleKeyDown = (event) => {
    if (os.platform() !== "darwin") {
      // if not mac
      if (event.key == "Control") {
        sequence = ["Control"]
      } else if (event.key == "m" && sequence[0] == "Control") {
        sequence = ["Control", "m"]
      } else if (event.key == "e" && sequence[1] == "m") {
        sequence = ["Control", "m", "e"]
      } else if (event.key == "d" && sequence[2] == "e") {
        handleQuebecFlagDisplay()
        sequence = []
      } else {
        sequence = []
      }
    } else {
      // if macOS
      if (event.key == "Meta") {
        sequence = ["Meta"]
      } else if (event.key == "m" && sequence[0] == "Meta") {
        sequence = ["Meta", "m"]
      } else if (event.key == "e" && sequence[1] == "m") {
        sequence = ["Meta", "m", "e"]
      } else if (event.key == "d" && sequence[2] == "e") {
        handleQuebecFlagDisplay()
        sequence = []
      } else {
        sequence = []
      }
    }
  }
  // handle when user release ctrl
  const handleKeyUp = (event) => {
    if (event.key == "Control") {
      sequence = []
    }
  }
  // This is a useEffect that will be called when a key is pressed
  useEffect(() => {
    // attach the event listener
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)
    // remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
    }
  }, [])
  // END - QUEBEC FLAG DISPLAY

  return (
    <>
      <div style={{ height: "100%", display: "flex", width: "100%" }}>
        <IconSidebar onSidebarItemSelect={handleSidebarItemSelect} activeSidebarItem={activeSidebarItem} />
        <div className="main-app-container">
          <PanelGroup autoSaveId="test" direction="horizontal">
            <Panel className={resizable.Panel} collapsible={true} minSize={20} maxSize={80} defaultSize={20} order={1} ref={sidebarRef}>
              <div className={`${resizable.PanelContent} sidebar-content`} style={{ backgroundColor: "#353535" }}>
                {renderSidebarComponent()}
              </div>
            </Panel>
            <PanelResizeHandle className={resizable.ResizeHandleOuter}>
              <div className={resizable.ResizeHandleInner} />
            </PanelResizeHandle>
            <Panel className={resizable.Panel} collapsible={true} order={2}>
              {renderContentComponent({ props })} {/* Render content component based on activeNavItem state */}
            </Panel>
          </PanelGroup>
          <NotificationOverlay />
          <div className="quebec-flag-div">
            <Image
              className="quebec-flag"
              src="/images/QUEBEC-FLAG.jpg"
              alt="Quebec flag"
              width="750"
              height="500"
              style={{ opacity: quebecFlagDisplay ? "1" : "0", height: quebecFlagDisplayHeight, zIndex: quebecFlagZIndex }}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default LayoutManager
