import { SelectButton } from "primereact/selectbutton"

import React, { useContext, useEffect, useMemo, useState } from "react"

import { Card, Tab, Tabs } from "react-bootstrap"

import * as Icon from "react-bootstrap-icons"

import { FlowResultsContext } from "../flow/context/flowResultsContext"

import FlInput from "./flInput"

import { DataTable } from "primereact/datatable"

import { Column } from "primereact/column"

import FlCompareResults from "./flCompareResults"

import { Button } from "primereact/button"

import { UUID_ROOT, DataContext } from "../workspace/dataContext"

import { EXPERIMENTS } from "../workspace/workspaceContext"

import Path from "path"

import { useMEDflContext } from "../workspace/medflContext"

import { toast } from "react-toastify"

import { InputText } from "primereact/inputtext"

import { MEDDataObject } from "../workspace/NewMedDataObject"

import RoundMetricsChart, { TreeGrowthChart } from "./RoundMetricsChart"

import XGBoostFeatureImportance from "./FeatureImportanceChart"
import FederatedShapResults from "./ShapResults"

const EMPTY_CONFUSION_MATRIX = [
  [0, 0],
  [0, 0]
]

const formatMetric = (value, digits = 4) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return value ?? "-"
  }

  return numericValue.toFixed(digits)
}

const getLastMetricValue = (series) => {
  if (!Array.isArray(series) || series.length === 0) {
    return null
  }

  const lastEntry = series[series.length - 1]

  if (Array.isArray(lastEntry)) {
    return lastEntry[1]
  }

  return lastEntry
}

const metricHistoryToRows = (metrics = {}) => {
  const rowsByRound = new Map()

  Object.entries(metrics || {}).forEach(([metricName, values]) => {
    if (!Array.isArray(values)) {
      return
    }

    values.forEach((entry, index) => {
      const round = Array.isArray(entry) ? entry[0] : index + 1

      const value = Array.isArray(entry) ? entry[1] : entry

      if (!rowsByRound.has(round)) {
        rowsByRound.set(round, {
          round
        })
      }

      rowsByRound.get(round)[metricName] = value
    })
  })

  return Array.from(rowsByRound.values()).sort((first, second) => Number(first.round) - Number(second.round))
}

const SummaryCard = ({ title, value, subtitle }) => {
  return (
    <div className="col-12 col-md-6 col-xl-3 mb-3">
      <Card className="h-100">
        <Card.Body>
          <div className="text-muted small">{title}</div>

          <div
            style={{
              fontSize: "1.6rem",
              fontWeight: 600
            }}
          >
            {value}
          </div>

          {subtitle ? <div className="text-muted small mt-1">{subtitle}</div> : null}
        </Card.Body>
      </Card>
    </div>
  )
}

