import { Tooltip } from "primereact/tooltip"
import { Button } from "react-bootstrap"
import * as Icon from "react-bootstrap-icons"
import { AiOutlineExport, AiOutlineImport } from "react-icons/ai"
import { PiDownload } from "react-icons/pi"
import { TfiSave } from "react-icons/tfi"

/**
 *
 * @param {List} buttonList List of buttons to display
 * @description This component is used to display a list of buttons
 * @example
 * <BtnDiv buttonsList={[{type: 'clear', onClick: () => {}, disabled: true}]}/>
 */
const BtnDiv = ({ buttonsList }) => {
  return (
    <>
      {buttonsList.map((button) => {
        return buttonType[button.type](button.onClick, button.disabled)
      })}
    </>
  )
}
export default BtnDiv

// This is the list of buttons that can be displayed
// Each button has a type and an onClick function
// You can add more buttons here
const buttonType = {
  clear: (onClear, disabled = false) => {
    return (
      <>
      <Tooltip target=".clear" content="Clear the scene" position="bottom"/>
      <Button className="clear" key="clear" variant="outline margin-left-10 padding-5" onClick={onClear} disabled={disabled}>
        <Icon.Trash width="30px" height="30px" />
      </Button>
      </>
    )
  },
  save: (onSave, disabled = false) => {
    return (
      <>
      <Tooltip target=".save" content="Save the scene" position="bottom"/>
      <Button className="save" key="save" variant="outline margin-left-10 padding-5" onClick={onSave} disabled={disabled}>
        <TfiSave style={{ width: "30px", height: "auto", padding: "2px" }} />
      </Button>
      </>
    )
  },
  download: (onDownload, disabled = false) => {
    return (
      <>
      <Tooltip target=".download" content="Download the scene" position="bottom"/>
      <Button className="download" key="download" variant="outline margin-left-10 padding-5" onClick={onDownload} disabled={disabled}>
        <PiDownload style={{ width: "30px", height: "auto" }} />
      </Button>
      </>
    )
  },
  load: (onLoad, disabled = false) => {
    return (
      <>
      <Tooltip target=".load" content="Load the scene" position="bottom"/>
      <Button className="load" key="load" variant="outline margin-left-10 padding-5" onClick={onLoad} disabled={disabled}>
        <AiOutlineImport style={{ width: "30px", height: "auto" }} />
      </Button>
      </>
    )
  },
  export: (onExport, disabled = false) => {
    return (
      <>
      <Tooltip target=".export" content="Export the scene" position="bottom"/>
      <Button className="export" key="export" variant="outline margin-left-10 padding-5" onClick={onExport} disabled={disabled}>
        <AiOutlineExport style={{ width: "30px", height: "auto" }} />
      </Button>
      </>
    )
  },
  run: (onRun, disabled = false) => {
    return (
      <>
      <Tooltip target=".run" content="Run the scene" position="bottom"/>
      <Button className="run" key="run" variant="outline margin-left-10 padding-5" onClick={onRun} disabled={disabled}>
        <Icon.PlayCircle width="30px" height="30px" />
      </Button>
      </>
    )
  },
  back: (onBack, disabled = false) => {
    return (
      <>
      <Tooltip target=".back" content="Go back to the previous scene" position="bottom"/>
      <Button className="back" key="back" variant="outline margin-left-10 padding-5" onClick={onBack} disabled={disabled}>
        <Icon.Backspace width="30px" height="30px" />
      </Button>
      </>
    )
  }
}
