import React, { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import { Badge, Card, Table } from "react-bootstrap"
import * as Icon from "react-bootstrap-icons"
import { Message } from "primereact/message"

// holdout metric -> where the same metric is in a client test result (MEDfl report for NN, metrics for XGBoost)
const METRICS = [
  { key: "auc", label: "AUC", nn: "auc", xgboost: "auc" },
  { key: "accuracy", label: "Accuracy", nn: "Accuracy", xgboost: "accuracy" },
  { key: "sensitivity", label: "Sensitivity (recall)", nn: "Sensitivity/Recall" },
  { key: "specificity", label: "Specificity", nn: "Specificity" },
  { key: "ppv", label: "PPV (precision)", nn: "PPV/Precision" },
  { key: "npv", label: "NPV", nn: "NPV" },
  { key: "f1", label: "F1-score", nn: "F1-score" }
]

// MEDfl tests the clients with a 0.5 threshold
const CLIENT_TEST_THRESHOLD = 0.5

const format = (value, digits = 3) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? "-" : Number(value).toFixed(digits))

const mean = (values) => {
  const numbers = values.map(Number).filter(Number.isFinite)
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null
}

/**
 * Average of each metric over the clients' internal test sets, to compare with the holdout
 */
const clientTestMeans = (testResults, isXGBoost) => {
  const means = {}
  METRICS.forEach((metric) => {
    const source = isXGBoost ? metric.xgboost : metric.nn
    if (!source) return
    const values = (testResults || []).map((result) => (isXGBoost ? result?.metrics?.[source] : result?.classification_report?.[source]))
    means[metric.key] = mean(values)
  })
  return means
}

const MetricCard = ({ label, value }) => (
  <div className="col-6 col-md-4 col-xl-3 mb-3">
    <Card className="h-100">
      <Card.Body>
        <div className="text-muted small">{label}</div>
        <div style={{ fontSize: "1.6rem", fontWeight: 600 }}>{format(value)}</div>
      </Card.Body>
    </Card>
  </div>
)

const RocCurve = ({ roc, auc }) => {
  const option = useMemo(
    () => ({
      tooltip: { trigger: "axis", valueFormatter: (value) => format(value) },
      grid: { left: 50, right: 20, top: 30, bottom: 45 },
      xAxis: { type: "value", min: 0, max: 1, name: "False positive rate", nameLocation: "middle", nameGap: 28 },
      yAxis: { type: "value", min: 0, max: 1, name: "True positive rate", nameLocation: "middle", nameGap: 35 },
      series: [
        { name: `ROC (AUC ${format(auc)})`, type: "line", showSymbol: false, data: roc.fpr.map((fpr, index) => [fpr, roc.tpr[index]]) },
        {
          name: "Chance",
          type: "line",
          showSymbol: false,
          lineStyle: { type: "dashed" },
          data: [
            [0, 0],
            [1, 1]
          ]
        }
      ],
      legend: { bottom: 0 }
    }),
    [roc, auc]
  )
  return <ReactECharts option={option} style={{ height: 320 }} />
}

export const ConfusionMatrix = ({ matrix }) => (
  <Table bordered className="text-center mb-0">
    <thead>
      <tr>
        <th></th>
        <th>Predicted negative</th>
        <th>Predicted positive</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th>Actual negative</th>
        <td>TN: {matrix.TN}</td>
        <td>FP: {matrix.FP}</td>
      </tr>
      <tr>
        <th>Actual positive</th>
        <td>FN: {matrix.FN}</td>
        <td>TP: {matrix.TP}</td>
      </tr>
    </tbody>
  </Table>
)

/**
 * How the decision threshold was chosen when the Holdout Test node optimizes it on the validation data
 * @param {Object} selection threshold_selection of the holdout results
 */
const VALIDATION_METRICS = [
  { key: "sensitivity", label: "Sensitivity" },
  { key: "specificity", label: "Specificity" },
  { key: "ppv", label: "PPV" },
  { key: "npv", label: "NPV" },
  { key: "f1", label: "F1-score" }
]


