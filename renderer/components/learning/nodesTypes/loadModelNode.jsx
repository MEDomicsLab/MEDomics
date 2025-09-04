import React, { useState, useContext, useEffect } from "react"
import Node from "../../flow/node"
import Input from "../input"
import { Button, Row, Col } from "react-bootstrap"
import ModalSettingsChooser from "../modalSettingsChooser"
import * as Icon from "react-bootstrap-icons"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { Stack } from "react-bootstrap"
import { DataContext } from "../../workspace/dataContext"
import { FlowInfosContext } from "../../flow/context/flowInfosContext"
import { getCollectionData } from "../../dbComponents/utils"
import { MEDDataObject } from "../../workspace/NewMedDataObject"

/**
 *
 * @param {string} id id of the node
 * @param {object} data data of the node
 * @param {string} type type of the node
 * @returns {JSX.Element} A StandardNode node
 *
 * @description
 * This component is used to display a StandardNode node.
 * it handles the display of the node and the modal
 *
 */
const LoadModelNode = ({ id, data }) => {
  const [modalShow, setModalShow] = useState(false) // state of the modal
  const { updateNode } = useContext(FlowFunctionsContext)
  const [modelInfo, setModelInfo] = useState(null) // state of the modal
  const { globalData } = useContext(DataContext)
  const { flowContent } = useContext(FlowInfosContext)

  // set the model info when the node is mounted
  useEffect(() => {
    setModelInfo(data.internal.settings.model_to_load)
  }, [])

  // update the node internal data when the selection changes
  useEffect(() => {
    const getModelData = async () => {
      if (globalData && modelInfo) {
        const modelDataObject = globalData[modelInfo.id]
        if (modelDataObject) {
          const metadataObjectID = MEDDataObject.getChildIDWithName(globalData, modelDataObject.id, "metadata.json")
          const modelData = await getCollectionData(metadataObjectID)
          checkPreviousDatasetFormat(modelData[0])
        }
      }
    }
    getModelData()
  }, [globalData, modelInfo])

  /**
   *
   * @param {Object} inputUpdate an object containing the name of the input and its new value
   */
  const onInputChange = (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value
    if ("model_to_load" in data.internal.settings) {
      setModelInfo(data.internal.settings.model_to_load)
    }
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   *
   * @param {Object} flowContent the flow content
   * @returns {Array} an array of all the pipelines in the flow
   */
  function findAllPaths(flowContent) {
    let links = flowContent.edges
    // Create a graph as an adjacency list
    const graph = {}

    // Populate the graph based on the links
    links.forEach((link) => {
      const { source, target } = link

      if (!graph[source]) {
        graph[source] = []
      }

      graph[source].push(target)
    })

    function explore(node, path) {
      if (!graph[node]) {
        // If there are no outgoing links from this node, add the path to the result
        let isValid = true
        path.forEach((id) => {
          let node = flowContent.nodes.find((node) => node.id == id)
          if (node.type == "groupNode") {
            isValid = false
          }
        })
        isValid =
          isValid &&
          flowContent.nodes
            .find((node) => node.id == path[path.length - 1])
            .data.setupParam.classes.split(" ")
            .includes("endNode")
        isValid && result.push(path)
        return
      }

      graph[node].forEach((neighbor) => {
        // Avoid cycles by checking if the neighbor is not already in the path
        if (!path.includes(neighbor)) {
          explore(neighbor, [...path, neighbor])
        }
      })
    }

    const result = []

    Object.keys(graph).forEach((id) => {
      let sourceNode = flowContent.nodes.find((node) => node.id == id)
      if (sourceNode.data.setupParam.classes.split(" ").includes("startNode")) {
        explore(id, [id])
      }
    })

    return result
  }

  /**
   *
   * @param {Object} modelData the model data
   *
   * @description
   * This function is used to check if the dataset connected to the model respects the model format
   */
  const checkPreviousDatasetFormat = (modelData) => {
    let pipelines = findAllPaths(flowContent)
    pipelines.forEach((pipeline) => {
      if (pipeline.includes(id)) {
        let datasetNode = flowContent.nodes.find((node) => node.id == pipeline[0])

        let datasetNodeModelData = datasetNode.data.internal.settings
        let datasetNodeModelDataFormatted = {}
        if (datasetNodeModelData.columns && datasetNodeModelData.target) {
          datasetNodeModelDataFormatted = { columns: Object.keys(datasetNodeModelData.columns), target: datasetNodeModelData.target }
        }
        let modelDataFormatted = { columns: modelData.columns, target: modelData.target }
        if (JSON.stringify(datasetNodeModelDataFormatted) == JSON.stringify(modelDataFormatted)) {
          datasetNode.data.internal.hasWarning = { state: false }
        } else {
          datasetNode.data.internal.hasWarning = {
            state: true,
            tooltip: (
              <>
                <div className="evaluation-tooltip">
                  <h4>This dataset does not respect the model format</h4>
                  {/* here is a list of the needed columns */}
                  <div style={{ maxHeight: "400px", overflowY: "auto", overflowX: "hidden" }}>
                    <Row>
                      <Col>
                        <p>Needed target:</p>
                        <ul>{modelDataFormatted.target}</ul>
                      </Col>
                      <Col>
                        <p>Received target:</p>
                        <ul>{datasetNodeModelDataFormatted.target}</ul>
                      </Col>
                    </Row>
                    <Row>
                      <Col>
                        <p>Needed columns:</p>
                        <ul>
                          {modelDataFormatted.columns.map((col) => {
                            return <li key={col}>{col}</li>
                          })}
                        </ul>
                      </Col>
                      <Col>
                        <p>Received columns:</p>
                        <ul>
                          {datasetNodeModelDataFormatted.columns.map((col) => {
                            return <li key={col}>{col}</li>
                          })}
                        </ul>
                      </Col>
                    </Row>
                  </div>
                </div>
              </>
            )
          }
        }
        updateNode({
          id: datasetNode.id,
          updatedData: datasetNode.data.internal
        })
      }
    })
  }

  /**
   *
   * @param {Object} hasWarning an object containing the state of the warning and the tooltip
   */
  const handleWarning = (hasWarning) => {
    data.internal.hasWarning = hasWarning
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
        // no body for this node (particular to this node)
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          <>
            {"default" in data.setupParam.possibleSettings && (
              <>
                <Stack direction="vertical" gap={1}>
                  {Object.entries(data.setupParam.possibleSettings.default).map(([settingName, setting]) => {
                    return (
                      <Input
                        setHasWarning={handleWarning}
                        key={settingName}
                        name={settingName}
                        settingInfos={setting}
                        currentValue={data.internal.settings[settingName].id}
                        onInputChange={onInputChange}
                      />
                    )
                  })}
                </Stack>
              </>
            )}
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={
          <>
            {/* the button to open the modal (the plus sign)*/}
            <Button variant="light" className="width-100 btn-contour" onClick={() => setModalShow(true)}>
              <Icon.Plus width="30px" height="30px" className="img-fluid" />
            </Button>
            {/* the modal component*/}
            <ModalSettingsChooser show={modalShow} onHide={() => setModalShow(false)} options={data.setupParam.possibleSettings.options} data={data} id={id} />
            {/* the inputs for the options */}
            {data.internal.checkedOptions.map((optionName) => {
              return (
                <Input
                  key={optionName}
                  name={optionName}
                  settingInfos={data.setupParam.possibleSettings.options[optionName]}
                  currentValue={data.internal.settings[optionName]}
                  onInputChange={onInputChange}
                />
              )
            })}
          </>
        }
        // Link to documentation
        nodeLink={"https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/development/learning-module"}
      />
    </>
  )
}

export default LoadModelNode
