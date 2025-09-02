import React, { useContext, useEffect, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { requestBackend } from "../../../utilities/requests"
import ServerLogosModal from "../rw/SeverLogsModal"

export default function FlRunServerNode({ id, data }) {
  // context
  const { updateNode } = useContext(FlowFunctionsContext)

  const [serverAddress, setServerAddress] = useState(data.internal.settings.serverAddress || "0.0.0.0:8080")
  const [numRounds, setNumRounds] = useState(data.internal.settings.numRounds || 10)
  const [fractionFit, setFractionFit] = useState(data.internal.settings.fractionFit || 1)
  const [fractionEvaluate, setFractionEvaluate] = useState(data.internal.settings.fractionEvaluate || 1)
  const [minFitClients, setMinFitClients] = useState(data.internal.settings.minFitClients || 3)
  const [minEvaluateClients, setMinEvaluateClients] = useState(data.internal.settings.minEvaluateClients || 3)
  const [minAvailableClients, setMinAvailableClients] = useState(data.internal.settings.minAvailableClients || 3)
  const [strategy, setStrategy] = useState(data.internal.settings.strategy || "FedAvg")
  const [isSaveModel, setIsSaveModel] = useState(data.internal.settings.isSaveModel || false)
  const [saveOnRounds, setSaveRounds] = useState(data.internal.settings.saveOnRounds || 5)

  useEffect(() => {
    data.internal.settings.strategy = strategy
    data.internal.settings.serverAddress = serverAddress
    data.internal.settings.numRounds = numRounds
    data.internal.settings.fractionFit = fractionFit
    data.internal.settings.fractionEvaluate = fractionEvaluate
    data.internal.settings.minFitClients = minFitClients
    data.internal.settings.minEvaluateClients = minEvaluateClients
    data.internal.settings.minAvailableClients = minAvailableClients
    data.internal.settings.isSaveModel = isSaveModel
    data.internal.settings.saveOnRounds = saveOnRounds

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }, [strategy, serverAddress, numRounds, fractionFit, fractionEvaluate, minFitClients, minEvaluateClients, minAvailableClients, isSaveModel, saveOnRounds])

  return (
    <>
      {/* build on top of the Node component */}
      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        // the body of the node is a form select (particular to this node)
        nodeBody={<></>}
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          <>
            <FlInput
              name="Server Address"
              currentValue={serverAddress}
              onInputChange={(v) => setServerAddress(v.value)}
              settingInfos={{ type: "string", tooltip: "e.g., 0.0.0.0:8080" }}
              setHasWarning={() => {}}
            />
            <FlInput
              name="Number of Rounds"
              currentValue={numRounds}
              onInputChange={(v) => setNumRounds(Number(v.value))}
              settingInfos={{ type: "int", tooltip: "Total training rounds" }}
              setHasWarning={() => {}}
            />
            {/* <FlInput
            name="Fraction Fit"
            currentValue={fractionFit}
            onInputChange={(v) => setFractionFit(Number(v.value))}
            settingInfos={{ type: "float", tooltip: "Fraction of clients for training" }}
            setHasWarning={() => {}}
          />
          <FlInput
            name="Fraction Evaluate"
            currentValue={fractionEvaluate}
            onInputChange={(v) => setFractionEvaluate(Number(v.value))}
            settingInfos={{ type: "float", tooltip: "Fraction of clients for evaluation" }}
            setHasWarning={() => {}}
          /> */}
            {/* <FlInput
            name="Min Fit Clients"
            currentValue={minFitClients}
            onInputChange={(v) => setMinFitClients(Number(v.value))}
            settingInfos={{ type: "int" }}
            setHasWarning={() => {}}
          />
          <FlInput
            name="Min Evaluate Clients"
            currentValue={minEvaluateClients}
            onInputChange={(v) => setMinEvaluateClients(Number(v.value))}
            settingInfos={{ type: "int" }}
            setHasWarning={() => {}}
          /> */}
            <FlInput
              name="Min Available Clients"
              currentValue={minAvailableClients}
              onInputChange={(v) => setMinAvailableClients(Number(v.value))}
              settingInfos={{ type: "int" }}
              setHasWarning={() => {}}
            />
            <FlInput name="Strategy" currentValue={strategy} onInputChange={(v) => setStrategy(v.value)} settingInfos={{ type: "string", tooltip: "e.g., FedAvg" }} setHasWarning={() => {}} />
            <div className="form-check form-switch m-2 w-100 ">
              <input className="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckDefault" checked={isSaveModel} onChange={(e) => setIsSaveModel(e.target.checked)} />
              <label className="form-check-label" for="flexSwitchCheckDefault">
                Save model
              </label>
            </div>
            {isSaveModel && (
              <FlInput name="Save model every N rounds" currentValue={saveOnRounds} onInputChange={(v) => setSaveRounds(Number(v.value))} settingInfos={{ type: "int" }} setHasWarning={() => {}} />
            )}
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={<></>}
      />
    </>
  )
}