export const ThresholdSelection = ({ selection }) => {
  if (!selection) return null

  const { validation, metrics } = selection

  const hasTarget =
    selection.target_sensitivity !== null &&
    selection.target_sensitivity !== undefined

  const isSmallSample = validation.rows < 100

  return (
    <Card className="mb-3 border shadow-sm overflow-hidden">
      <Card.Body className="p-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <Icon.Bullseye className="text-primary" size={20} />
              <h6 className="fw-semibold mb-0">
                Optimized Decision Threshold
              </h6>
            </div>
            <p className="text-muted small mb-0">
              Selected using federated validation data
            </p>
          </div>

          <Badge
            bg="success-subtle"
            text="success"
            className="d-inline-flex align-items-center gap-1 px-2 py-2 fw-medium"
          >
            <Icon.ShieldCheck size={14} />
            Holdout preserved
          </Badge>
        </div>

        {/* Threshold & selection details */}
        <div className="row g-3 align-items-stretch mb-4">
          <div className="col-12 col-md-4">
            <div className="bg-primary-subtle rounded-3 p-3 h-100 d-flex flex-column justify-content-center align-items-center text-center">
              <span className="text-muted small mb-2">
                Selected threshold
              </span>

              <div
                className="fw-bold text-primary lh-1"
                style={{ fontSize: "2.75rem" }}
              >
                {format(selection.threshold, 3)}
              </div>

              <span className="text-muted small mt-2">
                Positive if probability ≥ threshold
              </span>
              {selection.resolution ? (
                <span className="text-muted small">
                  Histogram bin edge (steps of {Number(selection.resolution).toPrecision(2)})
                </span>
              ) : null}
            </div>
          </div>

          <div className="col-12 col-md-8">
            <div className="border rounded-3 p-3 h-100">
              <div className="mb-3">
                <div className="text-muted small mb-1">
                  Optimization criterion
                </div>

                <div className="fw-semibold">
                  {selection.criterion_label}
                  {hasTarget && (
                    <span className="text-primary ms-1">
                      ≥ {format(selection.target_sensitivity, 2)}
                    </span>
                  )}
                </div>
              </div>

              <div className="border-top pt-3">
                <div className="text-muted small mb-2">
                  Validation dataset
                </div>

                <div className="d-flex flex-wrap gap-4">
                  <div>
                    <div className="fw-semibold">
                      {validation.clients}
                    </div>
                    <div className="text-muted small">
                      Clients
                    </div>
                  </div>

                  <div>
                    <div className="fw-semibold">
                      {validation.rows?.toLocaleString()}
                    </div>
                    <div className="text-muted small">
                      Samples
                    </div>
                  </div>

                  <div>
                    <div className="fw-semibold">
                      {validation.positives?.toLocaleString()}
                    </div>
                    <div className="text-muted small">
                      Positive
                    </div>
                  </div>

                  <div>
                    <div className="fw-semibold">
                      {validation.negatives?.toLocaleString()}
                    </div>
                    <div className="text-muted small">
                      Negative
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validation metrics */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h6 className="fw-semibold mb-1">
              Validation Performance
            </h6>
            <p className="text-muted small mb-0">
              Metrics evaluated at the selected threshold
            </p>
          </div>
        </div>

        <div className="row g-2">
          {VALIDATION_METRICS.map((metric) => (
            <div
              key={metric.key}
              className="col-6 col-md"
            >
              <div className="border rounded-3 p-3 text-center h-100">
                <div className="text-muted small mb-2">
                  {metric.label}
                </div>

                <div
                  className="fw-semibold"
                  style={{ fontSize: "1.35rem" }}
                >
                  {format(metrics[metric.key])}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Warning */}
        {isSmallSample && (
          <div className="mt-3">
            <Message
              severity="warn"
              className="w-100 justify-content-start"
              text="Small validation dataset: the selected threshold may be sensitive to the data split."
            />
          </div>
        )}
      </Card.Body>
    </Card>
  )
}


/**
 * Results of the final federated model on the holdout dataset (Holdout Test node)
 * @param {Object} holdout holdout_results of a configuration
 * @param {Array} testResults test_results of the same configuration (clients' internal test sets)
 * @param {Boolean} isXGBoost model type of the configuration
 * @param {Boolean} showComparison show the holdout vs. clients' internal test sets table
 */

export default function HoldoutResults({
  holdout,
  testResults = [],
  isXGBoost = false,
  showComparison = true,
  scrollable = true,
}) {
  const clientMeans = useMemo(
    () => clientTestMeans(testResults, isXGBoost),
    [testResults, isXGBoost]
  )

  if (!holdout) {
    return (
      <Message
        severity="info"
        className="w-100 my-3"
        text="No Holdout Test configured. Add a Holdout Test node in the Evaluation section to evaluate the final model on unseen data."
      />
    )
  }

  if (holdout.error) {
    return (
      <Message
        severity="error"
        className="w-100 my-3"
        text={`Holdout evaluation failed: ${holdout.error}`}
      />
    )
  }

  const { dataset, metrics, threshold } = holdout

  const comparedMetrics = METRICS.filter(
    (metric) => clientMeans[metric.key] !== undefined
  )

  const thresholdDiffers =
    Number(threshold) !== CLIENT_TEST_THRESHOLD

  return (
    <div
      className={`my-3 ${
        scrollable ? "overflow-auto" : ""
      }`}
      style={scrollable ? { maxHeight: "550px" } : undefined}
    >
      {/* Evaluation overview */}
      <Card className="border shadow-sm mb-3">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <Icon.ShieldCheck
                  size={20}
                  className="text-primary"
                />
                <h6 className="fw-semibold mb-0">
                  Federated Holdout Evaluation
                </h6>
              </div>

              <p className="text-muted small mb-0">
                Final model performance on independent holdout data
              </p>
            </div>

            <Badge
              bg="success-subtle"
              text="success"
              className="d-inline-flex align-items-center gap-1 px-2 py-2 fw-medium"
            >
              <Icon.CheckCircle size={14} />
              Evaluation completed
            </Badge>
          </div>

          {/* Dataset summary */}
          <div className="border rounded-3 p-3">
            <div className="d-flex align-items-center gap-2 mb-3">
              <Icon.Database
                size={16}
                className="text-muted"
              />
              <span className="fw-semibold small">
                Holdout Dataset
              </span>
            </div>

            <div className="row g-3">
              <div className="col-12 col-md-4">
                <div className="text-muted small mb-1">
                  Dataset
                </div>
                <div
                  className="fw-semibold text-break"
                  title={dataset.name}
                >
                  {dataset.name}
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="text-muted small mb-1">
                  Samples
                </div>
                <div className="fw-semibold">
                  {dataset.rows?.toLocaleString()}
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="text-muted small mb-1">
                  Positive
                </div>
                <div className="fw-semibold">
                  {dataset.positives?.toLocaleString()}
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="text-muted small mb-1">
                  Negative
                </div>
                <div className="fw-semibold">
                  {dataset.negatives?.toLocaleString()}
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="text-muted small mb-1">
                  Threshold
                </div>
                <div className="fw-semibold text-primary">
                  {format(threshold, 3)}
                </div>
              </div>
            </div>

            {(holdout.model?.name ||
              dataset.rows_without_target > 0) && (
              <div className="border-top mt-3 pt-3 d-flex flex-wrap gap-3">
                {holdout.model?.name && (
                  <div className="d-flex align-items-center gap-2 small">
                    <Icon.Cpu className="text-muted" size={14} />
                    <span className="text-muted">Model:</span>
                    <span className="fw-medium">
                      {holdout.model.name}
                    </span>
                  </div>
                )}

                {dataset.rows_without_target > 0 && (
                  <div className="d-flex align-items-center gap-2 small text-warning-emphasis">
                    <Icon.Info size={14} />
                    {dataset.rows_without_target.toLocaleString()} rows
                    excluded (missing target)
                  </div>
                )}
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Threshold selection */}
      <ThresholdSelection
        selection={holdout.threshold_selection}
      />

      {/* Performance metrics */}
      <div className="mb-3">
        <div className="mb-3">
          <h6 className="fw-semibold mb-1">
            Holdout Performance
          </h6>
          <p className="text-muted small mb-0">
            Aggregated evaluation metrics across holdout clients
          </p>
        </div>

        <div className="row g-3">
          {METRICS.map((metric) => (
            <MetricCard
              key={metric.key}
              label={metric.label}
              value={metrics[metric.key]}
            />
          ))}
        </div>
      </div>

      {/* Evaluation visualizations */}
      <div className="mb-3">
        <h6 className="fw-semibold mb-1">
          Evaluation Analysis
        </h6>
        <p className="text-muted small mb-3">
          Discrimination performance and classification outcomes
        </p>

        <div className="row g-3">
          {/* ROC curve */}
          <div className="col-12 col-xl-6">
            <Card className="border shadow-sm h-100">
              <Card.Body className="p-4">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <Icon.Activity
                    size={18}
                    className="text-primary"
                  />
                  <h6 className="fw-semibold mb-0">
                    ROC Curve
                  </h6>
                </div>

                <p className="text-muted small mb-3">
                  True positive rate versus false positive rate
                </p>

                <div className="border-top pt-3">
                  {holdout.roc_curve ? (
                    <RocCurve
                      roc={holdout.roc_curve}
                      auc={metrics.auc}
                    />
                  ) : (
                    <Message
                      severity="warn"
                      text="ROC and AUC are undefined because the holdout contains only one class."
                    />
                  )}
                </div>
              </Card.Body>
            </Card>
          </div>

          {/* Confusion matrix */}
          <div className="col-12 col-xl-6">
            <Card className="border shadow-sm h-100">
              <Card.Body className="p-4">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <Icon.Grid
                    size={18}
                    className="text-primary"
                  />
                  <h6 className="fw-semibold mb-0">
                    Confusion Matrix
                  </h6>
                </div>

                <p className="text-muted small mb-3">
                  Classification outcomes at the selected threshold
                </p>

                <div className="border-top pt-3">
                  <ConfusionMatrix
                    matrix={holdout.confusion_matrix}
                  />
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      </div>

      {/* Performance comparison */}
      {showComparison && (
        <Card className="border shadow-sm">
          <Card.Body className="p-4">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <Icon.BarChart2
                    size={18}
                    className="text-primary"
                  />
                  <h6 className="fw-semibold mb-0">
                    Performance Comparison
                  </h6>
                </div>

                <p className="text-muted small mb-0">
                  Holdout evaluation versus clients' internal test sets
                </p>
              </div>

              <Badge
                bg="secondary-subtle"
                text="secondary"
                className="fw-medium px-2 py-2"
              >
                Client mean baseline
              </Badge>
            </div>

            <div className="table-responsive">
              <Table
                hover
                size="sm"
                className="align-middle mb-0"
              >
                <thead className="table-light">
                  <tr>
                    <th className="py-3 ps-3 fw-semibold">
                      Metric
                    </th>
                    <th className="py-3 text-end fw-semibold">
                      Holdout
                    </th>
                    <th className="py-3 text-end fw-semibold">
                      Client mean
                    </th>
                    <th className="py-3 pe-3 text-end fw-semibold">
                      Difference
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {comparedMetrics.map((metric) => {
                    const holdoutValue = metrics[metric.key]
                    const clientValue = clientMeans[metric.key]

                    const hasValues =
                      typeof holdoutValue === "number" &&
                      Number.isFinite(holdoutValue) &&
                      typeof clientValue === "number" &&
                      Number.isFinite(clientValue)

                    const difference = hasValues
                      ? holdoutValue - clientValue
                      : null

                    const isNegative =
                      difference !== null && difference < -0.0005

                    const isPositive =
                      difference !== null && difference > 0.0005

                    return (
                      <tr key={metric.key}>
                        <td className="py-3 ps-3 fw-medium">
                          {metric.label}
                        </td>

                        <td className="py-3 text-end fw-semibold">
                          {format(holdoutValue)}
                        </td>

                        <td className="py-3 text-end text-muted">
                          {format(clientValue)}
                        </td>

                        <td className="py-3 pe-3 text-end">
                          {difference === null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <span
                              className={`fw-medium ${
                                isNegative
                                  ? "text-danger"
                                  : isPositive
                                    ? "text-success"
                                    : "text-muted"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {format(difference)}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>

            {/* Comparison notes */}
            <div className="border-top mt-3 pt-3">
              <div className="d-flex align-items-start gap-2">
                <Icon.Info
                  size={16}
                  className="text-muted flex-shrink-0 mt-1"
                />

                <div className="text-muted small">
                  Differences are calculated as holdout minus
                  client mean. A performance drop may indicate
                  weaker generalization to unseen data.

                  {thresholdDiffers && (
                    <div className="mt-2 text-warning-emphasis">
                      <Icon.AlertTriangle
                        size={14}
                        className="me-1"
                      />
                      Different classification thresholds are
                      used (holdout: {format(threshold, 3)},
                      clients: {CLIENT_TEST_THRESHOLD}).
                      Only threshold-independent metrics such
                      as AUC are directly comparable.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  )
}

