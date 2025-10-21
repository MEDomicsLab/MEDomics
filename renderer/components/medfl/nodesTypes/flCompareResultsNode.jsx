import React, { useContext, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { Button } from "primereact/button"

import Path from "path"

import { UUID_ROOT, DataContext } from "../../workspace/dataContext"
import { EXPERIMENTS } from "../../workspace/workspaceContext"
import { loadFileFromPathSync } from "../../../utilities/fileManagementUtils"
import { toast } from "react-toastify"
import { InputText } from "primereact/inputtext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"

export default function FlCompareResults({ id, data }) {
  // context
  const { updateNode } = useContext(FlowFunctionsContext)
  const { globalData } = useContext(DataContext)

  // state
  const [resultsFiles, setresultsFiles] = useState([null])
  const [fileName, setFileName] = useState("")
  const [showFileName, setShowFileName] = useState(false)
  const [currentIndex, setINdex] = useState(0)

  const onChangeValue = (value, index) => {
    let files = resultsFiles
    files[index] = value

    setresultsFiles(files)
    setINdex(currentIndex + 1)

    data.internal.settings.files = files

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  const readData = async (index, data) => {
    let resData = data
    if (index === resultsFiles.length) {
      return resData
    } else {
      try {
        const fileData = await loadFileFromPathSync(resultsFiles[index].path)
        return readData(index + 1, [...resData, fileData])
      } catch (error) {
        console.error("Error loading file:", error)
        return resData
      }
    }
  }

  const mergeFiles = async () => {
    if (!resultsFiles[0] || !resultsFiles || resultsFiles[0].path == "" || resultsFiles.path == "") {
      toast.error("You have to specify at least two files ")
      return
    }
    readData(0, []).then(async (readData) => {
      let resultFileData = { data: [], configs: [], date: new Date().now }

      readData.map((data) => {
        resultFileData = {
          ...resultFileData,
          data: resultFileData.data.concat(data.data),
          configs: resultFileData.configs.concat(data.configs)
        }
      })
      try {
        let path = Path.join(globalData[UUID_ROOT].path, EXPERIMENTS)

        MEDDataObject.createFolderFromPath(path + "/FL")
        MEDDataObject.createFolderFromPath(path + "/FL/Results")

        // do custom actions in the folder while it is unzipped
        await MEDDataObject.writeFileSync(resultFileData["data"], path + "/FL/Results", fileName, "json")
        await MEDDataObject.writeFileSync(resultFileData, path + "/FL/Results", fileName, "medflres")

        toast.success("Experiment results saved successfuly ")
      } catch {
        toast.error("Something went wrong ")
      }
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
            {resultsFiles.map((value, index) => (
              <FlInput
                name="results file"
                settingInfos={{
                  type: "data-input",
                  tooltip: "<p>Specify a data file (xlsx, csv, json)</p>",
                  rootDir: "Results"
                }}
                currentValue={resultsFiles[index] || {}}
                onInputChange={(input) => onChangeValue(input.value, index)}
                setHasWarning={() => {}}
                acceptedExtensions={["medflres"]}
              />
            ))}

            <div className="d-flex justify-content-between">
              <div className="p-2">Add more files</div>
              <Button
                onClick={() => {
                  setresultsFiles([...resultsFiles, null])
                }}
                text
                icon="pi pi-plus"
                severity="secondary"
              ></Button>
            </div>

            <div className="d-flex justify-content-between">
              <Button
                onClick={() => {
                  setShowFileName(!showFileName)
                }}
                icon="pi pi-plus"
                label="Merge files"
                className="w-100 mt-2"
              ></Button>
            </div>
            {showFileName ? (
              <div className="p-inputgroup flex-1 me-4">
                <InputText
                  placeholder="File name"
                  onChange={(e) => {
                    setFileName(e.target.value)
                    data.internal.settings.fileName = e.target.value

                    // Update the node
                    updateNode({
                      id: id,
                      updatedData: data.internal
                    })
                  }}
                />
                <Button icon="pi pi-check" className="p-button-primary" onClick={mergeFiles} disabled={fileName == ""} />
              </div>
            ) : null}
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={<></>}
      />
    </>
  )
}
