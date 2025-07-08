import { InputSwitch } from "primereact/inputswitch"
import { Button, Stack } from "react-bootstrap"
import * as Icon from "react-bootstrap-icons"
import Node from "../../flow/node"
import Input from "../input"
import ModalSettingsChooser from "../modalSettingsChooser"
import { useContext, useEffect, useState } from "react"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

const CombineModelsNode = ({ id, data }) => {
  const { updateNode } = useContext(FlowFunctionsContext)
  const [modalShow, setModalShow] = useState(false)


  useEffect(() => {
    if (!data.internal.settings) data.internal.settings = {}
    if (!data.internal.checkedOptions) data.internal.checkedOptions = []
    if (!data.internal.settings.optimize_fct) data.internal.settings.optimize_fct = "blend_models"
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


  // Switch blend/stack
  const nodeBody = (
    <Stack direction="horizontal" className="align-items-center justify-content-between">
      <span style={{ fontWeight: !isBlend ? 'bold' : 'normal' }}>
        Stack
      </span>
      <InputSwitch
        checked={isBlend}
        onChange={(e) => {
          const newAlgo = e.value ? 'blend_models' : 'stack_models'
          data.internal.settings.optimize_fct = newAlgo
          updateNode({ id, updatedData: data.internal })
        }}
        className="mx-2"
      />
      <span style={{ fontWeight: isBlend ? 'bold' : 'normal' }}>
        Blend
      </span>
    </Stack>
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
            {/* button for parameters selection */}
            <Button
              variant="light"
              className="width-100 btn-contour"
              onClick={() => setModalShow(true)}
            >
              <Icon.Plus width="30px" height="30px" className="img-fluid" />
            </Button>

            {/* Modal based on blend/stack */}
            <ModalSettingsChooser
              show={modalShow}
              onHide={() => setModalShow(false)}
              options={data.setupParam.possibleSettings.options?.[currentAlgo]?.options || {}}
              data={data}
              id={id}
            />

            {/* selected parameters */}
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

            
          </>
        }
        nodeLink={"https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/development/learning-module"}
      />
    </>
  )
}

export default CombineModelsNode
