import { randomUUID } from "crypto"
import Path from "path"
import { Accordion, AccordionTab } from "primereact/accordion"
import { Button } from "primereact/button"
import { SelectButton } from "primereact/selectbutton"
import process from "process"
import { useCallback, useContext, useEffect, useState } from "react"
import * as Icon from "react-bootstrap-icons"
import { toast } from "react-toastify"
import { getPathSeparator, loadJsonPath } from "../../../utilities/fileManagementUtils"
import { deepCopy } from "../../../utilities/staticFunctions"
import AnalyseResults from "../../learning/results/node/analyseResults"
import DataParamResults from "../../learning/results/node/dataParamResults"
import ModelsResults from "../../learning/results/node/modelsResults"
import SaveModelResults from "../../learning/results/node/saveModelResults"
import SplitResults from "../../learning/results/node/splitResults"
import { connectToMongoDB, insertMEDDataObjectIfNotExists, updateMEDDataObjectUsedInList } from "../../mongoDB/mongoDBUtils"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { EXPERIMENTS, WorkspaceContext } from "../../workspace/workspaceContext"
import { FlowInfosContext } from "../context/flowInfosContext"
import { FlowResultsContext } from "../context/flowResultsContext"
import { FlowFunctionsContext } from "../context/flowFunctionsContext"

/**
 *
 * @param {Object} obj
 * @param {string} id
 * @returns the sub-object corresponding at the id in the obj
 * @description equivalent to obj[id] but the id can be a substring of the key
 */
const checkIfObjectContainsId = (obj, id) => {
  let res = false
  if (!obj) {
    return res
  }
  Object.keys(obj).forEach((key) => {
    if (key.includes(id)) {
      res = obj[key]
    }
  })
  return res
}

/**
 *
 * @param {Object} obj
 * @param {string} id
 * @returns the sub-object corresponding at the id in the obj
 * @description equivalent to obj[id] but the id can be a substring of the key
 */
const fetchGroupModelsResults = (data, targetNodeId) => {
  let lastValidResults = null

  const traverse = (obj) => {
    if (!obj || typeof obj !== 'object') return

    // Check if current object has the target node in its keys
    Object.entries(obj).forEach(([key, value]) => {
      if (key.includes(targetNodeId)) {
        if (Object.keys(value).length > 0 && Object.keys(value).includes("results")) {
          lastValidResults = value.results
          return
        }
      } else if (key === 'next_nodes' || (typeof value === 'object' && value !== null && Object.keys(value).includes('next_nodes'))) {
        // Recursively check next_nodes and nested objects
        traverse(value)
      }
    })
  }

  traverse(data)
  return lastValidResults
}

/**
 * Retrieves results for a given node ID by following a specific pipeline path
 * @param {Object} flowResults - The complete results from experiment
 * @param {Object} flowContent - The content of the scene
 * @param {string} targetId - The ID to search for (can be part of a key or exact match)
 * @param {Array<string>} pipeline - Array of keys to follow in order
 * @returns {Object|null} - The results object if found, null otherwise
 */
function getNodeResults(flowResults, flowContent, pipeline, targetId) {
  try {
    const traverse = (currentDict, currentKey) => {
      if (!currentDict || typeof currentDict !== 'object') return

      // Skip train model node
      const nodeType = flowContent.nodes.find(node => node.id === currentKey)?.data?.internal?.type 
      if (nodeType !== "train_model" && currentKey.includes(targetId) && currentDict.results) {
        return currentDict.results // Return found results immediately
      }

      // Recursively search through next_nodes
      if (currentDict.next_nodes) {
        for (const [key, value] of Object.entries(currentDict.next_nodes)) {
          const isInPipeline = pipeline.some(p => key.includes(p))
          if (isInPipeline) {
            const results = traverse(value, key)
            if (results) return results // Bubble up found results
          }
        }
      }
    }

    let nodeResults = null

    Object.entries(flowResults).forEach(([key, value]) => {
      nodeResults = traverse(value, key)
      
    })
    return nodeResults
  } catch (error) {
    console.error('Error while searching for node results:', error)
    return null
  }
}

