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
import { Dialog } from 'primereact/dialog';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext'


/**
 *
 * @returns {JSX.Element} A results pane accessed by using the menu tree
 *
 * @description
 * This component is used to display the results of the pipeline according to the selected nodes.
 *
 */
const ResultsPane = ({ runFinalizeAndSave, isExperiment }) => {
  const { setShowResultsPane, flowResults, pipelineNames, setPipelineNames } = useContext(FlowResultsContext)
  const { flowContent } = useContext(FlowInfosContext)
  const { updateNode } = useContext(FlowFunctionsContext)
  const [selectedPipelines, setSelectedPipelines] = useState([])
  const [fullPipelines, setFullPipelines] = useState([])
  const [selectionMode, setSelectionMode] = useState("Compare Mode")
  const [visible, setVisible] = useState(false)

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
        let [correctedPipelines, fullPipelines] = findBoxAnalysisPaths(flowResults)
        setFullPipelines(fullPipelines)

        // Set pipeline names
        let names = correctedPipelines.map((pipeline, index) => { return `Pipeline ${index + 1}` })
        if (names && names.length > 0 && (pipelineNames.length === 0 || pipelineNames.length !== names.length)) {
          setPipelineNames(names)
        }

        // find pipelines that includes all the selected ids
        let selectedPipelines = []
        correctedPipelines.forEach((pipeline) => {
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
   * Finds all models nodes linked to a given train_model node
   * @param {string} trainModelNodeId - The ID of the train_model node
   * @param {Object} dict - The nested dictionary to search
   * @returns {Array<Array<string>>} - List of paths (each path is an array of keys)
   */
  const findModelNodes = (trainModelNodeId, dict) => {
    const models = []
    const traverse = (currentDict, currentKey) => {
      if (!currentDict || typeof currentDict !== 'object') return

      // Check if current level has the train_model node
      if (currentKey.includes(trainModelNodeId)) {
        // If found, add the current path to models
        const modelNode = currentKey.split("*").reverse()[0]
        const nodeType = flowContent.nodes.find(node => node.id === modelNode)?.data?.internal?.type
        if (nodeType === "model") {
          models.push(modelNode)
        }
      }

      // Recursively search through next_nodes
      if (currentDict.next_nodes) {
        Object.entries(currentDict.next_nodes).forEach(([key, value]) => {
          traverse(value, key)
        })
      }
    }
    Object.entries(dict).forEach(([key, value]) => {
      traverse(value, key)
    })
    return models
  }

  /**
   * Finds all paths to 'box-analysis' nodes in a nested dictionary structure
   * @param {Object} dict - The nested dictionary to search
   * @returns {Array<Array<string>>} - List of paths (each path is an array of keys)
   */
  const findBoxAnalysisPaths = (dict) => {
    const paths = []
    const fullPaths = []
    const modelsTrained = {}

    const traverse = (currentDict, currentPath = []) => {
      if (!currentDict || typeof currentDict !== 'object') return

      // Check if current level has 'box-analysis' in next_nodes
      if (currentDict.next_nodes && 'box-analysis' in currentDict.next_nodes) {
        let correctedPath = []
        let fullPath = []
        currentPath.forEach((part) => {
          fullPath.push(part)
          const nodeType = flowContent.nodes.find(node => node.id === part)?.data?.internal?.type
          if (nodeType !== "train_model") {
            correctedPath.push(part)
            if (nodeType === "combine_models") {
              const trainModelNodeId = fullPath[fullPath.length - 2]
              let trainModelNodeIdIndex = fullPath.indexOf(trainModelNodeId)
              if (Object.keys(modelsTrained).length > 0 && modelsTrained[trainModelNodeId]) {
                // Add all models trained in the previous train_model node to the fullPath if it does not already exist
                modelsTrained[trainModelNodeId].forEach(model => {
                  if (!fullPath.includes(model)) {
                    fullPath.splice(trainModelNodeIdIndex, 0, model)
                  }
                })
              }
            }
          } else {
            modelsTrained[part] = findModelNodes(part, dict)
          }
          
        })
        paths.push([...correctedPath, 'box-analysis'])
        fullPaths.push(Array.from(new Set([...fullPath, 'box-analysis'])))
      }

      // Recursively search through next_nodes
      if (currentDict.next_nodes) {
        Object.entries(currentDict.next_nodes).forEach(([key, value]) => {
          if (key.includes("*")) {
            traverse(value, [...currentPath, ...key.split("*").reverse()])
          } else {            
            traverse(value, [...currentPath, key])
          }
        })
      }
    }

    Object.entries(dict).forEach(([key, value]) => {
      traverse(value, [key])
    })

    return [paths, fullPaths]
  }

  const getName = (id) => {
    let node = flowContent.nodes.find((node) => node.id == id)
    if (node && node.name == "Model") {
      if (node.data.internal.name != "Model") return node.data.internal.name
      if (node.data.internal.selection) {
        const selection = node.data.internal.selection
        const modelName = node.data.setupParam.possibleSettings[selection]?.label
        return modelName ? modelName : "Model"
      }
      return "Model"
    }
    return node && node.data.internal.name
  }

  const getArrowIcon = (rowData, index, nodeId) => {
    const nextNodeId = rowData.nodes[index + 1]
    const nextNodeType = nextNodeId ?flowContent.nodes.find(node => node.id === nextNodeId)?.data?.internal?.type : ""
    const currentNodeType = flowContent.nodes.find(node => node.id === nodeId)?.data?.internal?.type
    if (currentNodeType === "model" && nextNodeType === "model") {
      return <span className="opacity-50 mx-1">+</span>
    }
    return <span className="opacity-50 mx-1">→</span>
  }

  const PipelineManager = ({ pipelines }) => {
    const [editedPipelines, setEditedPipelines] = useState(
      pipelines.map((pipeline, index) => ({
        id: index,
        nodes: pipeline,
        name: pipelineNames[index]
      }))
    )

    const handleNameChange = (id, newName) => {
      setEditedPipelines(prev => 
        prev.map(p => p.id === id ? { ...p, name: newName } : p)
      )
    }

    const handleSave = () => {
      const newNames = editedPipelines.map(p => p.name)
      setPipelineNames(newNames)
      setVisible(false)
    }

    return (
      <Dialog 
        header="Manage Pipelines" 
        visible={visible} 
        style={{ width: '50vw' }}
        onHide={() => setVisible(false)}
      >
        <div className="p-2">
          <DataTable value={editedPipelines}>
            <Column field="name" header="Pipeline Name" body={(rowData) => (
              <InputText
                value={rowData.name}
                onChange={(e) => handleNameChange(rowData.id, e.target.value)}
              />
            )} />
            <Column header="Nodes" body={(rowData) => (
              <div className="text-sm">
                {rowData.nodes.map((nodeId, index) => (
                  <span key={index}>
                    {getName(nodeId)}
                    {index < rowData.nodes.length - 1 && (getArrowIcon(rowData, index, nodeId))}
                  </span>
                ))}
              </div>
            )} />
          </DataTable>

          <div className="flex justify-content-end mt-4">
            <Button 
              variant="danger" 
              onClick={() => setVisible(false)} 
              style={{ marginRight: '10px' }}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSave} 
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Dialog>
    )
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
                <div className="flex align-items-center">
                  <Button severity="info" size="sm" className="manage-pipelines-button" onClick={() => setVisible(true)} >
                      <Icon.ArrowLeftRight style={{ marginRight: "10px", fontSize: "1rem" }} />
                      Manage Pipelines
                  </Button>
                </div>
              </div>
            </div>
            <PipelineManager 
              pipelines={fullPipelines} 
            />
            <Button variant="outline closeBtn closeBtn-resultsPane end-5" onClick={handleClose}>
              <Icon.X width="30px" height="30px" />
            </Button>
          </Card.Header>
          <Card.Body>
            <PipelinesResults 
              pipelines={selectedPipelines} 
              fullPipelines={fullPipelines} 
              pipelineNames={pipelineNames} 
              selectionMode={selectionMode} 
              flowContent={flowContent} 
              runFinalizeAndSave={runFinalizeAndSave} 
              isExperiment={isExperiment} />
          </Card.Body>
        </Card>
      </Col>
    </>
  )
}

export default ResultsPane
