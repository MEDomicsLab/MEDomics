import React, { useState, useEffect, useContext } from "react"
import CreatableSelect from "react-select/creatable" // https://react-select.com/creatable
import FloatingLabel from "react-bootstrap/FloatingLabel"
import Form from "react-bootstrap/Form"
import { toast } from "react-toastify" // https://www.npmjs.com/package/react-toastify
import { Tooltip } from "react-tooltip"
import { Markup } from "interweave"
import WsSelect from "../mainPages/dataComponents/wsSelect"
import WsSelectMultiple from "../mainPages/dataComponents/wsSelectMultiple"
import TagsSelectMultiple from "../mainPages/dataComponents/tagsSelectMultiple"
import { DataContext } from "../workspace/dataContext"
import { Dropdown } from "primereact/dropdown"
import { MultiSelect } from "primereact/multiselect"
import VarsSelectMultiple from "../mainPages/dataComponents/varsSelectMultiple"
import { Message } from "primereact/message"
import { Button } from "react-bootstrap";


/**
 *
 * @param {*} label new option label
 * @returns {object} a new option
 *
 * @description
 * This function is used to create a new option for the select
 */
const createOption = (label) => ({
  label,
  value: label
})

const normalizeStringForBackend = (settingInfos, raw) => {
  const v = (raw ?? "").trim()
  const hasChoices = Array.isArray(settingInfos?.choices)
  // If this "string" field has "None" among choices, map "None" → null for backend
  if (hasChoices && settingInfos.choices.includes("None") && v === "None") return null
  return v
}

/**
 *
 * @param {string} name name of the setting
 * @param {object} settingInfos infos of the setting ex: {type: "string", tooltip: "this is a tooltip"}
 * @returns {JSX.Element} A Input component
 *
 * @description
 * This component is used to display a Input component.
 * it handles multiple types of input and format them to be similar
 */