/**
 *
 * @param {Array} pipeline Pipeline to display
 * @param {string} selectionMode "Compare Mode" or "Normal Mode"
 * @param {Object} flowContent Content of the flow
 * @returns {JSX.Element} A PipelineResult component
 *
 * @description
 * This component takes a pipeline and displays the results related to the selected node.
 */
const PipelineResult = ({ index, pipeline, selectionMode, flowContent,highlightPipeline }) => {
  const { flowResults, selectedResultsId } = useContext(FlowResultsContext)
  const { updateNode } = useContext(FlowFunctionsContext)
  const [body, setBody] = useState(<></>)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    setSelectedId(!selectedResultsId || selectionMode == "Compare Mode" ? selectedResultsId : selectedResultsId[pipeline.join("-")])
  }, [selectedResultsId])

  useEffect(() => {
    if (pipeline.length == 0) {
      setBody(<></>)
    } else {
      // Switch back all nodes to their original className
      flowContent.nodes.forEach((node) => {
        if (node.className === "beenSelected" && selectedId !== node.id) {
          highlightPipeline(index)
        }
      })
      // Highlight the selected node in the flow
      if (selectedId) {
        const node = flowContent.nodes.find((node) => node.id == selectedId)
        if (node && node.className !== "beenSelected" && node.className !== "misplaced") {
          node.className = "beenSelected"
          updateNode({
            id: node.id,
            updatedData: node.data.internal
          })
        }
      }
      setBody(createBody())
    }
  }, [pipeline, selectedId])

  /**
   * @returns {JSX.Element} The body of the accordion tab
   *
   * @description
   * This function is used to create the body of the accordion tab.
   *
   * it is called when the pipeline, the selectedId, the flowContent or the flowResults change.
   */
  const createBody = useCallback(() => {
    let toReturn = <></>
    if (selectedId) {
      let selectedNode = flowContent.nodes.find((node) => node.id == selectedId)
      let selectedResults = getNodeResults(flowResults, flowContent, pipeline, selectedId)
      console.log("selectedResults", selectedResults)
      if (selectedResults) {
        let type = selectedNode.data.internal.type
        console.log("type", type)
        if (type == "dataset" || type == "clean") {
          toReturn = <DataParamResults selectedResults={selectedResults} type={type} />
        } else if (type == "split") {
          toReturn = <SplitResults selectedResults={selectedResults} />
        } else if (["model", "train_model", "compare_models", "stack_models", "ensemble_model", "tune_model", "blend_models", "calibrate_model", "combine_models"].includes(type)) {
          toReturn = <ModelsResults selectedResults={selectedResults} />
        } else if (type == "analysis" || type == "analyze") {
          toReturn = <AnalyseResults selectedResults={selectedResults} />
        } else if (type == "save_model") {
          toReturn = <SaveModelResults selectedResults={selectedResults} />
        } else {
          toReturn = <div>Results not available for this node type</div>
        }
      }
    }

    return toReturn
  }, [pipeline, flowResults, selectedId, flowContent])

  return <>{body}</>
}

/**
 *
 * @param {Array[Array]} pipelines Pipelines to display
 * @param {string} selectionMode "Compare Mode" or "Normal Mode"
 * @param {Object} flowContent Content of the flow
 * @returns {JSX.Element} A PipelinesResults component
 *
 * @description
 * This component takes all the selected pipelines and displays them in an accordion.
 */
