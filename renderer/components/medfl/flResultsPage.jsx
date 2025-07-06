import { SelectButton } from "primereact/selectbutton"
import React, { useEffect, useState } from "react"
import FlInput from "./flInput"
import { DataTable } from "primereact/datatable"
import { Column } from "@blueprintjs/table"
import FlCompareResults from "./flCompareResults"
import { loadFileFromPathSync } from "../../utilities/fileManagementUtils"
import { Button } from "primereact/button"
import { JsonView, allExpanded } from "react-json-view-lite"

export default function FLResultsPage({ url }) {
  // state
  const [activeConfig, setActiveConfig] = useState("Config 1")
  const [resultsType, setResultsType] = useState("Global results")

  const [flowResults, setFlowResults] = useState({})

  const [showConfigDetails, setConfigDetails] = useState(true)

  const [globalflresults, setglobalflresults] = useState({
    confusionMatrix: [
      [0, 0],
      [0, 0]
    ]
  })
  const [nodeflresults, setnodeflresults] = useState({
    confusionMatrix: [
      [0, 0],
      [0, 0]
    ]
  })

  const [res, setResults] = useState(flowResults["data"] ? flowResults["data"][0] : null)

  const [selectedNode, setNode] = useState(res ? res["test_results"][0]["node_name"] : "")

  const [saveDate, setDate] = useState(null)

  useEffect(() => {
    let index
    index = Number(activeConfig.split(" ")[1])
    setResults(flowResults["data"] ? flowResults["data"][index ? index - 1 : 0] : null)

    flowResults && setDate(new Date(flowResults.date))
  }, [flowResults, activeConfig])

  useEffect(() => {
    loadFileFromPathSync(url).then((data) => setFlowResults(data))
  }, [url])

  // let res = {
  //   data : {
  //     test_results : [
  //       {
  //         node_name: "Client 1",
  //         classification_report:
  //         '{"confusion matrix": {"TP": 11, "FP": 12, "FN": 29, "TN": 157}, "Accuracy": 0.803, "Sensitivity/Recall": 0.055, "Specificity": 0.997, "PPV/Precision": 0.756, "NPV": 0.834, "F1-score": 0.103, "False positive rate": 0.006, "True positive rate": 0.056, "auc": 0.5534598465747545}'
  //       },
  //       {
  //         node_name: "Client 2",
  //         classification_report:
  //         '{"confusion matrix": {"TP": 21, "FP": 5, "FN": 59, "TN": 253}, "Accuracy": 0.833, "Sensitivity/Recall": 0.054, "Specificity": 0.995, "PPV/Precision": 0.7, "NPV": 0.835, "F1-score": 0.106, "False positive rate": 0.004, "True positive rate": 0.055, "auc": 0.5334598465747545}'
  //       },
  //       {
  //         node_name: "Client 3",
  //         classification_report:
  //         '{"confusion matrix": {"TP": 31, "FP": 10, "FN": 529, "TN": 2653}, "Accuracy": 0.853, "Sensitivity/Recall": 0.053, "Specificity": 0.996, "PPV/Precision": 0.72, "NPV": 0.834, "F1-score": 0.123, "False positive rate": 0.007, "True positive rate": 0.055, "auc": 0.5434598465747545}'
  //       }
  //     ]
  //   }
  // }

  const getGlobalresults = () => {
    let results = res["test_results"]

    let acc = 0
    let sensRec = 0
    let spec = 0
    let ppv = 0
    let npv = 0
    let f1score = 0
    let fpr = 0
    let tpr = 0
    let auc = 0

    let TP = 0
    let FP = 0
    let TN = 0
    let FN = 0

    results.map((result) => {
      let classReport = result["classification_report"]

      TP += classReport["confusion matrix"]["TP"]
      FP += classReport["confusion matrix"]["FP"]
      TN += classReport["confusion matrix"]["TN"]
      FN += classReport["confusion matrix"]["FN"]

      acc += classReport["Accuracy"]
      sensRec += classReport["Sensitivity/Recall"]
      spec += classReport["Specificity"]
      ppv += classReport["PPV/Precision"]
      npv += classReport["NPV"]
      f1score += classReport["F1-score"]
      fpr += classReport["False positive rate"]
      tpr += classReport["True positive rate"]
      auc += classReport["auc"]
    })

    let confusionMatrix = [
      [TN, FP],
      [FN, TP]
    ]

    return {
      confusionMatrix: confusionMatrix,
      Accuracy: (acc / results.length).toFixed(4),
      SensitivityRecall: (sensRec / results.length).toFixed(4),
      Specificity: (spec / results.length).toFixed(4),
      PPV: (ppv / results.length).toFixed(4),
      NPV: (npv / results.length).toFixed(4),
      F1score: (f1score / results.length).toFixed(4),
      FPR: (fpr / results.length).toFixed(4),
      TPR: (tpr / results.length).toFixed(4),
      auc: (auc / results.length).toFixed(4)
    }
  }

  const getNodeResults = (nodeName) => {
    let results = res["test_results"]

    let confusionMatrix
    let acc = 0
    let sensRec = 0
    let spec = 0
    let ppv = 0
    let npv = 0
    let f1score = 0
    let fpr = 0
    let tpr = 0
    let auc = 0

    results.map((result) => {
      if (result["node_name"] == nodeName) {
        let classReport = result["classification_report"]
        let TP = classReport["confusion matrix"]["TP"]
        let FP = classReport["confusion matrix"]["FP"]
        let TN = classReport["confusion matrix"]["TN"]
        let FN = classReport["confusion matrix"]["FN"]

        acc = classReport["Accuracy"]
        sensRec = classReport["Sensitivity/Recall"]
        spec = classReport["Specificity"]
        ppv = classReport["PPV/Precision"]
        npv = classReport["NPV"]
        f1score = classReport["F1-score"]
        fpr = classReport["False positive rate"]
        tpr = classReport["True positive rate"]
        auc = classReport["auc"]

        confusionMatrix = [
          [TN, FP],
          [FN, TP]
        ]
      }
    })

    return {
      confusionMatrix: confusionMatrix,
      Accuracy: acc.toFixed(4),
      SensitivityRecall: sensRec.toFixed(4),
      Specificity: spec.toFixed(4),
      PPV: ppv.toFixed(4),
      NPV: npv.toFixed(4),
      F1score: f1score.toFixed(4),
      FPR: fpr.toFixed(4),
      TPR: tpr.toFixed(4),
      auc: auc.toFixed(4)
    }
  }

  useEffect(() => {
    if (res) {
      if (resultsType == "Global results") {
        setglobalflresults(getGlobalresults())
      } else {
        if (resultsType == "By node") {
          setnodeflresults(getNodeResults(selectedNode))
        }
      }
      setNode(res["test_results"][0]["node_name"])
    }
  }, [res, resultsType, activeConfig, selectedNode])

  console.log(flowResults)

  if (!res)
    return (
      <div>
        <div className="d-flex justify-content-between w-100 ">
          <div className="gap-3 results-header">
            <div className="flex align-items-center">
              <h5>FL Pipeline results</h5>
            </div>
          </div>
          <div></div>
        </div>

        <div
          style={{
            padding: "150px",
            textAlign: "center",
            fontSize: "15px"
          }}
        >
          {" "}
          Loading ...
        </div>
      </div>
    )
  return (
    <div className="p-3" style={{ height: "100%", overflowY: "scroll" }}>
      <div>
        <div className="d-flex justify-content-between w-100 ">
          <div className="gap-3 results-header">
            <div className="flex align-items-center pb-4">
              <h5>Experimentation results</h5>
            </div>
          </div>
          Date: {saveDate?.toLocaleDateString()}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <SelectButton
            value={activeConfig}
            onChange={(e) => {
              setActiveConfig(e.value)
            }}
            options={flowResults["data"] ? flowResults["data"].map((r, index) => "Config " + (index + 1)) : []}
          />
          {resultsType == "By node" && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ width: "200px" }}>
                <FlInput
                  name="select node"
                  settingInfos={{
                    type: "list",
                    tooltip: "Specify the number of federated rounds",
                    choices: res["test_results"].map((r) => {
                      return { name: r["node_name"] }
                    })
                  }}
                  currentValue={selectedNode}
                  onInputChange={(e) => {
                    setNode(e.value)
                  }}
                  setHasWarning={() => {}}
                />
              </div>
            </div>
          )}{" "}
          <SelectButton value={resultsType} onChange={(e) => setResultsType(e.value)} options={["Global results", "By node", "Compare results"]} />
        </div>

        {resultsType == "Compare results" ? (
          <div className="my-3">
            <FlCompareResults data={res["test_results"]} />
          </div>
        ) : (
          <>
            <div style={{ marginTop: "30px" }}>
              {nodeflresults["confusionMatrix"] && globalflresults["confusionMatrix"] && (
                <>
                  <table className="table table-bordered w-50 mx-auto mt-5">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Predicted Negative</th>
                        <th>Predicted Positive</th>
                      </tr>
                    </thead>
                    {resultsType === "Global results" ? (
                      <tbody>
                        <tr>
                          <th>Actual Negative</th>

                          <td>{globalflresults["confusionMatrix"][0][0]}</td>
                          <td>{globalflresults["confusionMatrix"][0][1]}</td>
                        </tr>
                        <tr>
                          <th>Actual Positive</th>
                          <td>{globalflresults["confusionMatrix"][1][0]}</td>
                          <td>{globalflresults["confusionMatrix"][1][1]}</td>
                        </tr>
                      </tbody>
                    ) : (
                      <tbody>
                        <tr>
                          <th>Actual Negative</th>

                          <td>{nodeflresults["confusionMatrix"][0][0]}</td>
                          <td>{nodeflresults["confusionMatrix"][0][1]}</td>
                        </tr>
                        <tr>
                          <th>Actual Positive</th>
                          <td>{nodeflresults["confusionMatrix"][1][0]}</td>
                          <td>{nodeflresults["confusionMatrix"][1][1]}</td>
                        </tr>
                      </tbody>
                    )}
                  </table>
                </>
              )}
            </div>

            {globalflresults && (
              <DataTable value={resultsType === "Global results" ? [globalflresults] : [nodeflresults]} tableStyle={{ minWidth: "50rem" }}>
                <Column field="auc" header="AUC"></Column>
                <Column field="Accuracy" header="Accuracy"></Column>
                <Column field="SensitivityRecall" header="Sensitivity Recall"></Column>
                <Column field="Specificity" header="Specificity"></Column>
                <Column field="PPV" header="PPV"></Column>
                <Column field="NPV" header="NPV"></Column>
                <Column field="F1score" header="F1score"></Column>
                <Column field="FPR" header="FPR"></Column>
                <Column field="TPR" header="TPR"></Column>
              </DataTable>
            )}
          </>
        )}
      </div>

      <div className="mt-4">
        <Button
          icon={showConfigDetails ? "pi pi-angle-up" : "pi pi-angle-down"}
          label="Show config details"
          text
          onClick={() => {
            setConfigDetails(!showConfigDetails)
          }}
        ></Button>

        {showConfigDetails ? (
          <div>
            {Object.keys(flowResults?.configs[Number(activeConfig.split(" ")[1]) - 1]).map((key) => (
              <div key={key} style={{ border: "solid 0.5px grey", borderRadius: 5, margin: 5 }}>
                <div style={{ borderRadius: "5px 5px 0 0", background: "#D7DBFA", padding: 5, fontWeight: 700, fontSize: 17 }}>{key}</div>
                <JsonView data={flowResults?.configs[Number(activeConfig.split(" ")[1]) - 1][key]} shouldExpandNode={allExpanded} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