const Input = ({ name, settingInfos, currentValue, onInputChange, disabled = false, setHasWarning = () => {}, customProps }) => {
  const [inputUpdate, setInputUpdate] = useState({})
  const [inputValue, setInputValue] = useState("")
  const { globalData } = useContext(DataContext)

  /**
   *
   * @param {Event} event keydown event
   *
   * @description
   * This function is used to handle the keydown event on the input
   * it handles the creation of a new option
   * this function is used only for the select input
   */
  const handleKeyDown = (event) => {
    if (!inputValue) return
    switch (event.key) {
      case "Enter":
      case "Tab":
        currentValue == undefined && (currentValue = [])
        setInputUpdate({
          name: name,
          value: [...currentValue, createOption(inputValue)],
          type: settingInfos.type
        })
        setInputValue("")
        event.preventDefault()
    }
  }

  const createTooltip = (tooltip, tooltipId) => {
    return (
      <Tooltip className="tooltip" anchorSelect={`#${tooltipId}`} delayShow={1000} place="left">
        <Markup content={tooltip} />
      </Tooltip>
    )
  }

  // execute this when an input is updated
  // it also verify if the input is correct
  useEffect(() => {
    if (inputUpdate.name != undefined) {
      if (inputUpdate.type == "int") {
        let regexPattern = /^-?[0-9]+$/
        if (!regexPattern.test(inputUpdate.value)) {
          toast.warn("This input must be an integer", {
            position: "bottom-right",
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            toastId: "customId"
          })
          inputUpdate.value = Math.round(inputUpdate.value)
        }
      }
      onInputChange(inputUpdate)
    }
  }, [inputUpdate])

  const detectMultiType = (value) => {
  if (value === null || value === undefined) return "none";
  if (typeof value === "string") return "str";
  if (typeof value === "number") return "int"; // or float, but int default is okay
  if (Array.isArray(value)) {
    // list of dicts
    if (value.length > 0 && typeof value[0] === "object") return "list-dict";
    // multidimensional arrays
    if (Array.isArray(value[0])) {
      if (Array.isArray(value[0][0])) return "array3d";
      return "array2d";
    }
    return "list";
  }
  if (typeof value === "object") return "dict";
  return "none";
};

  /**
   *
   * @param {Object} settingInfos contains infos about the setting
   * @returns {JSX.Element} a correct input component according to the type of the setting
   *
   * @description
   * This function is used to return a correct input component according to the type of the setting
   * it handles multiple types of input and format them to be similar
   *
   */
  const getCorrectInputType = (settingInfos) => {
    switch (settingInfos.type) {
      case "string":
      // If choices are provided
      // render a dropdown and convert "None" -> null on change.
      if (Array.isArray(settingInfos?.choices) && settingInfos.choices.length > 0) {
        return (
          <>
            <FloatingLabel id={name} controlId={name} label={name} className=" input-hov">
              <Form.Select
                disabled={disabled}
                defaultValue={currentValue ?? "None"}
                onChange={(e) =>
                  setInputUpdate({
                    name,
                    value: normalizeStringForBackend(settingInfos, e.target.value),
                    type: settingInfos.type
                  })
                }
              >
                {settingInfos.choices.map((c) => (
                  <option key={String(c)} value={String(c)}>{String(c)}</option>
                ))}
              </Form.Select>
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )
      } else {
        return (
          <>
            <FloatingLabel id={name} controlId={name} label={name} className=" input-hov">
              <Form.Control
                disabled={disabled}
                type="text"
                defaultValue={currentValue}
                onChange={(e) =>
                  setInputUpdate({
                    name: name,
                    value: e.target.value,
                    type: settingInfos.type
                  })
                }
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )
      }
      // for integer input
      case "int":
        return (
          <>
            <FloatingLabel controlId={name} label={name} className=" input-hov">
              <Form.Control
                disabled={disabled}
                type="number"
                step={settingInfos.step || "1"}
                min={settingInfos.min}
                max={settingInfos.max}
                value={currentValue}
                onChange={(e) =>
                  setInputUpdate({
                    name: name,
                    value: parseInt(e.target.value),
                    type: settingInfos.type
                  })
                }
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )
      // for float input
      case "float":
        return (
          <>
            <FloatingLabel controlId={name} label={name} className=" input-hov">
              <Form.Control
                disabled={disabled}
                type="number"
                step={settingInfos.step || "0.05"}
                min={settingInfos.min}
                max={settingInfos.max}
                value={currentValue}
                onChange={(e) =>
                  setInputUpdate({
                    name: name,
                    value: parseFloat(e.target.value),
                    type: settingInfos.type
                  })
                }
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )
      // for boolean input (form select of 2 options True/False)
      case "bool":
        return (
          <>
            <FloatingLabel controlId={name} label={name} className=" input-hov">
              <Form.Select
                disabled={disabled}
                defaultValue={currentValue}
                onChange={(e) =>
                  setInputUpdate({
                    name: name,
                    value: e.target.value,
                    type: settingInfos.type
                  })
                }
              >
                <option value="" hidden></option>
                <option value="True">True</option>
                <option value="False">False</option>
              </Form.Select>
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )

      case "bool-int-str":
        return (
          <>
            <FloatingLabel id={name} controlId={name} label={name} className=" input-hov">
              <Form.Control
                disabled={disabled}
                type="text"
                defaultValue={currentValue}
                onChange={(e) => {
                  let value = ""
                  if (/^-?[0-9]+$/.test(e.target.value)) {
                    value = parseInt(e.target.value)
                  } else {
                    value = e.target.value
                  }
                  console.log("value", value)
                  setInputUpdate({
                    name: name,
                    value: value,
                    type: settingInfos.type
                  })
                }}
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )
      case "int-float-str":
        return (
          <>
            <FloatingLabel controlId={name} label={name} className=" input-hov">
              <Form.Control
                disabled={disabled}
                defaultValue={currentValue}
                onChange={(e) => {
                  // check if the value is a float or an int or a string
                  let value = ""
                  if (/^-?[0-9]+$/.test(e.target.value)) {
                    // int
                    value = parseInt(e.target.value)
                  } else if (/^-?[0-9]*[.][0-9]+$/.test(e.target.value)) {
                    // float
                    value = parseFloat(e.target.value)
                  } else {
                    // string
                    value = e.target.value
                  }

                  setInputUpdate({
                    name: name,
                    value: value,
                    type: settingInfos.type
                  })
                }}
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )
      // for list input (form select of all the options)
      case "list":
        return (
          <>
            <FloatingLabel controlId={name} label={name} className="input-hov">
              <Dropdown
                className="form-select"
                {...customProps}
                disabled={disabled}
                value={{ name: currentValue }}
                onChange={(e) => {
                  setInputUpdate({
                    name: name,
                    value: e.target.value.name,
                    type: settingInfos.type
                  })
                }}
                options={Object.entries(settingInfos.choices).map(([option]) => {
                  return {
                    name: option
                  }
                })}
                optionLabel="name"
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )

        case "multi": {
  const subType = detectMultiType(currentValue);
  const [selectedSubType, setSelectedSubType] = useState(subType);

  const defaultValueFromSubtype = (sub) => {
    const subInfo = settingInfos.allowedTypes?.[sub];
    if (!subInfo) return null;
    return subInfo.default_val ?? null;
  };

  const tooltipId = `${name}_multi_info`;

  const allowed = settingInfos.allowedTypes || {};
  const subInfo = allowed[selectedSubType] || {};

  // On mappe le sous-type vers un vrai type existant ("string", "int", etc.)
  const effectiveType = subInfo.mapTo || selectedSubType;

  return (
    <>
      <div
        style={{
          border: "1px solid #dcdcdc",
          borderRadius: "8px",
          backgroundColor: "#fafafa",
          padding: "12px",
          marginBottom: "12px",
          marginTop: "8px"
        }}
      >
        {/* Header + info */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
          <label className="block text-sm font-medium text-gray-700" style={{ marginRight: "8px" }}>
            {settingInfos.label || name}
          </label>

          <span
            id={tooltipId}
            style={{
              cursor: "pointer",
              color: "#666",
              fontSize: "16px",
              userSelect: "none"
            }}
          >
            ℹ️
          </span>

          <Tooltip anchorSelect={`#${tooltipId}`} place="right" style={{ maxWidth: "260px" }}>
            <Markup
              content={subInfo.description || "Select a subtype for this parameter."}
            />
          </Tooltip>
        </div>

        {/* TYPE SELECTOR */}
        <select
          className="form-select mb-2"
          disabled={disabled}
          value={selectedSubType}
          onChange={(e) => {
            const newType = e.target.value;
            const info = allowed[newType] || {};
            setSelectedSubType(newType);

            setInputUpdate({
              name,
              value: defaultValueFromSubtype(newType),
              type: "multi"
            });
          }}
        >
          {Object.entries(allowed).map(([key, info]) => (
            <option key={key} value={key}>
              {info.label || key}
            </option>
          ))}
        </select>

        {/* REAL INPUT */}
        {selectedSubType &&
          <Input
            name={name}
            settingInfos={{
              ...subInfo,
              type: effectiveType,     // 🔥 string, int, dict…
              tooltip: settingInfos.tooltip
            }}
            currentValue={currentValue}
            disabled={disabled}
            onInputChange={(u) =>
              onInputChange({
                name,
                value: u.value,
                type: "multi"
              })
            }
          />
        }
      </div>

      {createTooltip(settingInfos.tooltip, name)}
    </>
  );
}

      // for list input (form select of all the options, multiple selection possible)
      case "list-multiple":
      const safeValue = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);

      

      return (
        <>
          <label htmlFor={name} className="block mb-2 text-sm font-medium text-gray-700">
            {settingInfos.label || name}
          </label>

          <MultiSelect
            key={name}
            id={name}
            disabled={disabled}
            value={safeValue}
            filter
            onChange={(e) => {
              setInputUpdate({
                name,
                value: e.value,
                type: settingInfos.type,
              });
            }}
            options={Object.entries(settingInfos?.choices || {}).map(([option, label]) => ({
              label,
              value: option,
            }))}
            optionLabel="label"
            display="chip"
            className="w-full md:w-20rem"
          />

          {createTooltip(settingInfos.tooltip, name)}
        </>
      );

      // for list input but with name not indexes (form select of all the options, multiple selection possible)
      case "list-multiple-columns":
      const safeValue1 = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);

      return (
        <>
          <label htmlFor={name} className="block mb-1 text-sm font-medium text-gray-700">
            {settingInfos.label || name}
          </label>

          <MultiSelect
            key={name}
            id={name}
            disabled={disabled}
            value={safeValue1}
            filter
            onChange={(e) => {
              setInputUpdate({
                name,
                value: e.value,
                type: settingInfos.type,
              });
            }}
            options={Object.entries(settingInfos?.choices || {}).map(([option, label]) => ({
              name: label,
              value: label,
            }))}
            optionLabel="name"
            display="chip"
            className="w-full md:w-20rem"
          />

          {createTooltip(settingInfos.tooltip, name)}
        </>
      );

      // for range input
      case "range":
        return (
          <>
            <FloatingLabel controlId={name} label={name} className=" input-hov">
              <Form.Control
                disabled={disabled}
                type="range"
                defaultValue={currentValue}
                onChange={(e) =>
                  setInputUpdate({
                    name: name,
                    value: e.target.value,
                    type: settingInfos.type
                  })
                }
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )
      // for custom list input (multiple custom string inputs)
      case "custom-list":
        return (
          <>
          <div id={name} className="flex flex-column gap-2 w-full position-relative">
            <label htmlFor={name} className="font-medium text-sm z-2 position-relative" style={{color: 'rgba(33, 37, 41)'}}>
              {name}
            </label>
            <div className="w-full position-relative">
              <CreatableSelect
                disabled={disabled}
                components={{ DropdownIndicator: null }}
                inputValue={inputValue}
                isClearable
                isMulti
                menuIsOpen={false}
                onChange={(newValue) =>
                  setInputUpdate({
                    name: name,
                    value: newValue,
                    type: settingInfos.type
                  })
                }
                onInputChange={(newValue) => setInputValue(newValue)}
                onKeyDown={handleKeyDown}
                placeholder="Add"
                value={currentValue}
                styles={{
                  container: (base) => ({
                    ...base,
                    zIndex: 1
                  }),
                  control: (base) => ({
                    ...base,
                    zIndex: 1
                  })
                }}
              />
            </div>
            {createTooltip(settingInfos.tooltip, name)}
          </div>
          </>
        )
      // for pandas dataframe input (basically a string input for now)
      case "pandas.DataFrame":
        return (
          <>
            <FloatingLabel controlId={name} label={name} className=" input-hov">
              <Form.Control
                disabled={disabled}
                type="text"
                defaultValue={currentValue}
                onChange={(e) =>
                  setInputUpdate({
                    name: name,
                    value: e.target.value,
                    type: settingInfos.type
                  })
                }
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )

      case "data-input":
        return (
          <>
            <FloatingLabel id={name} controlId={name} label={name} className=" input-hov">
              <WsSelect
                disabled={disabled}
                selectedPath={currentValue}
                acceptedExtensions={["csv"]}
                acceptFolder={settingInfos.acceptFolder ? settingInfos.acceptFolder : false}
                onChange={(e) => {
                  if (!e.target.value) {
                    setHasWarning({ state: true, tooltip: <p>No file(s) selected</p> })
                  } else {
                    setHasWarning({ state: false })
                  }
                  setInputUpdate({
                    name: name,
                    value: { id: e.target.value, name: globalData[e.target.value]?.name || "" },
                    type: settingInfos.type
                  })
                }}
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )

      case "data-input-multiple": {
        const safeName   = String(name ?? "files");
        const safeValue  = Array.isArray(currentValue) ? currentValue : [];
        const remountKey = `ws-multi-${safeName}-${safeValue.length}`;

        return (
          <div data-test="data-input-multiple" key={remountKey}>

            <WsSelectMultiple

              rootDir={undefined}         
              acceptFolder={true}          
              acceptedExtensions={["csv"]}      
              matchRegex={null}   

              whenEmpty={
                <Message
                  severity="warn"
                  text="No data file found in the workspace"
                  style={{ marginTop: 8 }}
                />
              }

              selectedPaths={safeValue}
              placeholder={safeName}
              disabled={!!disabled}

              onChange={(vals) => {
                const value = Array.isArray(vals) ? vals : [];
                if (typeof handleWarning === "function") {
                  handleWarning(
                    value.length === 0
                      ? { state: true, tooltip: <p>No file(s) selected</p> }
                      : { state: false }
                  );
                }
                setInputUpdate({ name: safeName, value, type: settingInfos.type });
              }}

              setHasWarning={(w) => {
                if (typeof handleWarning === "function") handleWarning(w);
              }}

              customProps={customProps}
            />

            {typeof createTooltip === "function" && createTooltip(settingInfos.tooltip, safeName)}
          </div>
        );
      }
      
      case "tags-input-multiple":
        return (
          <>
            <TagsSelectMultiple
              key={name}
              placeholder={name}
              disabled={!settingInfos.selectedDatasets}
              selectedTags={currentValue}
              selectedDatasets={settingInfos.selectedDatasets}
              onChange={(value) => {
                console.log("e", value)
                setInputUpdate({
                  name: name,
                  value: value,
                  type: settingInfos.type
                })
              }}
            />
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )
      case "variables-input-multiple":
        return (
          <>
            <VarsSelectMultiple
              key={name}
              placeholder={name}
              disabled={!settingInfos.selectedDatasets}
              selectedTags={settingInfos.selectedTags}
              selectedDatasets={settingInfos.selectedDatasets}
              selectedVars={currentValue}
              onChange={(value) => {
                setInputUpdate({
                  name: name,
                  value: value,
                  type: settingInfos.type
                })
              }}
            />
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )

      case "models-input":
        return (
          <>
            <FloatingLabel id={name} controlId={name} label={name} className="input-hov">
              <WsSelect
                selectedPath={currentValue}
                acceptedExtensions={["medmodel"]}
                onChange={(e) => {
                  if (!e.target.value) {
                    setHasWarning({ state: true, tooltip: <p>No file(s) selected</p> })
                  } else {
                    setHasWarning({ state: false })
                  }
                  setInputUpdate({
                    name: name,
                    value: { id: e.target.value, name: globalData[e.target.value]?.name || "" },
                    type: settingInfos.type
                  })
                }}
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )
      case "dataframe":
        return (
          <>
            <FloatingLabel id={name} controlId={name} label={name} className=" input-hov">
              <WsSelect
                disabled={disabled}
                selectedPath={currentValue}
                acceptedExtensions={["csv"]}
                acceptFolder={settingInfos.acceptFolder ? settingInfos.acceptFolder : false}
                onChange={(e, path) => {
                  console.log("e", e, path)
                  if (path == "") {
                    setHasWarning({ state: true, tooltip: <p>No file selected</p> })
                  } else {
                    setHasWarning({ state: false })
                  }
                  setInputUpdate({
                    name: name,
                    value: { name: e.target.value, path: path },
                    type: settingInfos.type
                  })
                }}
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )

        case "float-bool":
          return (
            <>
              <FloatingLabel controlId={name} label={name} className=" input-hov">
                <Form.Control
                  disabled={settingInfos.disabled || disabled || settingInfos.forceBootstrap632}
                  type="number"
                  step={settingInfos.step || "0.05"}
                  min={settingInfos.min}
                  max={settingInfos.max}
                  value={settingInfos.forceBootstrap632 ? 0.632 : currentValue}
                  onChange={(e) =>
                    setInputUpdate({
                      name: name,
                      value: parseFloat(e.target.value),
                      type: "float"
                    })
                  }
                />
              </FloatingLabel>
              {createTooltip(settingInfos.tooltip, name)}
            </>
          )

      // for all the other types of input (basically a string input for now)
      default:
        return (
          <>
            <FloatingLabel controlId={name} label={name} className="input-hov">
              <Form.Control
                disabled={disabled}
                type="text"
                defaultValue={currentValue}
                onChange={(e) =>
                  setInputUpdate({
                    name: name,
                    value: e.target.value,
                    type: settingInfos.type
                  })
                }
              />
            </FloatingLabel>
            {createTooltip(settingInfos.tooltip, name)}
          </>
        )
    }
  }
  return <>{getCorrectInputType(settingInfos)}</>
}

export default Input
