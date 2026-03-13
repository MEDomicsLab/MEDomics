/* eslint-disable no-unused-vars */
import { useState, useContext, useEffect } from "react"
import { Files, HouseFill, Gear, Send } from "react-bootstrap-icons"
import Nav from "react-bootstrap/Nav"
import { NavDropdown } from "react-bootstrap"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { Tooltip } from "primereact/tooltip"
import { LayoutModelContext } from "./layoutContext"
import { PiFlaskFill } from "react-icons/pi"
import { FaMagnifyingGlassChart } from "react-icons/fa6"
import { TbCloudDataConnection } from "react-icons/tb";
import { FaDatabase } from "react-icons/fa6"
import { LuNetwork } from "react-icons/lu"
import { Button } from "primereact/button"
import { TbFileExport } from "react-icons/tb"
import { VscChromeClose } from "react-icons/vsc"
import { PiGraphFill } from "react-icons/pi"
import ConnectionModal from "../mainPages/connectionModal"
import { toast } from "react-toastify"
import { MdOutlineGroups3, MdSunny, MdOutlineDarkMode } from "react-icons/md"
import { useTheme } from "../theme/themeContext"


/**
 * @description Sidebar component containing icons for each page
 * @param {function} onSidebarItemSelect - function to handle sidebar item selection
 * @returns Returns the sidebar component with icons for each page
 */
