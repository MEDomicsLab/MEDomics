import React, { useContext, useState, useEffect } from "react"
import Card from "react-bootstrap/Card"
import { Col } from "react-bootstrap"
import { FlowResultsContext } from "../context/flowResultsContext"
import { FlowInfosContext } from "../context/flowInfosContext"
import { FlowFunctionsContext } from "../context/flowFunctionsContext"
import Button from "react-bootstrap/Button"
import * as Icon from "react-bootstrap-icons"
import PipelinesResults from "./pipelinesResults"
import { RadioButton } from "primereact/radiobutton"

/**
 *
 * @returns {JSX.Element} A results pane accessed by using the menu tree
 *
 * @description
 * This component is used to display the results of the pipeline according to the selected nodes.
 *
 */
const ResultsPane = () => {
  const { setShowResultsPane } = useContext(FlowResultsContext)
  const { flowContent } = useContext(FlowInfosContext)
  const { updateNode } = useContext(FlowFunctionsContext)
  const [selectedPipelines, setSelectedPipelines] = useState([])
  const [selectionMode, setSelectionMode] = useState("Compare Mode")

  const handleClose = () => setShowResultsPane(false)

  // check if id is in all the pipeline, if yes, update it such as it indicates it is checked by context
  useEffect(() => {
    let contextCheckedIds = []
    let firstPipeline = selectedPipelines[0]
    if (firstPipeline) {
      firstPipeline.forEach((id) => {
        let isEverywhere = true
        selectedPipelines.forEach((pipeline) => {
          if (!pipeline.includes(id)) {
            isEverywhere = false
          }
        })
        isEverywhere && contextCheckedIds.push(id)
      })
    }

    if (flowContent.nodes) {
      flowContent.nodes.forEach((node) => {
        if (!node.data.internal.results.checked) {
          if (node.data.internal.results.contextChecked != contextCheckedIds.includes(node.id)) {
            node.data.internal.results.contextChecked = contextCheckedIds.includes(node.id)
            updateNode({
              id: node.id,
              updatedData: node.data.internal
            })
          }
        }
      })
    }
  }, [selectedPipelines, flowContent])

  useEffect(() => {
    if (flowContent.nodes) {
      // find selected ids
      let selectedIds = []
      flowContent.nodes.forEach((node) => {
        if (node.data.internal.results.checked) {
          selectedIds.push(node.id)
        }
      })

      // find all pipelines
      let pipelines = findAllPaths(flowContent)

      // find pipelines that includes all the selected ids
      let selectedPipelines = []
      pipelines.forEach((pipeline) => {
        let found = true
        selectedIds.forEach((id) => {
          if (!pipeline.includes(id)) {
            found = false
          }
        })
        if (found) {
          selectedPipelines.push(pipeline)
        }
      })
      setSelectedPipelines(selectedPipelines)
    }
  }, [flowContent])

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
          // this condition is here because a group node creates another path wich is not valid
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

  return (
    <>
      <Col className=" padding-0 results-Panel">
        <Card>
          <Card.Header>
            <div className="flex justify-content-center">
              <div className="gap-3 results-header">
                <div className="flex align-items-center">
                  <h5>Results</h5>
                </div>
                {selectedPipelines.length > 1 && (
                  <>
                    <div className="flex align-items-center">
                      <RadioButton inputId="compareMode" name="selectionModeGroup" value="Compare Mode" onChange={(e) => setSelectionMode(e.value)} checked={selectionMode == "Compare Mode"} />
                      <label htmlFor="compareMode" className="ml-2">
                        Compare Mode
                      </label>
                    </div>
                    <div className="flex align-items-center">
                      <RadioButton inputId="singleSelection" name="pizza" value="Single Selection" onChange={(e) => setSelectionMode(e.value)} checked={selectionMode == "Single Selection"} />
                      <label htmlFor="singleSelection" className="ml-2">
                        Single Selection
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
            <Button variant="outline closeBtn closeBtn-resultsPane end-5" onClick={handleClose}>
              <Icon.X width="30px" height="30px" />
            </Button>
          </Card.Header>
          <Card.Body>
            <PipelinesResults pipelines={selectedPipelines} selectionMode={selectionMode} flowContent={flowContent} />
          </Card.Body>
        </Card>
      </Col>
    </>
  )
}

export default ResultsPane