const XGBoostResults = ({ result }) => {
  const trainingRows = useMemo(() => {
    if (!Array.isArray(result?.training_results)) {
      return []
    }

    return result.training_results.map((roundResult, index) => ({
      round: roundResult?.round ?? index + 1,

      num_fit_clients: roundResult?.num_fit_clients,

      num_failures: roundResult?.num_failures,

      global_num_trees: roundResult?.global_num_trees,

      train_auc: roundResult?.train_auc,

      train_accuracy: roundResult?.train_accuracy,

      train_logloss: roundResult?.train_logloss,

      train_rmse: roundResult?.train_rmse,

      train_mae: roundResult?.train_mae,

      train_r2: roundResult?.train_r2,

      train_adjusted_r2: roundResult?.train_adjusted_r2,

      train_macro_f1: roundResult?.train_macro_f1
    }))
  }, [result])

  const distributedFitRows = useMemo(() => {
    return metricHistoryToRows(result?.metrics_distributed_fit)
  }, [result])

  const distributedEvaluationRows = useMemo(() => {
    const rows = metricHistoryToRows(result?.metrics_distributed)

    const lossByRound = new Map(
      Array.isArray(result?.losses_distributed) ? result.losses_distributed.map((entry, index) => [Array.isArray(entry) ? entry[0] : index + 1, Array.isArray(entry) ? entry[1] : entry]) : []
    )

    return rows.map((row) => ({
      ...row,

      loss: lossByRound.get(row.round) ?? row.eval_logloss ?? row.eval_rmse ?? row.eval_mlogloss
    }))
  }, [result])

  const testRows = useMemo(() => {
    if (!Array.isArray(result?.test_results)) {
      return []
    }

    return result.test_results.map((testResult, index) => ({
      client_id: testResult?.client_id ?? testResult?.node_name ?? `Client ${index + 1}`,

      num_examples: testResult?.num_examples ?? "-",

      ...(testResult?.metrics || {})
    }))
  }, [result])

  const finalTrainAuc = getLastMetricValue(result?.metrics_distributed_fit?.train_auc)

  const finalEvalAuc = getLastMetricValue(result?.metrics_distributed?.eval_auc)

  const finalEvalAccuracy = getLastMetricValue(result?.metrics_distributed?.eval_accuracy)

  const finalLoss =
    Array.isArray(result?.losses_distributed) && result.losses_distributed.length > 0 ? getLastMetricValue(result.losses_distributed) : getLastMetricValue(result?.metrics_distributed?.eval_logloss)

  const clientMetricColumns = [
    ["auc", "AUC"],
    ["accuracy", "Accuracy"],
    ["logloss", "Log loss"],
    ["rmse", "RMSE"],
    ["mae", "MAE"],
    ["r2", "R²"],
    ["adjusted_r2", "Adjusted R²"],
    ["macro_f1", "Macro F1"]
  ].filter(([field]) => testRows.some((row) => row[field] !== undefined))

  return (
    <div
      className="mt-4 "
      style={{
        height: "calc(100vh - 450px)",
        maxHeight: "calc(100vh - 120px)",
        overflowY: "auto",
        overflowX: "hidden"
      }}
    >
      <div className="row">
        <SummaryCard title="Model" value="XGBoost" subtitle={`${result?.task || "unknown"} task`} />

        <SummaryCard title="Federated rounds" value={result?.num_rounds ?? "-"} subtitle={`${result?.num_clients ?? "-"} clients`} />

        <SummaryCard title="Final trees" value={result?.final_num_trees ?? "-"} subtitle={`${result?.local_num_boost_round ?? "-"} local rounds/client`} />

        <SummaryCard title="Final evaluation AUC" value={formatMetric(finalEvalAuc)} subtitle={`Train AUC: ${formatMetric(finalTrainAuc)}`} />
      </div>

      <div className="row">
        <SummaryCard title="Final evaluation accuracy" value={formatMetric(finalEvalAccuracy)} />

        <SummaryCard title="Final evaluation loss" value={formatMetric(finalLoss)} />
      </div>

      <Tabs defaultActiveKey="training" className="mt-3" variant="pills">
        <Tab eventKey="training" title="Training metrics">
          <div className="mt-3">
            <RoundMetricsChart
              roundResults={distributedFitRows}
              title="Training metrics over federated rounds"
              accuracyField="train_accuracy"
              aucField="train_auc"
              lossField="train_logloss"
              extraSeries={[
                {
                  name: "RMSE",
                  field: "train_rmse",
                  yAxisIndex: 1
                },

                {
                  name: "MAE",
                  field: "train_mae",
                  yAxisIndex: 1
                },

                {
                  name: "R²",
                  field: "train_r2",
                  yAxisIndex: 0
                },

                {
                  name: "Macro F1",
                  field: "train_macro_f1",
                  yAxisIndex: 0
                }
              ]}
            />
          </div>

          <div className="mt-4">
            <TreeGrowthChart roundResults={trainingRows} />
          </div>
        </Tab>

        <Tab eventKey="evaluation" title="Evaluation metrics">
          <div className="mt-3">
            <RoundMetricsChart
              roundResults={distributedEvaluationRows}
              title="Evaluation metrics over federated rounds"
              accuracyField="eval_accuracy"
              aucField="eval_auc"
              lossField="loss"
              extraSeries={[
                {
                  name: "RMSE",
                  field: "eval_rmse",
                  yAxisIndex: 1
                },

                {
                  name: "MAE",
                  field: "eval_mae",
                  yAxisIndex: 1
                },

                {
                  name: "R²",
                  field: "eval_r2",
                  yAxisIndex: 0
                },

                {
                  name: "Macro F1",
                  field: "eval_macro_f1",
                  yAxisIndex: 0
                }
              ]}
            />
          </div>
        </Tab>

        <Tab eventKey="clients" title="Client test results">
          <div className="mt-3">
            <DataTable
              value={testRows}
              emptyMessage="No client test results available."
              stripedRows
              showGridlines
              responsiveLayout="scroll"
              tableStyle={{
                minWidth: "55rem"
              }}
            >
              <Column field="client_id" header="Client" />

              <Column field="num_examples" header="Examples" />

              {clientMetricColumns.map(([field, header]) => (
                <Column key={field} field={field} header={header} body={(row) => formatMetric(row[field])} />
              ))}
            </DataTable>
          </div>
        </Tab>

        <Tab eventKey="importance" title="Feature importance">
          <div className="mt-3">
            <XGBoostFeatureImportance featureImportance={result?.feature_importance} />
          </div>
        </Tab>
        <Tab eventKey="shap" title="SHAP values">
          <div className="mt-3">
            <FederatedShapResults results={result?.federated_shap_result} />
          </div>
        </Tab>
      </Tabs>
    </div>
  )
}