const PipelinesResults = ({ pipelines, fullPipelines, selectionMode, flowContent, runFinalizeAndSave }) => {
  const { selectedResultsId, setSelectedResultsId, flowResults, setShowResultsPane, showResultsPane, isResults, pipelineNames } = useContext(FlowResultsContext)
  const { getBasePath } = useContext(WorkspaceContext)
  const { sceneName } = useContext(FlowInfosContext)
  const { updateNode, updateEdge } = useContext(FlowFunctionsContext)

  const [accordionActiveIndexStore, setAccordionActiveIndexStore] = useState([])
  const [accordionActiveIndex, setAccordionActiveIndex] = useState([])
  const isProd = process.env.NODE_ENV === "production"

  //when the selectionMode change, reset the selectedResultsId and the accordionActiveIndex
  useEffect(() => {
    setSelectedResultsId(null)
    setAccordionActiveIndex([])
  }, [selectionMode])

  // When the showResultsPane change, save the state of accordionActiveIndex and set it to [] if showResultsPane is false for performance purpose
  useEffect(() => {
    if (!showResultsPane) {
      setAccordionActiveIndexStore(accordionActiveIndex)
      setAccordionActiveIndex([])
    } else {
      setAccordionActiveIndex(accordionActiveIndexStore)
    }
  }, [showResultsPane])

  /**
   * @param {Array} results The results of the pipeline
   * @param {string} notebookID The id of the notebook
   * @returns {boolean} true if the results are in the correct format, false otherwise
   * @description This function is used to lock the dataset to avoid the user to modify or delete it
   */
  const lockDataset = (results, notebookID) => {
    let datasetId = null
    if (!results) {
      // if results are null, return false
      toast.error("The results are not in the correct format")
      return false
    }
    // check if the results are in the correct format
    const isValidFormat = (results) => {
      let key = Object.keys(results)[0]
      return results[key].results ? true : false
    }
    // get the dataset id
    if (isValidFormat(results)) {
      let key = Object.keys(results)[0]
      if (results[key].results && results[key].results.data && results[key].results.data.paths) {
        if (results[key].results.data.paths[0].id) {
          datasetId = results[key].results.data.paths[0].id
        }
      }
    }
    // lock and update the dataset
    MEDDataObject.lockMedDataObject(datasetId)
    updateMEDDataObjectUsedInList(datasetId, notebookID)
  }

  /**
   * @returns {JSX.Element} The title of the accordion tab
   *
   * @description
   * This function is used to create the title of the accordion tab dynamically and with buttons control.
   */
  const createTitleFromPipe = useCallback((index, pipeline, runFinalizeAndSave) => {
      let pipelineId = pipeline.join("-")
      const getName = (id, pipeline = null) => {
        let node = flowContent.nodes.find((node) => node.id == id)
        if (pipeline) {
          let nextNode = pipeline.indexOf(id) + 1 < pipeline.length ? flowContent.nodes.find((node) => node.id == pipeline[pipeline.indexOf(id) + 1]) : null
          // if (nextNode && nextNode.data.internal.type == "group_models") {
          //   let prevEdges = flowContent.edges.filter((edge) => edge.target == nextNode.id)
          //   let prevIds = prevEdges.map((edge) => edge.source)
          //   return prevIds.map((id) => getName(id)).join(" & ")
          // }
        }
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

      // check if the node is checked
      const isChecked = (id) => {
        let node = flowContent.nodes.find((node) => node.id == id)
        return node && node.data.internal.results.checked
      }

      // check if the node has run
      const hasRun = (id) => {
        let node = flowContent.nodes.find((node) => node.id == id)
        return node && node.data.internal.hasRun
      }

      // template for the button displayed in the select button
      const buttonTemplate = (option) => {
        return (
          <div className="pipeline-results-button">
            <span className={option.class}>{option.name}</span>
          </div>
        )
      }

      /**
       * 
       */
      const runFinalizeAndSaveWrapper = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        setShowResultsPane(false)

        // Find model node
        let modelNode = flowContent.nodes.find((node) => node.data.internal.type == "model" && pipeline.includes(node.id))
        if (!modelNode || !modelNode.id) {
          toast.error("No model node found in the pipeline")
          return
        }
        const newName = modelNode.data.internal.name !== "Model" ? modelNode.data.internal.name : ''
        runFinalizeAndSave(modelNode.id, newName)
      }

      /**
       *
       * @param {Event} e click event
       * @returns {void}
       *
       * @description
       * This function is used to generate the notebook corresponding to the pipeline.
       * It first gets the code and the imports of each node in the pipeline and then call the createNoteBookDoc function.
       */
      const codeGeneration = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        let finalCode = []
        let finalImports = []
        console.log("code generation", pipeline)
        let resultsCopy = deepCopy(flowResults)
        console.log("resultsCopy", resultsCopy)
        let nodeResults = null
        pipeline.forEach((id) => {
          // check if next node is a group_models
          let nextNode = flowContent.nodes.find((node) => node.id == id)
          console.log("nextNode", nextNode)
          let isNextGroupModels = nextNode && nextNode.data.internal.type == "combine_models"
          if (isNextGroupModels) {
            console.log("next node is a combine_models")
            console.log(checkIfObjectContainsId(resultsCopy, id))
          }
          nodeResults = checkIfObjectContainsId(resultsCopy, id)
          if (nodeResults) {
            if (!isNextGroupModels) {
              finalCode = [...finalCode, ...Object.values(nodeResults.results.code.content)]
              console.log("imports", Object.values(nodeResults.results.code.imports))
              finalImports = [...finalImports, ...Object.values(nodeResults.results.code.imports)]
            }
            resultsCopy = nodeResults.next_nodes
          } else {
            console.log("id " + id + " not found in results")
            toast.error("Id not found in results")
          }
        })
        // Check if the last result has finalize and save code
        if (Object.keys(nodeResults.next_nodes).length > 0 && Object.keys(nodeResults.next_nodes).includes("finalize")){
          if (!Object.values(nodeResults.next_nodes.finalize?.results?.code)) return
          finalCode = [...finalCode, ...Object.values(nodeResults.next_nodes.finalize.results.code.content)]
          finalImports = [...finalImports, ...Object.values(nodeResults.next_nodes.finalize.results.code.imports)]
        }
        if (Object.keys(nodeResults.next_nodes).length > 0 && Object.keys(nodeResults.next_nodes).includes("save")){
          if (!Object.values(nodeResults.next_nodes.save?.results?.code)) return
          finalCode = [...finalCode, ...Object.values(nodeResults.next_nodes.save.results.code.content)]
          finalImports = [...finalImports, ...Object.values(nodeResults.next_nodes.save.results.code.imports)]
        }
        console.log(finalImports)
        let notebookID = await createNoteBookDoc(finalCode, finalImports)
        lockDataset(flowResults, notebookID) // Lock the dataset to avoid the user to modify or delete it
      }

      /**
       *
       * @param {List} code List of code lines
       * @param {List} imports List of imports
       * @returns {void}
       *
       * @description
       * This function is used to create the notebook document corresponding to the pipeline's code and imports.
       * It first loads the existing notebook or get an empty one and then fills it with the code and the imports.
       */
      const createNoteBookDoc = async (code, imports) => {
        let newLineChar = "\n" // before was process.platform === "linux" ? "\n" : ""
        let notebook = loadJsonPath([getBasePath(EXPERIMENTS), sceneName, "notebooks", pipelineNames[index]].join(getPathSeparator()) + ".ipynb")
        notebook = notebook ? deepCopy(notebook) : deepCopy(loadJsonPath(isProd ? Path.join(process.resourcesPath, "baseFiles", "emptyNotebook.ipynb") : "./baseFiles/emptyNotebook.ipynb"))
        notebook.cells = []
        let lastType = "md"
        // This function is used to add a code cell to the notebook
        const addCode = (code) => {
          let cell = {
            // eslint-disable-next-line camelcase
            cell_type: "code",
            // eslint-disable-next-line camelcase
            execution_count: null,
            metadata: {},
            outputs: [],
            source: code
          }
          notebook.cells.push(cell)
        }

        // This function is used to add a markdown cell to the notebook
        const addMarkdown = (markdown) => {
          let cell = {
            // eslint-disable-next-line camelcase
            cell_type: "markdown",
            metadata: {},
            source: markdown
          }
          notebook.cells.push(cell)
        }

        // This function is used to compile the lines of the same type
        const compileLines = (lines) => {
          if (lastType == "code") {
            addCode(lines)
          } else if (lastType == "md") {
            addMarkdown(lines)
          }
        }
        // HEADER
        addMarkdown([
          "## Notebook automatically generated\n\n",
          "**Scene:** " + sceneName + "\n\n",
          "**Pipeline " + pipelineNames[index] + ":** " + fullPipelines[index].map((id) => getName(id, fullPipelines[index])).join(" ➡️ ") + "\n\n",
          "**Date:** " + new Date().toLocaleString() + "\n\n"
        ])
        // IMPORTS
        addCode(imports.map((imp) => imp.content + newLineChar))
        // CODE
        let linesOfSameType = []
        code.forEach((line) => {
          if (line.type == lastType) {
            linesOfSameType.push(line.content + newLineChar)
          } else {
            compileLines(linesOfSameType)
            linesOfSameType = [line.content + newLineChar]
            lastType = line.type
          }
        })
        compileLines(linesOfSameType)

        // Save the notebook locally
        const pathToCreate = MEDDataObject.writeFileSync(notebook, [getBasePath(EXPERIMENTS), sceneName, "notebooks"], pipelineNames[index], "ipynb")

        // Update the notebooks MEDDATAObject path
        const db = await connectToMongoDB()
        const collection = db.collection("medDataObjects")
        const notebooksFolder = await collection.findOne({ name: "notebooks", type: "directory" })
        await collection.updateOne({ id: notebooksFolder.id }, { $set: { path: pathToCreate } })

        // Save the notebook in the database
        const notebookObj = new MEDDataObject({
          id: randomUUID(),
          name: pipelineNames[index] + ".ipynb",
          type: "ipynb",
          parentID: notebooksFolder.id,
          childrenIDs: [],
          path: pathToCreate,
          isLocked: false,
          inWorkspace: true
        })

        // Insert the notebook in the database
        let notebookID = await insertMEDDataObjectIfNotExists(notebookObj)
        MEDDataObject.updateWorkspaceDataObject()

        // If the file is written successfully, display the success toast
        toast.success("Notebook generated and saved locally!")

        return notebookID
      }

      /**
       * @param {List} pipeline The pipeline to check if it has group_models
       * @returns {boolean} true if the pipeline has group_models, false otherwise
       */
      const hasGroupModels = (pipeline) => {
        return pipeline.some((id) => {
          let node = flowContent.nodes.find((node) => node.id == id)
          return node && node.data.internal.type == "combine_models"
        })
      }

      return (
        <>
          <label className="mr-2">{pipelineNames[index]}</label>
          <SelectButton
            className="results-select-button"
            value={selectionMode == "Compare Mode" ? selectedResultsId : selectedResultsId && selectedResultsId[pipelineId]}
            onChange={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (selectionMode == "Compare Mode") {
                setSelectedResultsId(e.value)
              } else {
                let newSelectedIds = { ...selectedResultsId }
                newSelectedIds[pipelineId] = e.value
                setSelectedResultsId(newSelectedIds)
              }
            }}
            optionLabel="name"
            options={pipeline
              .filter(id => {
                // Only keep non-model nodes if group models exist
                if (hasGroupModels(pipeline)) {
                  const node = flowContent.nodes.find(node => node.id === id);
                  return !(node && node.data.internal.type === "model");
                }
                return true; // Keep all if no group models
              })
              .map(id => ({
                name: getName(id),
                value: id,
                class: `${isChecked(id) ? "checked" : "unchecked"} ${!hasRun(id) ? "pipe-name-notRun" : ""}`
              }))}
              itemTemplate={buttonTemplate}
          />
          <FinalizeSaveBtn onClick={runFinalizeAndSaveWrapper} />
          <CodeGenBtn onClick={codeGeneration} />
        </>
      )
    },
    [selectedResultsId, setSelectedResultsId, selectionMode, flowContent, pipelineNames]
  )

  /**
   *
   * @param {Function} onClick
   * @returns {JSX.Element} A CodeGenBtn component
   *
   * @description
   * This component is used to display a button to generate the notebook corresponding to the pipeline.
   */
  const CodeGenBtn = ({ onClick }) => {
    return (
      <Button severity="info" className="code-generation-button" onClick={onClick} style={{ marginLeft: "10px" }}>
        <strong>
          Generate
          <Icon.CodeSlash style={{ marginLeft: "10px", fontSize: "1rem" }} />
        </strong>
      </Button>
    )
  }

  /**
   *
   * @param {Function} onClick
   * @returns {JSX.Element} A CodeGenBtn component
   *
   * @description
   * This component is used to display a button to generate the notebook corresponding to the pipeline.
   */
  const FinalizeSaveBtn = ({ onClick }) => {
    return (
      <Button severity="info" className="code-generation-button" onClick={onClick}>
        <strong>
          Finalize & Save Model
          <Icon.Floppy style={{ marginLeft: "10px", fontSize: "1rem" }} />
        </strong>
      </Button>
    )
  }

  const highlightPipeline = (index) => {
    if (index.length == 0 || index < 0 || index >= pipelines.length) {
      // Remove all highlighted nodes
      flowContent.nodes.forEach((node) => {
        if (node.className === "highlighted" || node.className === "beenSelected") {
          node.className = ""
          updateNode({
            id: node.id,
            updatedData: node.data.internal
          })
        }
      })
      // Remove all highlighted edges
      flowContent.edges.forEach((edge) => {
        if (edge.className === "stroke-highlighted") {
          edge.className = ""
          updateEdge({
            id: edge.id,
            updatedData: edge.data
          })
        }
      })
      return
    }
    const pipeline = fullPipelines[index]
    pipeline && flowContent.nodes.forEach((node) => {
      if (node.className !== "highlighted" && node.className !== "misplaced" && pipeline.includes(node.id)) {
        node.className = "highlighted"
        updateNode({
          id: node.id,
          updatedData: node.data.internal
        })
      }
    })
    pipeline && flowContent.edges.forEach((edge) => {
      if (pipeline.includes(edge.source) && pipeline.includes(edge.target)) {
        if (edge.target === "box-analysis") {
          const linked = pipeline.some((item, index) => item === edge.source && pipeline[index + 1] === edge.target)
          if (!linked) return
        }
        edge.className = "stroke-highlighted"
        updateNode({
          id: edge.id,
          updatedData: edge.data
        })
      } else {
        edge.className = ""
        updateEdge({
          id: edge.id,
          updatedData: edge.data
        })
      }
    })
  }

  return (
    <Accordion 
      multiple 
      activeIndex={accordionActiveIndex} 
      onTabChange={(e) => {
        setAccordionActiveIndex(e.index)
        highlightPipeline(e.index)
      }}
      className="pipeline-results-accordion"
    >
      {pipelines.map((pipeline, index) => {
        return (
          <AccordionTab 
            disabled={!isResults}
            key={index} 
            header={createTitleFromPipe(index, pipeline, runFinalizeAndSave)}
            >
            <PipelineResult key={index} index={index} pipeline={pipeline} selectionMode={selectionMode} flowContent={flowContent} highlightPipeline={highlightPipeline}/>
          </AccordionTab>
        )
      })}
    </Accordion>
  )
}

export default PipelinesResults
