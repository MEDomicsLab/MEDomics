import { Markup } from "interweave"
import { Button } from "primereact/button"
import { Chip } from "primereact/chip"
import { Chips } from "primereact/chips"
import { InputNumber } from "primereact/inputnumber"
import { InputSwitch } from "primereact/inputswitch"
import { Message } from "primereact/message"
import { SelectButton } from "primereact/selectbutton"
import { Tooltip } from "primereact/tooltip"
import React, { useEffect, useState } from "react"
import { toast } from "react-toastify"

/**
 * Component for defining hyperparameter values for grid search tuning
 * 
 * @param {string} name - name of the hyperparameter
 * @param {object} paramInfo - information about the hyperparameter 
 *                            (type, tooltip, min, max, etc.)
 * @param {array|any} currentValue - current value(s) of the hyperparameter
 * @param {function} onParamChange - callback when values change
 * @param {boolean} disabled - whether the input is disabled
 * @param {function} setHasWarning - callback to notify parent about warnings
 * @returns {JSX.Element} Hyperparameter input component
 */
const HyperParameterInput = ({ 
  name, 
  model,
  paramInfo, 
  currentValue, 
  currentGridValues,
  onParamChange, 
  disabled = false, 
  setHasWarning = () => {} 
}) => {
  // Input mode options: 'discrete' for manually specified values, 'range' for value ranges
  const inputModeOptions = [
    { label: 'Discrete', value: 'discrete' },
    { label: 'Range', value: 'range' }
  ]

  const [inputValue, setInputValue] = useState(null)
  const [inputMode, setInputMode] = useState('discrete')
  const [discreteValues, setDiscreteValues] = useState(currentGridValues || [])
  const [rangeStart, setRangeStart] = useState(null)
  const [rangeEnd, setRangeEnd] = useState(null)
  const [rangeStep, setRangeStep] = useState(null)
  const [gridValues, setGridValues] = useState(currentGridValues || [])
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  // Initialize component state based on currentValue prop
  useEffect(() => {
    if (currentValue) {
      currentValue = Array.isArray(currentValue) ? currentValue : parseInputValue(currentValue)
      if (Array.isArray(currentValue)) {
        setInputMode('discrete')
        setDiscreteValues(currentGridValues || currentValue)
      } else if (typeof currentValue === 'object' && currentValue.start && currentValue.end) {
        setInputMode('range')
        setRangeStart(currentValue.start)
        setRangeEnd(currentValue.end)
        setRangeStep(currentValue.step || getDefaultStep(paramInfo.type))
      } else {
        setInputMode('discrete')
        setDiscreteValues(currentGridValues || [currentValue])
      }
    } else {
      // Default initialization
      setDiscreteValues(currentGridValues || [])
      setRangeStart(paramInfo.min || 0)
      setRangeEnd(paramInfo.max || 10)
      setRangeStep(getDefaultStep(paramInfo.type))
    }
  }, [])

  // Helper function to get default step based on parameter type
  const getDefaultStep = (type) => {
    switch (type) {
      case 'int':
        return 1
      case 'float':
        return 0.1
      default:
        return 1
    }
  }

  // Validate inputs and generate grid values based on current settings
  const generateGridValues = () => {
    if (inputMode === 'discrete') {
      throw new Error("Discrete mode must be range mode")
    }
    let newGridValues = []
    if (rangeStart === null || rangeEnd === null || rangeStep === null) {
      setGridValues(currentGridValues || [])
      !currentGridValues && setHasError(true)
      !currentGridValues && setErrorMessage("Range values cannot be empty")
      newGridValues = currentGridValues || []
    }

    if (rangeStep <= 0) {
      setGridValues(currentGridValues || [])
      setHasError(true)
      setErrorMessage("Step must be greater than 0")
      newGridValues = currentGridValues || []
    }

    if (rangeStart > rangeEnd) {
      setGridValues(currentGridValues || [])
      setHasError(true)
      setErrorMessage("Start value must be less than end value")
      newGridValues = currentGridValues || []
    }

    if (newGridValues.length > 0) {
      onParamChange(model, {
        name: name,
        value: newGridValues,
        type: paramInfo.type,
        mode: inputMode
      })
      return
    }
    
    // Clear previous error state
    setHasError(false)
    setErrorMessage("")

    // Generate values within range
    const values = []
    let current = rangeStart
    
    while (current <= rangeEnd) {
      if (paramInfo.type === 'int') {
        values.push(Math.round(current))
      } else {
        values.push(Number(current.toFixed(5))) // Limit float precision
      }
      current += rangeStep
    }
    setGridValues(values)
    
    // Update parent component with new grid values
    onParamChange(model, {
      name: name,
      value: values,
      type: paramInfo.type,
      mode: inputMode
    })
  }

  // Update parent component when values change
  useEffect(() => {
    if (inputMode === 'range'){
      generateGridValues()
    } else if (inputMode === 'discrete') {
      if (!hasError &&  discreteValues.length > 0) {
        onParamChange(model, {
          name: name,
          value: discreteValues,
          type: paramInfo.type,
          mode: inputMode
        })
      }
    }
    setHasWarning(hasError)
  }, [inputMode, discreteValues, rangeStart, rangeEnd, rangeStep])

  // Parse input value to handle different types
  const parseInputValue = (value) => {
    if (paramInfo.type === 'int') {
      if (!/^-?\d+$/.test(String(value))) {
        toast.warn("Value must be an integer", { position: "bottom-right" })
        value = Math.round(Number(value))
      } else {
        value = parseInt(value)
      }
    } else if (paramInfo.type === 'float') {
      if (isNaN(Number(value))) {
        toast.warn("Value must be a number", { position: "bottom-right" })
        return
      }
      value = parseFloat(value)
    } else if (paramInfo.type === 'bool') {
      value = value === 'True' || value === true
    }
    return value
  }

  // Handle adding a discrete value based on parameter type
  const handleAddDiscreteValue = (value) => {
    if (value === null || value === undefined || value === '') return
    
    // Validate based on type
    let validatedValue = parseInputValue(value)
    if (!validatedValue) return

    // Check if value already exists
    if (!discreteValues.includes(validatedValue)) {
      setDiscreteValues([...discreteValues, validatedValue])
    }
  }

  // Handle removing a discrete value
  const handleRemoveDiscreteValue = (index) => {
    const newValues = [...discreteValues]
    newValues.splice(index, 1)
    setDiscreteValues(newValues)
  }

  // Create tooltip with description
  const renderTooltip = () => {
    if (paramInfo.tooltip) {
      return (
        <Tooltip target={`.param-${name}`} position="left">
          <Markup content={paramInfo.tooltip} />
        </Tooltip>
      )
    }
    return null
  }

  // Render discrete value input based on parameter type
  const renderDiscreteInput = () => {
    switch (paramInfo.type) {
      case 'string':
        return (
          <Chips
            value={discreteValues}
            onChange={(e) => setDiscreteValues(e.value)}
            disabled={disabled}
            placeholder="Enter value and press Enter"
            className="w-full"
          />
        )
        
      case 'int':
        return (
          <div className="flex flex-column gap-2">
            <div className="flex align-items-center gap-2">
              <InputNumber
                disabled={disabled}
                min={paramInfo.min}
                max={paramInfo.max}
                value={inputValue}
                placeholder="Add integer value"
                onValueChange={(e) => setInputValue(e.value)}
              />
              <Button
                icon="pi pi-plus"
                onClick={() => {
                  if (inputValue) {
                    handleAddDiscreteValue(inputValue)
                    setInputValue(null)
                  }
                }}
                disabled={disabled}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {discreteValues.map((val, idx) => (
                <Chip
                  key={`chip-${idx}-${val}`}
                  label={val.toString()}
                  removable
                  onRemove={() => handleRemoveDiscreteValue(idx)}
                />
              ))}
            </div>
          </div>
        )
        
      case 'float':
        return (
          <div className="flex flex-column gap-2">
            <div className="flex gap-2">
              <InputNumber
                disabled={disabled}
                min={paramInfo.min}
                max={paramInfo.max}
                placeholder="Add float value"
                mode="decimal"
                minFractionDigits={1}
                maxFractionDigits={6}
                value={inputValue}
                onValueChange={(e) => setInputValue(e.value)}
                className="w-full"
              />
              <Button 
                icon="pi pi-plus" 
                onClick={() => {
                  if (inputValue) {
                    handleAddDiscreteValue(inputValue)
                    setInputValue(null)
                  }
                }}
                disabled={disabled}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {discreteValues.map((val, idx) => (
                <Chip
                  key={`chip-${idx}-${val}`}
                  label={val.toString()}
                  removable
                  onRemove={() => handleRemoveDiscreteValue(idx)}
                />
              ))}
            </div>
          </div>
        )
        
      case 'bool':
        return (
          <div className="flex align-center gap-3">
            <div className="mb-3 d-flex align-items-center">
              <InputSwitch
                checked={discreteValues.includes(true)}
                onChange={(e) => {
                  let newValues = [...discreteValues]
                  if (e.value && !newValues.includes(true)) {
                    newValues.push(true)
                  } else if (!e.value) {
                    newValues = newValues.filter(v => v !== true)
                  }
                  setDiscreteValues(newValues)
                }}
                disabled={disabled}
              />
              <span style={{marginLeft: "4px"}}>True</span>
            </div>
            <div className="mb-3 d-flex align-items-center">
              <InputSwitch
                checked={discreteValues.includes(false)}
                onChange={(e) => {
                  let newValues = [...discreteValues]
                  if (e.value && !newValues.includes(false)) {
                    newValues.push(false)
                  } else if (!e.value) {
                    newValues = newValues.filter(v => v !== false)
                  }
                  setDiscreteValues(newValues)
                }}
                disabled={disabled}
              />
              <span style={{marginLeft: "4px"}}>False</span>
            </div>
          </div>
        )
        
      default:
        return (
          <Chips
            value={discreteValues}
            onChange={(e) => setDiscreteValues(e.value)}
            disabled={disabled}
            placeholder="Enter value and press Enter"
            className="w-full"
          />
        )
    }
  }

  // Render range input fields (only applicable for numeric types)
  const renderRangeInput = () => {
    if (paramInfo.type !== 'int' && paramInfo.type !== 'float') {
      return (
        <Message severity="warn" text="Range mode is only available for numeric parameters" />
      )
    }

    const isInteger = paramInfo.type === 'int'
    
    return (
      <div className="flex flex-column gap-3">
        <div className="grid">
          <div className="flex align-center col-12 md:col-4">
            <span className="p-float-label">
              <InputNumber
                id={`${name}-start`}
                value={rangeStart}
                onValueChange={(e) => setRangeStart(e.value)}
                mode={isInteger ? "decimal" : "decimal"}
                minFractionDigits={isInteger ? 0 : 1}
                maxFractionDigits={isInteger ? 0 : 6}
                min={paramInfo.min}
                max={paramInfo.max}
                disabled={disabled}
                className="w-full"
              />
              <label htmlFor={`${name}-start`}>Start</label>
            </span>
          </div>
          <div className="flex align-center col-12 md:col-4">
            <span className="p-float-label">
              <InputNumber
                id={`${name}-end`}
                value={rangeEnd}
                onValueChange={(e) => setRangeEnd(e.value)}
                mode={isInteger ? "decimal" : "decimal"}
                minFractionDigits={isInteger ? 0 : 1}
                maxFractionDigits={isInteger ? 0 : 6}
                min={paramInfo.min}
                max={paramInfo.max}
                disabled={disabled}
                className="w-full"
              />
              <label htmlFor={`${name}-end`}>End</label>
            </span>
          </div>
          <div className="flex align-center col-12 md:col-4">
            <span className="p-float-label">
              <InputNumber
                id={`${name}-step`}
                value={rangeStep}
                onValueChange={(e) => setRangeStep(e.value)}
                mode="decimal"
                minFractionDigits={isInteger ? 0 : 1}
                maxFractionDigits={isInteger ? 0 : 6}
                min={0.000001}
                disabled={disabled}
                className="w-full"
              />
              <label htmlFor={`${name}-step`}>Step</label>
            </span>
          </div>
        </div>

        <div className="grid-preview mt-3">
          <h5>Grid Values ({gridValues?.length})</h5>
          <div className="p-2 border-1 border-round border-300 bg-gray-50 overflow-auto" style={{ maxHeight: '100px' }}>
            <code>{gridValues?.join(', ')}</code>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`hyper-param-input param-${name}`}>
      {renderTooltip()}
      <div className="p-3 mb-3" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
        <div className="flex align-items-center" style={{ marginBottom: '1rem' }}>
          <h6 className="flex align-center">{name}</h6>
          {(paramInfo.type === 'int' || paramInfo.type === 'float') && (
            <SelectButton 
              className="flex align-center"
              value={inputMode} 
              options={inputModeOptions} 
              onChange={(e) => {
                setInputMode(e.value)
                setHasError(false)
                setErrorMessage("")
              }}
              disabled={disabled || (paramInfo.type !== 'int' && paramInfo.type !== 'float')}
            />
          )}
        </div>
        
        {inputMode === 'discrete' ? renderDiscreteInput() : renderRangeInput()}
        
        {hasError && <Message severity="error" text={errorMessage} className="mt-2" />}
      </div>
    </div>
    
  )
}

export default HyperParameterInput