export default function FlResultsPane() {
  const { globalData } = useContext(DataContext)

  const [activeConfig, setActiveConfig] = useState("Config 1")

  const [resultsType, setResultsType] = useState("Global results")

  const [globalflresults, setglobalflresults] = useState({
    confusionMatrix: EMPTY_CONFUSION_MATRIX
  })

  const [nodeflresults, setnodeflresults] = useState({
    confusionMatrix: EMPTY_CONFUSION_MATRIX
  })

  const [selectedNode, setNode] = useState("Client 1")

  const [isFileName, showFileName] = useState(false)

  const [resultsFileName, setResultsFileName] = useState("")

  const { flowResults, setShowResultsPane } = useContext(FlowResultsContext)

  const { flPipelineConfigs } = useMEDflContext()

  const [res, setResults] = useState(flowResults?.data?.length ? flowResults.data[0] : null)

  const isXGBoost = String(res?.model_type || res?.backend || "").toLowerCase() === "xgboost"

  useEffect(() => {
    const configIndex = Number(activeConfig.split(" ")[1]) - 1
    console.log("=========================================== Active config:", activeConfig, "Index:", configIndex, "Flow results data:", flowResults?.data)
    setResults(flowResults?.data?.[configIndex >= 0 ? configIndex : 0] ?? null)
  }, [flowResults, activeConfig])

  const handleClose = () => {
    setShowResultsPane(false)
  }

  const MetricCard = ({ title, value, subtitle, icon: MetricIcon, variant = "primary" }) => {
    return (
      <Card className="h-100 border-0 shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-muted small mb-1">{title}</div>

              <div
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  lineHeight: 1.2
                }}
              >
                {value}
              </div>

              {subtitle && <div className="text-muted small mt-2">{subtitle}</div>}
            </div>

            {MetricIcon && (
              <div className={`text-${variant}`}>
                <MetricIcon size={24} />
              </div>
            )}
          </div>
        </Card.Body>
      </Card>
    )
  }
  const safeDivide = (numerator, denominator) => {
    if (!denominator) {
      return 0
    }

    return numerator / denominator
  }

  const calculateMetricsFromMatrix = ({ TP, FP, FN, TN }) => {
    const total = TP + FP + FN + TN

    const accuracy = safeDivide(TP + TN, total)
    const sensitivity = safeDivide(TP, TP + FN)
    const specificity = safeDivide(TN, TN + FP)
    const precision = safeDivide(TP, TP + FP)
    const npv = safeDivide(TN, TN + FN)
    const f1 = safeDivide(2 * precision * sensitivity, precision + sensitivity)
    const falsePositiveRate = safeDivide(FP, FP + TN)
    const falseNegativeRate = safeDivide(FN, FN + TP)

    return {
      Accuracy: accuracy,
      SensitivityRecall: sensitivity,
      Specificity: specificity,
      PPV: precision,
      NPV: npv,
      F1score: f1,
      FPR: falsePositiveRate,
      FNR: falseNegativeRate,
      TPR: sensitivity
    }
  }

  const getGlobalResults = () => {
    const clientResults = Array.isArray(res?.test_results) ? res.test_results : []

    if (clientResults.length === 0) {
      return {
        confusionMatrix: EMPTY_CONFUSION_MATRIX,
        clientCount: 0,
        totalSamples: 0,
        Accuracy: null,
        SensitivityRecall: null,
        Specificity: null,
        PPV: null,
        NPV: null,
        F1score: null,
        FPR: null,
        FNR: null,
        TPR: null,
        auc: null
      }
    }

    const totals = clientResults.reduce(
      (accumulator, clientResult) => {
        const report = clientResult?.classification_report || {}
        const matrix = report["confusion matrix"] || {}

        accumulator.TP += Number(matrix.TP || 0)
        accumulator.FP += Number(matrix.FP || 0)
        accumulator.FN += Number(matrix.FN || 0)
        accumulator.TN += Number(matrix.TN || 0)

        const auc = Number(report.auc)

        if (Number.isFinite(auc)) {
          accumulator.aucValues.push(auc)
        }

        return accumulator
      },
      {
        TP: 0,
        FP: 0,
        FN: 0,
        TN: 0,
        aucValues: []
      }
    )

    const calculatedMetrics = calculateMetricsFromMatrix(totals)

    const meanAuc = totals.aucValues.length > 0 ? totals.aucValues.reduce((sum, value) => sum + value, 0) / totals.aucValues.length : null

    return {
      confusionMatrix: [
        [totals.TN, totals.FP],
        [totals.FN, totals.TP]
      ],

      rawConfusionMatrix: {
        TP: totals.TP,
        FP: totals.FP,
        FN: totals.FN,
        TN: totals.TN
      },

      clientCount: clientResults.length,

      totalSamples: totals.TP + totals.FP + totals.FN + totals.TN,

      ...calculatedMetrics,

      // This remains a macro-average unless you have predictions
      // or sample-weighted client AUC values.
      auc: meanAuc
    }
  }

  const ConfusionMatrixCard = ({ matrix }) => {
    const tn = Number(matrix?.[0]?.[0] || 0)
    const fp = Number(matrix?.[0]?.[1] || 0)
    const fn = Number(matrix?.[1]?.[0] || 0)
    const tp = Number(matrix?.[1]?.[1] || 0)

    const actualNegativeTotal = tn + fp
    const actualPositiveTotal = fn + tp
    const total = tn + fp + fn + tp

    const cellStyle = {
      padding: "1.3rem",
      textAlign: "center",
      verticalAlign: "middle"
    }

    const renderValue = (value, denominator) => (
      <>
        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</div>

        <div className="small opacity-75">{denominator > 0 ? `${((value / denominator) * 100).toFixed(1)}%` : "0.0%"}</div>
      </>
    )

    return (
      <Card className="border-0 shadow-sm h-100">
        <Card.Header className="bg-white">
          <div className="d-flex justify-content-between align-items-center">
            <strong>Confusion matrix</strong>

            <span className="badge bg-light text-dark">{total} samples</span>
          </div>
        </Card.Header>

        <Card.Body>
          <div className="table-responsive">
            <table className="table table-bordered align-middle mb-0">
              <thead>
                <tr>
                  <th className="bg-light"></th>
                  <th className="text-center bg-light">Predicted negative</th>
                  <th className="text-center bg-light">Predicted positive</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <th className="bg-light">Actual negative</th>

                  <td className="table-success" style={cellStyle}>
                    <div className="small mb-1">True negative</div>

                    {renderValue(tn, actualNegativeTotal)}
                  </td>

                  <td className="table-danger" style={cellStyle}>
                    <div className="small mb-1">False positive</div>

                    {renderValue(fp, actualNegativeTotal)}
                  </td>
                </tr>

                <tr>
                  <th className="bg-light">Actual positive</th>

                  <td className="table-danger" style={cellStyle}>
                    <div className="small mb-1">False negative</div>

                    {renderValue(fn, actualPositiveTotal)}
                  </td>

                  <td className="table-success" style={cellStyle}>
                    <div className="small mb-1">True positive</div>

                    {renderValue(tp, actualPositiveTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>
    )
  }

  const formatDecimal = (value, digits = 4) => {
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue)) {
      return "-"
    }

    return numericValue.toFixed(digits)
  }

  const formatPercentage = (value, digits = 1) => {
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue)) {
      return "-"
    }

    return `${(numericValue * 100).toFixed(digits)}%`
  }

  const MetricsDetailsCard = ({ results }) => {
    const metricGroups = [
      {
        title: "Overall performance",
        metrics: [
          ["Mean client AUC", results.auc, "decimal"],
          ["Accuracy", results.Accuracy, "percentage"],
          ["F1 score", results.F1score, "percentage"]
        ]
      },
      {
        title: "Positive class",
        metrics: [
          ["Sensitivity / Recall", results.SensitivityRecall, "percentage"],
          ["Precision / PPV", results.PPV, "percentage"],
          ["True positive rate", results.TPR, "percentage"]
        ]
      },
      {
        title: "Negative class",
        metrics: [
          ["Specificity", results.Specificity, "percentage"],
          ["Negative predictive value", results.NPV, "percentage"],
          ["False positive rate", results.FPR, "percentage"]
        ]
      }
    ]

    return (
      <Card className="border-0 shadow-sm h-100">
        <Card.Header className="bg-white">
          <strong>Detailed metrics</strong>
        </Card.Header>

        <Card.Body>
          {metricGroups.map((group, groupIndex) => (
            <div key={group.title} className={groupIndex < metricGroups.length - 1 ? "mb-4" : ""}>
              <div className="text-muted small fw-semibold mb-2">{group.title}</div>

              {group.metrics.map(([label, value, type]) => (
                <div key={label} className="d-flex justify-content-between py-2 border-bottom">
                  <span>{label}</span>

                  <strong>{type === "percentage" ? formatPercentage(value) : formatDecimal(value)}</strong>
                </div>
              ))}
            </div>
          ))}
        </Card.Body>
      </Card>
    )
  }

  const GlobalResultsView = ({ results, testResults = [], roundResults = [] }) => {
    const initialScore = Array.isArray(roundResults) && roundResults.length > 0 ? Number(roundResults[0]) : null

    const finalScore = Array.isArray(roundResults) && roundResults.length > 0 ? Number(roundResults[roundResults.length - 1]) : null

    const scoreImprovement = Number.isFinite(initialScore) && Number.isFinite(finalScore) ? finalScore - initialScore : null

    return (
      <div
        className="mt-4"
        style={{
          height: "calc(100vh - 450px)",
          maxHeight: "calc(100vh - 120px)",
          overflowY: "auto",
          overflowX: "hidden"
        }}
      >
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard title="Mean client AUC" value={formatDecimal(results.auc)} subtitle="Threshold-independent metric" icon={Icon.GraphUpArrow} variant="success" />
          </div>

          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard title="Accuracy" value={formatPercentage(results.Accuracy)} subtitle={`${results.totalSamples} test samples`} icon={Icon.Bullseye} />
          </div>

          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard title="F1 score" value={formatPercentage(results.F1score)} subtitle="Precision-recall balance" icon={Icon.Speedometer2} variant="warning" />
          </div>

          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard title="Participating clients" value={results.clientCount} subtitle="Included in global aggregation" icon={Icon.People} variant="secondary" />
          </div>
        </div>
        {Array.isArray(roundResults) && roundResults.length > 0 && (
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body>
              <RoundMetricsChart roundResults={roundResults} title="Federated model performance by round" accuracyField="eval_accuracy" aucField="eval_auc" lossField="eval_loss" />
            </Card.Body>
          </Card>
        )}
        <div className="row g-3 mb-4">
          <div className="col-12 col-xl-7">
            <ConfusionMatrixCard matrix={results.confusionMatrix} />
          </div>

          <div className="col-12 col-xl-5">
            <MetricsDetailsCard results={results} />
          </div>
        </div>

        {Number.isFinite(finalScore) && (
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body>
              <div className="row align-items-center">
                <div className="col-md-4">
                  <div className="text-muted small">Final federated score</div>

                  <div className="fs-4 fw-bold">{formatDecimal(finalScore)}</div>
                </div>

                <div className="col-md-4">
                  <div className="text-muted small">Initial score</div>

                  <div className="fs-4 fw-bold">{formatDecimal(initialScore)}</div>
                </div>

                <div className="col-md-4">
                  <div className="text-muted small">Improvement</div>

                  <div className="fs-4 fw-bold">{Number.isFinite(scoreImprovement) ? `+${formatDecimal(scoreImprovement)}` : "-"}</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        )}

        <ClientOverviewTable testResults={testResults} />
      </div>
    )
  }

  const ClientOverviewTable = ({ testResults = [] }) => {
    const rows = useMemo(() => {
      return testResults.map((clientResult, index) => {
        const report = clientResult?.classification_report || {}
        const matrix = report["confusion matrix"] || {}

        const TP = Number(matrix.TP || 0)
        const FP = Number(matrix.FP || 0)
        const FN = Number(matrix.FN || 0)
        const TN = Number(matrix.TN || 0)

        return {
          client: clientResult?.node_name || clientResult?.client_id || `Client ${index + 1}`,

          samples: TP + FP + FN + TN,
          auc: report.auc,
          accuracy: report.Accuracy,
          recall: report["Sensitivity/Recall"],
          specificity: report.Specificity,
          precision: report["PPV/Precision"],
          f1: report["F1-score"]
        }
      })
    }, [testResults])

    const percentageBody = (field) => (row) => formatPercentage(row[field])

    return (
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white">
          <div className="d-flex justify-content-between align-items-center">
            <strong>Client performance</strong>

            <span className="badge bg-light text-dark">{rows.length} clients</span>
          </div>
        </Card.Header>

        <Card.Body className="p-0">
          <DataTable value={rows} emptyMessage="No client results available." stripedRows showGridlines responsiveLayout="scroll" sortField="auc" sortOrder={-1} tableStyle={{ minWidth: "65rem" }}>
            <Column field="client" header="Client" sortable frozen />

            <Column field="samples" header="Samples" sortable />

            <Column field="auc" header="AUC" sortable body={(row) => formatDecimal(row.auc)} />

            <Column field="accuracy" header="Accuracy" sortable body={percentageBody("accuracy")} />

            <Column field="recall" header="Recall" sortable body={percentageBody("recall")} />

            <Column field="specificity" header="Specificity" sortable body={percentageBody("specificity")} />

            <Column field="precision" header="Precision" sortable body={percentageBody("precision")} />

            <Column field="f1" header="F1 score" sortable body={percentageBody("f1")} />
          </DataTable>
        </Card.Body>
      </Card>
    )
  }

  useEffect(() => {
    if (!res || isXGBoost) {
      return
    }

    if (resultsType === "Global results") {
      setglobalflresults(getGlobalResults())
    }

    if (resultsType === "By node") {
      setnodeflresults(getNodeResults(selectedNode))
    }
  }, [res, isXGBoost, resultsType, selectedNode])

  useEffect(() => {
    if (isXGBoost) {
      return
    }

    const firstNode = res?.test_results?.[0]?.node_name

    if (firstNode) {
      setNode(firstNode)
    }
  }, [res, isXGBoost])

  const saveFlResults = async () => {
    try {
      const resultsPath = Path.join(globalData[UUID_ROOT].path, EXPERIMENTS)

      MEDDataObject.createFolderFromPath(`${resultsPath}/FL`)

      MEDDataObject.createFolderFromPath(`${resultsPath}/FL/Results`)

      await MEDDataObject.writeFileSync(flowResults.data, `${resultsPath}/FL/Results`, resultsFileName, "json")

      await MEDDataObject.writeFileSync(
        {
          data: flowResults.data,

          configs: flPipelineConfigs,

          date: Date.now()
        },

        `${resultsPath}/FL/Results`,
        resultsFileName,
        "medflres"
      )

      showFileName(false)

      toast.success("Experiment results saved successfully")
    } catch (error) {
      console.error("Failed to save results:", error)

      toast.error("Something went wrong ")
    }
  }

  if (!res) {
    return (
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between w-100">
            <h5>FL Pipeline results</h5>

            <Button
              className="outline"
              severity="secondary"
              text
              onClick={handleClose}
              style={{
                padding: 1
              }}
            >
              <Icon.X width="30px" height="30px" />
            </Button>
          </div>
        </Card.Header>

        <div
          style={{
            padding: "150px",
            textAlign: "center",
            fontSize: "40px"
          }}
        >
          Results not available yet
        </div>
      </Card>
    )
  }

  const displayedResults = resultsType === "Global results" ? globalflresults : nodeflresults

  const getNodeResults = (nodeName) => {
    const selectedResult = (res?.test_results || []).find((item) => item?.node_name === nodeName)

    if (!selectedResult) {
      return null
    }

    const report = selectedResult?.classification_report || {}

    const matrix = report["confusion matrix"] || {}

    const TP = Number(matrix.TP || 0)
    const FP = Number(matrix.FP || 0)
    const FN = Number(matrix.FN || 0)
    const TN = Number(matrix.TN || 0)

    return {
      nodeName: selectedResult.node_name || selectedResult.client_id || nodeName,

      totalSamples: TP + FP + FN + TN,

      confusionMatrix: [
        [TN, FP],
        [FN, TP]
      ],

      Accuracy: Number(report.Accuracy),
      SensitivityRecall: Number(report["Sensitivity/Recall"]),
      Specificity: Number(report.Specificity),
      PPV: Number(report["PPV/Precision"]),
      NPV: Number(report.NPV),
      F1score: Number(report["F1-score"]),
      FPR: Number(report["False positive rate"]),
      TPR: Number(report["True positive rate"]),
      auc: Number(report.auc)
    }
  }

  const ClientResultsView = ({ results, globalResults }) => {
    if (!results) {
      return <div className="text-center text-muted py-5">Select a client to view its results.</div>
    }

    const aucDifference = Number.isFinite(results.auc) && Number.isFinite(globalResults?.auc) ? results.auc - globalResults.auc : null

    const accuracyDifference = Number.isFinite(results.Accuracy) && Number.isFinite(globalResults?.Accuracy) ? results.Accuracy - globalResults.Accuracy : null

    const formatDifference = (value, percentage = false) => {
      if (!Number.isFinite(value)) {
        return "-"
      }

      const sign = value >= 0 ? "+" : ""

      return percentage ? `${sign}${(value * 100).toFixed(1)} pp` : `${sign}${value.toFixed(4)}`
    }

    return (
      <div className="mt-4"     style={{
          height: "calc(100vh - 450px)",
          maxHeight: "calc(100vh - 120px)",
          overflowY: "auto",
          overflowX: "hidden"
        }} >
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <div className="text-muted small">Selected client</div>

                <h4 className="mb-0">{results.nodeName}</h4>
              </div>

              <span className="badge bg-light text-dark fs-6">{results.totalSamples} test samples</span>
            </div>
          </Card.Body>
        </Card>

        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard title="AUC" value={formatDecimal(results.auc)} subtitle={`${formatDifference(aucDifference)} versus federation`} icon={Icon.GraphUpArrow} variant="success" />
          </div>

          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard title="Accuracy" value={formatPercentage(results.Accuracy)} subtitle={`${formatDifference(accuracyDifference, true)} versus federation`} icon={Icon.Bullseye} />
          </div>

          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard title="Sensitivity" value={formatPercentage(results.SensitivityRecall)} subtitle="Positive-class recall" icon={Icon.Activity} variant="warning" />
          </div>

          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard title="F1 score" value={formatPercentage(results.F1score)} subtitle="Precision-recall balance" icon={Icon.Speedometer2} variant="secondary" />
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-xl-7">
            <ConfusionMatrixCard matrix={results.confusionMatrix} />
          </div>

          <div className="col-12 col-xl-5">
            <MetricsDetailsCard results={results} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center w-100">
          <h5 className="mb-0">
            FL Pipeline results
            <span className="ms-2 badge bg-secondary">{isXGBoost ? "XGBoost" : "Neural network"}</span>
          </h5>

          <div className="d-flex">
            {isFileName ? (
              <div className="p-inputgroup flex-1 me-4">
                <InputText placeholder="File name" value={resultsFileName} onChange={(event) => setResultsFileName(event.target.value)} />

                <Button icon="pi pi-check" className="p-button-primary" onClick={saveFlResults} disabled={resultsFileName === ""} />
              </div>
            ) : null}

            <Button
              className="outline"
              severity="secondary"
              text
              tooltipOptions={{
                position: "left"
              }}
              tooltip="Save results"
              onClick={() => {
                showFileName(!isFileName)

                setResultsFileName("")
              }}
              style={{
                padding: 5
              }}
            >
              <Icon.Save width="20px" height="20px" />
            </Button>

            <Button
              variant="outline"
              text
              onClick={handleClose}
              style={{
                marginTop: -4,
                padding: 1
              }}
            >
              <Icon.X width="30px" height="30px" />
            </Button>
          </div>
        </div>
      </Card.Header>

      <Card.Body>
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
          <SelectButton
            value={activeConfig}
            onChange={(event) => {
              if (event.value) {
                setActiveConfig(event.value)
              }
            }}
            options={flowResults?.data ? flowResults.data.map((_, index) => `Config ${index + 1}`) : []}
          />

          {!isXGBoost && resultsType === "By node" && (
            <div
              style={{
                width: "200px"
              }}
            >
              <FlInput
                name="select node"
                settingInfos={{
                  type: "list",

                  tooltip: "Select a federated client",

                  choices: (res?.test_results || []).map((result) => ({
                    name: result.node_name
                  }))
                }}
                currentValue={selectedNode}
                onInputChange={(event) => setNode(event.value)}
                setHasWarning={() => {}}
              />
            </div>
          )}

          {!isXGBoost ? (
            <SelectButton
              value={resultsType}
              onChange={(event) => {
                if (event.value) {
                  setResultsType(event.value)
                }
              }}
              options={res?.federated_shap_result ? ["Global results", "By node", "Compare results", "Shap results"] : ["Global results", "By node", "Compare results"]}
            />
          ) : null}
        </div>

        {isXGBoost ? (
          <XGBoostResults result={res} />
        ) : resultsType === "Compare results" ? (
          <div className="my-3">
            <FlCompareResults data={res?.test_results || []} />
          </div>
        ) : resultsType === "Shap results" ? (
          <div className="my-3">
            <FederatedShapResults results={res?.federated_shap_result} />
          </div>
        ) : resultsType === "By node" ? (
          <ClientResultsView results={nodeflresults} globalResults={globalflresults} />
        ) : (
          <GlobalResultsView results={globalflresults} testResults={res?.test_results || []} roundResults={res?.round_results || []} />
        )}
      </Card.Body>
    </Card>
  )
}
