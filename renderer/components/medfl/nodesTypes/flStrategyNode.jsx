import React, { useContext } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

export default function FlStrategyNode({ id, data }) {
  // context
  // context
  const AGGRERATION_ALGORITHMS = [
    "Bulyan",
    "DPFedAvgAdaptive",
    "DPFedAvgFixed",
    "FaultTolerantFedAvg",
    "FedAdagrad",
    "FedAdam",
    "FedAvg",
    "FedAvgAndroid",
    "FedAvgM",
    "FedMedian",
    "FedOpt",
    "FedProx",
    "FedTrimmedAvg",
    "FedXgbBagging",
    "FedXgbCyclic",
    "FedXgbNnAvg",
    "FedYogi",
    "Krum",
    "QFedAvg"
  ]
  const { updateNode } = useContext(FlowFunctionsContext)

  const onModelInputChange = (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value

    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

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
              name="Aggregation algorithm"
              settingInfos={{
                type: "list",
                tooltip: "Specify the desription of the federated setup",
                choices: AGGRERATION_ALGORITHMS.map((algo) => {
                  return { name: algo }
                })
              }}
              currentValue={data.internal.settings["Aggregation algorithm"]}
              onInputChange={onModelInputChange}
              setHasWarning={() => {}}
            />

            <FlInput
              name="Evaluation fraction"
              settingInfos={{
                type: "float",
                tooltip: "Specify the desription of the federated setup"
              }}
              currentValue={data.internal.settings["Evaluation fraction"]}
              onInputChange={onModelInputChange}
              setHasWarning={() => {}}
            />

            <FlInput
              name="Training fraction"
              settingInfos={{
                type: "float",
                tooltip: "Specify the desription of the federated setup"
              }}
              currentValue={data.internal.settings["Training fraction"]}
              onInputChange={onModelInputChange}
              setHasWarning={() => {}}
            />

            <FlInput
              name="Minimal used clients for evaluation"
              settingInfos={{
                type: "int",
                tooltip: "Specify the desription of the federated setup"
              }}
              currentValue={data.internal.settings["Minimal used clients for evaluation"]}
              onInputChange={onModelInputChange}
              setHasWarning={() => {}}
            />

            <FlInput
              name="Minimal used clients for training"
              settingInfos={{
                type: "int",
                tooltip: "Specify the desription of the federated setup"
              }}
              currentValue={data.internal.settings["Minimal used clients for training"]}
              onInputChange={onModelInputChange}
              setHasWarning={() => {}}
            />

            <FlInput
              name="Minimal available clients"
              settingInfos={{
                type: "int",
                tooltip: "Specify the desription of the federated setup"
              }}
              currentValue={data.internal.settings["Minimal available clients"]}
              onInputChange={onModelInputChange}
              setHasWarning={() => {}}
            />
             <FlInput
              name="clientRessources"
              settingInfos={{
                type: "list",
                tooltip: "Specify the desription of the federated setup",
                choices: [{ name: "Use GPU" }, { name: " Use only CPU" }]
              }}
              currentValue={data.internal.settings.clientRessources}
              onInputChange={onModelInputChange}
              setHasWarning={() => {}}
            />
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={<></>}
      />
    </>
  )
}