const IconSidebar = ({ onSidebarItemSelect }) => {
  // eslint-disable-next-line no-unused-vars
  const { dispatchLayout, developerMode, setDeveloperMode } = useContext(LayoutModelContext)
  const { isDarkMode, toggleTheme } = useTheme()
  const [activeKey, setActiveKey] = useState("home") // activeKey is the name of the page
  const [isDisabled, setIsDisabled] = useState(true) // disabled is the state of the page
  const [developerModeNav, setDeveloperModeNav] = useState(true)
  const [extractionBtnstate, setExtractionBtnstate] = useState(false)
  const [evaluationBtnstate, setEvaluationBtnstate] = useState(false)
  const [buttonClass, setButtonClass] = useState("")
  const [showConnectionModal, setShowConnectionModal] = useState(false)

  const delayOptions = { showDelay: 750, hideDelay: 0 }

  // default action to set developer mode to true
  useEffect(() => {
    setDeveloperMode(true)
    setDeveloperModeNav(true)
  }, [])

  /**
   * @description Toggles the developer mode
   */
  function handleToggleDeveloperMode() {
    console.log("handleToggleDeveloperMode")
    setDeveloperMode(!developerMode)
    setDeveloperModeNav(!developerModeNav)
  }

  /**
   *
   * @param {Event} event
   * @param {string} name
   */
  function handleDoubleClickModule(event, name) {
    event.stopPropagation()
    console.log(`Double clicked ${name}`, event, `open${name}Module`)
    dispatchLayout({ type: `open${name}Module`, payload: { pageId: name } })
  }

  /**
   *
   * @param {Event} event
   * @param {string} name
   */
  function handleDoubleClickLanding(event, name) {
    event.stopPropagation()
    console.log(`Double clicked ${name}`, event, `open${name}LandingPage`)
    dispatchLayout({ type: `open${name}LandingPage`, payload: { pageId: name } })
  }

  const { workspace } = useContext(WorkspaceContext)

  /**
   * @description Sets the active key and disabled state of the sidebar icons
   */
  useEffect(() => {
    if (!workspace.hasBeenSet) {
      setActiveKey("home")
      setIsDisabled(true)
    } else {
      setIsDisabled(false)
    }
  }, [workspace])

  useEffect(() => {}, [extractionBtnstate])

  /**
   *
   * @param {Event} event The event that triggered the click
   * @param {string} name The name of the page
   */
  function handleClick(event, name) {
    onSidebarItemSelect(name)
    console.log(`clicked ${name}`, event)
    setActiveKey(name)
  }

  /**
   * @description Handles the click on the settings button
   */
  const handleNavClick = () => {
    setButtonClass(buttonClass === "" ? "show" : "")
  }

  const handleRemoteConnect = () => {
    toast.success("Connected to remote workspace!");
  }
  
  function handleThemeToggleClick() {
    toggleTheme()
  }

  return (
    <>
      <div className="icon-sidebar">
        {/* ------------------------------------------- Tooltips ----------------------------------------- */}
        <Tooltip target=".homeNavIcon" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".ext-eval-btn" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".explorerNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".connectionModalBtn" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".inputNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".extractionNav" {...delayOptions} className="tooltip-icon-sidebar" data-pr-disabled={extractionBtnstate} />
        <Tooltip target=".exploratoryNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".learningNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".resultsNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".evaluationNav" {...delayOptions} className="tooltip-icon-sidebar" data-pr-disabled={evaluationBtnstate} />
        <Tooltip target=".applicationNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".ext-text-btn" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".ext-MEDimg-btn" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".ext-MED3pa-btn" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".ext-ts-btn" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".ext-img-btn" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".medflNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".med3paNav" {...delayOptions} className="tooltip-icon-sidebar" />
        <Tooltip target=".ext-eval-btn" {...delayOptions} className="tooltip-icon-sidebar" />
        {/* ------------------------------------------- END Tooltips ----------------------------------------- */}

        {/* ------------------------------------------- ICON NAVBAR ----------------------------------------- */}

        <Nav defaultActiveKey="/home" className="flex-column" style={{ width: "100%", height: "100%" }}>
          <Nav.Link
            className="homeNavIcon btnSidebar"
            data-pr-at="right center"
            data-pr-tooltip="Home"
            data-pr-my="left center"
            href="#home"
            eventKey="home"
            data-tooltip-id="tooltip-home"
            onClick={(event) => handleClick(event, "home")}
            onDoubleClick={(event) => handleDoubleClickModule(event, "Home")}
          >
            <HouseFill size={"1.25rem"} width={"100%"} height={"100%"} style={{ scale: "0.65" }} />
          </Nav.Link>

          <Nav.Link
            className="explorerNav btnSidebar"
            data-pr-at="right center"
            data-pr-tooltip="Explorer"
            data-pr-my="left center"
            eventKey="explorer"
            data-tooltip-id="tooltip-explorer"
            onClick={(event) => handleClick(event, "explorer")}
          >
            <Files size={"1.25rem"} width={"100%"} height={"100%"} style={{ scale: "0.65" }} />
          </Nav.Link>

          <Nav.Link
            className="connectionModalBtn btnSidebar"
            data-pr-at="right center"
            data-pr-tooltip="Connection Menu"
            data-pr-my="left center"
            data-tooltip-id="tooltip-connection-menu"
            onClick={() => {
              setShowConnectionModal(true)
            }}
            style={{ position: "relative" }}
          >
            <TbCloudDataConnection style={{ height: "2.2rem", width: "100%", strokeWidth: "1" }} />
            {/* SSH Tunnel status indicator */}
            {workspace.isRemote && (
              <span
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  fontSize: "0.9rem",
                  color: "#4caf50",
                  background: "#3a3a3a",
                  border: "1.5px solid #00ff00",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  boxSizing: "border-box"
                }}
                title="SSH Tunnel Active"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.5 8.5L7 11L11.5 6.5" stroke="#00ff00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
          </Nav.Link>

          <NavDropdown.Divider className="icon-sidebar-divider" style={{ height: "3rem" }} />
          <div className="medomics-layer design">
            <div className="sidebar-icons">

              <Nav.Link
                className="inputNav btnSidebar align-center"
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="Input"
                eventKey="input"
                data-tooltip-id="tooltip-input"
                onDoubleClick={(event) => handleDoubleClickModule(event, "Input")}
                onClick={(event) => handleClick(event, "input")}
                disabled={isDisabled}
              >
                {" "}
                <FaDatabase style={{ height: "1.7rem", width: "auto" }} />
              </Nav.Link>

              <Nav.Link
                className="extractionNav btnSidebar align-center"
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="extraction"
                data-pr-disabled={extractionBtnstate}
                eventKey="extraction"
                data-tooltip-id="tooltip-extraction"
                onDoubleClick={(event) => handleDoubleClickLanding(event, "extraction")}
                onClick={() => {
                  //setExtractionBtnstate(!extractionBtnstate)
                }}
                disabled={isDisabled}
                onBlur={(event) => {
                  let clickedTarget = event.relatedTarget
                  let blurAccepeted = true
                  if (clickedTarget) {
                    blurAccepeted = !clickedTarget.getAttribute("data-is-ext-btn")
                  } else {
                    blurAccepeted = true
                  }
                  blurAccepeted && setExtractionBtnstate(false)
                }}
              >
                {extractionBtnstate ? <VscChromeClose style={{ height: "1.7rem", width: "auto" }} /> : <TbFileExport style={{ height: "1.7rem", width: "auto", color: "#9e9e9e" }} />}
                <div className={`btn-group-ext ${extractionBtnstate ? "clicked" : ""}`}>
                  <Button
                    className="ext-MEDimg-btn"
                    icon="pi pi-image"
                    data-pr-at="right center"
                    data-pr-my="left center"
                    data-pr-tooltip="MEDimage"
                    data-is-ext-btn
                    onClick={(event) => {
                      event.stopPropagation()
                      event.preventDefault()
                      handleDoubleClickModule(event, "ExtractionMEDimage")
                      // handleClick(event, "extractionMEDimage")
                      setExtractionBtnstate(!extractionBtnstate)
                    }}
                    onDoubleClick={(event) => handleDoubleClickModule(event, "ExtractionMEDimage")}
                  />
                  <Button
                    className="ext-text-btn"
                    icon="pi pi-align-left"
                    data-pr-at="right center"
                    data-pr-my="left center"
                    data-pr-tooltip="Text"
                    data-is-ext-btn
                    onClick={(event) => {
                      console.log("clicked extraction text", event)
                      event.stopPropagation()
                      event.preventDefault()
                      setExtractionBtnstate(!extractionBtnstate)
                      handleDoubleClickModule(event, "ExtractionText")
                    }}
                    onDoubleClick={(event) => handleDoubleClickModule(event, "ExtractionText")}
                  />
                  <Button
                    className="ext-ts-btn"
                    icon="pi pi-chart-line"
                    data-pr-at="right center"
                    data-pr-my="left center"
                    data-pr-tooltip="Time Series"
                    data-is-ext-btn
                    onClick={(event) => {
                      console.log("clicked extraction ts", event)
                      event.stopPropagation()
                      event.preventDefault()
                      // handleClick(event, "extractionTS")
                      handleDoubleClickModule(event, "ExtractionTS")
                      setExtractionBtnstate(!extractionBtnstate)
                    }}
                    onDoubleClick={(event) => handleDoubleClickModule(event, "ExtractionTS")}
                  />
                  <Button
                    className="ext-img-btn"
                    icon="pi pi-database"
                    data-pr-at="right center"
                    data-pr-my="left center"
                    data-pr-tooltip="Image"
                    data-is-ext-btn
                    onClick={(event) => {
                      console.log("clicked extraction image", event)
                      event.stopPropagation()
                      event.preventDefault()
                      handleDoubleClickModule(event, "ExtractionImage")
                      setExtractionBtnstate(!extractionBtnstate)
                    }}
                    onDoubleClick={(event) => handleDoubleClickModule(event, "ExtractionImage")}
                  />
                </div>
              </Nav.Link>

              <Nav.Link
                className="exploratoryNav btnSidebar align-center"
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="Exploratory"
                eventKey="exploratory"
                data-tooltip-id="tooltip-exploratory"
                onDoubleClick={(event) => handleDoubleClickModule(event, "Exploratory")}
                onClick={(event) => handleClick(event, "exploratory")}
                disabled={isDisabled}
              >
                {" "}
                <FaMagnifyingGlassChart style={{ height: "1.7rem", width: "auto" }} />
              </Nav.Link>

            </div>
            <div className="medomics-layer-text">Design</div>
          </div>
          <NavDropdown.Divider style={{ height: "3rem" }} />

          <div className="medomics-layer development ">
            <div className="sidebar-icons">
              <Nav.Link
                className="learningNav btnSidebar align-center"
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="Learning"
                eventKey="Learning"
                data-tooltip-id="tooltip-learning"
                onClick={(event) => handleClick(event, "learning")}
                disabled={isDisabled}
              >
                <LuNetwork style={{ height: "1.7rem", width: "auto", rotate: "-90deg" }} />
              </Nav.Link>

              <Nav.Link
                className="evaluationNav btnSidebar align-center"
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="Evaluation"
                data-pr-disabled={evaluationBtnstate}
                eventKey="evaluation"
                data-tooltip-id="tooltip-evaluation"
                onDoubleClick={(event) => handleClick(event, "evaluation")}
                disabled={isDisabled}
                onClick={() => {
                  setEvaluationBtnstate(!evaluationBtnstate)
                }}
                onBlur={(event) => {
                  let clickedTarget = event.relatedTarget
                  let blurAccepeted = true
                  if (clickedTarget) {
                    blurAccepeted = !clickedTarget.getAttribute("data-is-ext-btn")
                  } else {
                    blurAccepeted = true
                  }
                  blurAccepeted && setEvaluationBtnstate(false)
                }}
              >
                {evaluationBtnstate ? <VscChromeClose style={{ height: "1.7rem", width: "auto" }} /> : <PiFlaskFill style={{ height: "1.7rem", width: "auto" }} />}
                <div className={`btn-group-ext ${evaluationBtnstate ? "clicked" : ""}`}>
                  <Button
                    className="ext-MED3pa-btn"
                    icon="pi pi-image"
                    data-pr-at="right center"
                    data-pr-my="left center"
                    data-pr-tooltip="MED3pa"
                    data-is-ext-btn
                    onDoubleClick={(event) => handleDoubleClickModule(event, "MED3pa")}
                    onClick={(event) => {
                      event.stopPropagation()
                      event.preventDefault()
                      handleClick(event, "MED3pa")
                      setEvaluationBtnstate(!evaluationBtnstate)
                    }}
                  />
                  <Button
                    className="ext-eval-btn"
                    icon="pi pi-search"
                    data-pr-at="right center"
                    data-pr-my="left center"
                    data-pr-tooltip="Models Evaluation"
                    data-is-ext-btn
                    onClick={(event) => {
                      console.log("clicked Evaluation", event)
                      event.stopPropagation()
                      event.preventDefault()
                      setEvaluationBtnstate(!evaluationBtnstate)
                      handleClick(event, "evaluation")
                    }}
                    onDoubleClick={(event) => handleClick(event, "evaluation")}
                  />
                </div>
              </Nav.Link>

              <Nav.Link
                className="medflNav btnSidebar align-center"
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="Federated Learning"
                eventKey="MEDfl"
                onDoubleClick={(event) => handleDoubleClickModule(event, "MEDfl")}
                onClick={(event) => handleClick(event, "medfl")}
                disabled={isDisabled}
              >
                <PiGraphFill style={{ height: "2.2rem", width: "auto" }} />
              </Nav.Link>
            </div>
            <div className="medomics-layer-text">Development</div>
          </div>
          <NavDropdown.Divider style={{ height: "3rem" }} />

          <div className="medomics-layer deployment">
            <div className="sidebar-icons">
              <Nav.Link
                className="applicationNav btnSidebar"
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="Application"
                eventKey="Application"
                data-tooltip-id="tooltip-application"
                onClick={(event) => handleClick(event, "application")}
                disabled={isDisabled}
                onDoubleClick={(event) => handleDoubleClickModule(event, "Application")}
              >
                <Send size={"1.25rem"} width={"100%"} height={"100%"} style={{ scale: "0.65" }} />
              </Nav.Link>
            </div>
            <div className="medomics-layer-text">Deployment</div>
          </div>

          {/* div that puts the buttons to the bottom of the sidebar*/}
          <div className="d-flex icon-sidebar-divider" style={{ flexGrow: "1" }}></div>
          
          {showConnectionModal && <ConnectionModal
            visible={showConnectionModal}
            closable={false}
            onClose={() => setShowConnectionModal(false)}
            onConnect={handleRemoteConnect}
          />}
          
          {/* ------------------------------------------- DARK/LIGHT MODE BUTTON ----------------------------------------- */}
          <div className="medomics-layer settings">
            <div className="sidebar-icons">
              <Nav.Link
                className="darkModeNav btnSidebar align-center"
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="Dark/Light Mode"
                eventKey="darkMode"
                data-tooltip-id="tooltip-darkMode"
                onClick={() => {
                  handleThemeToggleClick()
                }}
              >
                {isDarkMode ? (

                  <MdOutlineDarkMode style={{ height: "2.2rem", width: "auto" }} />
                ) : (
                  <MdSunny style={{ height: "2.2rem", width: "auto" }} />
                )}
              </Nav.Link>
              {/* ------------------------------------------- END DARK/LIGHT MODE BUTTON ----------------------------------------- */}

              {/* ------------------------------------------- SETTINGS BUTTON ----------------------------------------- */}
              <Nav.Link
                className="settingsNav btnSidebar"
                data-pr-at="right center"
                data-pr-my="left center"
                data-pr-tooltip="Settings"
                eventKey="settings"
                data-tooltip-id="tooltip-settings"
                onClick={() => dispatchLayout({ type: `openSettings`, payload: { pageId: "Settings" } })}
                disabled={isDisabled}
              >
                <Gear size={"1.25rem"} width={"100%"} height={"100%"} style={{ scale: "0.65" }} />
              </Nav.Link>
            </div>
            <div className="medomics-layer-text">Settings</div>
          </div>
        </Nav>
        {/* ------------------------------------------- END ICON NAVBAR ----------------------------------------- */}
      </div>
    </>
  )
}

export default IconSidebar
