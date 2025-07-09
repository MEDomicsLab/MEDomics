import { useContext, useState, useEffect } from "react"
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
const ResultsPane = ({ runFinalizeAndSave }) => {
  const { setShowResultsPane, flowResults } = useContext(FlowResultsContext)
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
      let pipelines = findBoxAnalysisPaths(flowResults)

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

  /**
   * Finds all paths to 'box-analysis' nodes in a nested dictionary structure
   * @param {Object} dict - The nested dictionary to search
   * @returns {Array<Array<string>>} - List of paths (each path is an array of keys)
   */
  const findBoxAnalysisPaths = (dict) => {
    const paths = []

    const traverse = (currentDict, currentPath = []) => {
      if (!currentDict || typeof currentDict !== 'object') return

      // Check if current level has 'box-analysis' in next_nodes
      if (currentDict.next_nodes && 'box-analysis' in currentDict.next_nodes) {
        paths.push([...currentPath, 'box-analysis'])
      }

      // Recursively search through next_nodes
      if (currentDict.next_nodes) {
        Object.entries(currentDict.next_nodes).forEach(([key, value]) => {
          if (key.includes("*")) {
            // Drop train model node
            key.split("*").forEach((part) => {
              const nodeType = flowContent.nodes.find(node => node.id === part)?.data?.internal?.type
              if (nodeType !== "train_model") {
                traverse(value, [...currentPath, part])
              }
            })
          } else {            
            traverse(value, [...currentPath, key])
          }
        })
      }
    }

    Object.entries(dict).forEach(([key, value]) => {
      traverse(value, [key])
    })

    return paths
}

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
      
      const sourceNode = flowContent.nodes.find((node) => node.id == source)
      const targetNode = flowContent.nodes.find((node) => node.id == target)
      if (targetNode.type == "trainModelNode" && sourceNode.name !== "Model") {
        // Check if combine model node is the target
        let trainModelTarget = flowContent.edges.filter(edge => edge.source === target)[0]?.target
        trainModelTarget = flowContent.nodes.find(node => node.id === trainModelTarget )
        if (trainModelTarget && trainModelTarget.type === "CombineModelsNode") {
          // If the target is a CombineModelsNode, link the dataset node directly to it
          graph[source].push(trainModelTarget.id)
        }else {
          const connectedNodes = flowContent.edges.filter(edge => edge.target === target && edge.source !== source).map(edge => edge.source)
          const connectedModelNodes = flowContent.nodes.filter(node => node.name === "Model" && connectedNodes.includes(node.id))
          // Link dataset node to model nodes
          connectedModelNodes.forEach((modelNode) => {
            if (!graph[source]) {
              graph[source] = []
            }
            graph[source].push(modelNode.id)
          })
        }
      } else if (sourceNode.type == "trainModelNode" && targetNode.type !== "CombineModelsNode") {
        const connectedNodes = flowContent.edges.filter(edge => edge.target === source && edge.source !== target).map(edge => edge.source)
        const connectedModelNodes = flowContent.nodes.filter(node => node.name === "Model" && connectedNodes.includes(node.id))
        // Link model nodes to dataset node
        connectedModelNodes.forEach((modelNode) => {
          if (!graph[modelNode.id]) {
            graph[modelNode.id] = []
          }
          graph[modelNode.id].push(target)
        })
      } else if (sourceNode.type == "trainModelNode" && targetNode.type == "CombineModelsNode") {
        graph[source] = graph[source] || []
        graph[source].push(target)
      } else {
        // For other nodes, just link them normally
        graph[source].push(target)
      }
    })

    function explore(node, path) {
      if (!graph[node]) {
        // If there are no outgoing links from this node, add the path to the result
        let isValid = true
        path.forEach((id) => {
          let node = flowContent.nodes.find((node) => node.id == id)
          // this condition is here because a group node creates another path that is not valid
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
            <PipelinesResults pipelines={selectedPipelines} selectionMode={selectionMode} flowContent={flowContent} runFinalizeAndSave={runFinalizeAndSave} />
          </Card.Body>
        </Card>
      </Col>
    </>
  )
}

export default ResultsPane
