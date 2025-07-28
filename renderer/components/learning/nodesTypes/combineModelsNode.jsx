import { InputSwitch } from "primereact/inputswitch"
import { Button, Stack } from "react-bootstrap"
import * as Icon from "react-bootstrap-icons"
import Node from "../../flow/node"
import Input from "../input"
import ModalSettingsChooser from "../modalSettingsChooser"
import { useContext, useEffect, useState } from "react"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { SelectButton } from 'primereact/selectbutton'

const CombineModelsNode = ({ id, data }) => {
  const { updateNode } = useContext(FlowFunctionsContext)
  const [modalShow, setModalShow] = useState(false)
  const [calibrateEnabled, setCalibrateEnabled] = useState(data.internal.settings.calibrate ?? false)  
  const [calibrateModalShow, setCalibrateModalShow] = useState(false)

  useEffect(() => {
    if (!data.internal.settings) data.internal.settings = {}
    if (!data.internal.checkedOptions) data.internal.checkedOptions = []
    if (!data.internal.settings.optimize_fct) data.internal.settings.optimize_fct = "blend_models"
    if (!("calibrate" in data.internal.settings)) {data.internal.settings.calibrate = false}
    updateNode({ id, updatedData: data.internal })
  }, [])

  const currentAlgo = data.internal.settings.optimize_fct
  const isBlend = currentAlgo === 'blend_models'

  const handleToggle = (algoKey, value) => {
    if (!value) return
    data.internal.settings.optimize_fct = algoKey
    updateNode({ id, updatedData: data.internal })
  }

  const onInputChange = ({ name, value }) => {
    data.internal.settings[name] = value
    updateNode({ id, updatedData: data.internal })
  }

  const handleWarning = (hasWarning) => {
    data.internal.hasWarning = hasWarning
    updateNode({ id, updatedData: data.internal })
  }

  // Section switch blend/stack
  const algoOptions = [
    { label: 'Stack', value: 'stack_models' },
    { label: 'Blend', value: 'blend_models' }
  ]
  
  const nodeBody = (
    <div className="d-flex justify-content-center">
      <SelectButton
        value={currentAlgo}
        options={algoOptions}
        onChange={(e) => {
          data.internal.settings.optimize_fct = e.value
          updateNode({ id, updatedData: data.internal })
        }}
        className="mx-2"
        unselectable={false}
      />
    </div>
  )
  

  return (
    <>
      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        nodeBody={nodeBody}
        defaultSettings={null}
        nodeSpecific={
          <>
            {/* blend/stack options */}
            <Stack direction="horizontal" className="justify-content-between align-items-center my-2">
            <span className="text-muted" style={{ fontSize: "0.9rem" }}>
              Select function options
            </span>
            <Button
              variant="light"
              className="btn-contour"
              onClick={() => setModalShow(true)}
            >
              <Icon.Plus width="20px" height="20px" className="img-fluid" />
            </Button>
          </Stack>

            {/* Modal blend/stack */}
            <ModalSettingsChooser
              show={modalShow}
              onHide={() => setModalShow(false)}
              options={data.setupParam.possibleSettings.options?.[currentAlgo]?.options || {}}
              data={data}
              id={id}
              title={isBlend ? "Blend Options" : "Stack Options"}
            />

            {/* Modal calibrate */}
            <ModalSettingsChooser
              show={calibrateModalShow}
              onHide={() => setCalibrateModalShow(false)}
              options={data.setupParam.possibleSettings.options?.calibrate?.options || {}}
              data={data}
              id={id}
              parentKey="calibrate"
              title="Calibrate Options"
            />

            {/* Blend/stack parameters */}
            {data.internal.checkedOptions?.map((optionName) => {
              const setting = data.setupParam.possibleSettings.options?.[currentAlgo]?.options?.[optionName]
              return setting ? (
                <Input
                  key={optionName}
                  name={optionName}
                  settingInfos={setting}
                  currentValue={data.internal.settings?.[optionName]}
                  onInputChange={onInputChange}
                  setHasWarning={handleWarning}
                />
              ) : null
            })}

            {/* Switch Calibrate */}
            <Stack direction="horizontal" className="align-items-center justify-content-between mt-2">
              <span style={{ fontWeight: 'normal' }}>Calibrate</span>
              <InputSwitch
                checked={calibrateEnabled}
                onChange={(e) => {
                  const newState = e.value
                  setCalibrateEnabled(newState)
                  data.internal.settings.calibrate = newState
                  updateNode({ id, updatedData: data.internal })

                  if (newState) setCalibrateModalShow(true)
                }}
                className="mx-2"
              />
            </Stack>

            
            {/* Affichage des paramètres calibrate */}
            {data.internal.checkedOptions?.map((optionName) => {
              const setting = data.setupParam.possibleSettings.options?.calibrate?.options?.[optionName]
              return setting ? (
                <Input
                  key={optionName}
                  name={optionName}
                  settingInfos={setting}
                  currentValue={data.internal.settings?.[optionName]}
                  onInputChange={onInputChange}
                  setHasWarning={handleWarning}
                />
              ) : null
            })}
          </>
        }
        nodeLink={"https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/development/learning-module"}
      />
    </>
  )
}

export default CombineModelsNode
