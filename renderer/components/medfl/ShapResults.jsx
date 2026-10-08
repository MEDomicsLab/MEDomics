import React, { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import {
  Alert,
  Badge,
  Card,
  Col,
  Row,
  Tab,
  Table,
  Tabs
} from "react-bootstrap"

export default function FederatedShapResults({ results  , scrollable = true}) {
  const formatNumber = (value, digits = 6) => {
    const number = Number(value)

    if (!Number.isFinite(number)) {
      return "-"
    }

    return number.toFixed(digits)
  }

  const formatPercentage = (value, digits = 1) => {
    const number = Number(value)

    if (!Number.isFinite(number)) {
      return "-"
    }

    return `${(number * 100).toFixed(digits)}%`
  }

  const featureImportance = useMemo(() => {
    return [...(results?.feature_importance || [])].sort(
      (a, b) => b.mean_abs_shap - a.mean_abs_shap
    )
  }, [results])

  const clientResults = results?.client_results || []

  const globalImportanceOption = useMemo(() => {
    const reversedFeatures = [...featureImportance].reverse()

    return {
      title: {
        text: "Global Feature Importance",
        subtext: "Mean absolute SHAP value",
        left: "center"
      },

      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow"
        },
        formatter: (params) => {
          const item = params[0]

          return `
            <strong>${item.name}</strong><br/>
            Mean |SHAP|: ${formatNumber(item.value)}
          `
        }
      },

      grid: {
        left: 150,
        right: 40,
        top: 70,
        bottom: 40
      },

      xAxis: {
        type: "value",
        name: "Mean |SHAP value|",
        nameLocation: "middle",
        nameGap: 30
      },

      yAxis: {
        type: "category",
        data: reversedFeatures.map((item) => item.feature),
        axisLabel: {
          interval: 0
        }
      },

      series: [
        {
          name: "Mean absolute SHAP",
          type: "bar",
          data: reversedFeatures.map((item) => item.mean_abs_shap),
          barMaxWidth: 28,
          label: {
            show: true,
            position: "right",
            formatter: ({ value }) => formatNumber(value, 4)
          }
        }
      ]
    }
  }, [featureImportance])

  const signedImpactOption = useMemo(() => {
    const orderedFeatures = [...featureImportance].sort(
      (a, b) => a.mean_signed_shap - b.mean_signed_shap
    )

    return {
      title: {
        text: "Average SHAP Direction",
        subtext:
          "Positive values increase the prediction; negative values decrease it",
        left: "center"
      },

      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow"
        },
        formatter: (params) => {
          const item = params[0]

          return `
            <strong>${item.name}</strong><br/>
            Mean signed SHAP: ${formatNumber(item.value)}
          `
        }
      },

      grid: {
        left: 150,
        right: 40,
        top: 80,
        bottom: 40
      },

      xAxis: {
        type: "value",
        name: "Mean signed SHAP value",
        nameLocation: "middle",
        nameGap: 30,
        axisLine: {
          show: true
        }
      },

      yAxis: {
        type: "category",
        data: orderedFeatures.map((item) => item.feature),
        axisLabel: {
          interval: 0
        }
      },

      series: [
        {
          type: "bar",
          data: orderedFeatures.map((item) => ({
            value: item.mean_signed_shap,
            itemStyle: {
              color:
                item.mean_signed_shap >= 0
                  ? "#28a745"
                  : "#dc3545"
            }
          })),
          label: {
            show: true,
            position: (params) =>
              params.value >= 0 ? "right" : "left",
            formatter: ({ value }) => formatNumber(value, 4)
          }
        }
      ]
    }
  }, [featureImportance])

  const directionRatesOption = useMemo(() => {
    const reversedFeatures = [...featureImportance].reverse()

    return {
      title: {
        text: "SHAP Direction Distribution",
        subtext: "Percentage of positive, negative and zero SHAP values",
        left: "center"
      },

      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow"
        },
        formatter: (params) => {
          const lines = params.map(
            (item) =>
              `${item.marker}${item.seriesName}: ${formatPercentage(
                item.value
              )}`
          )

          return `<strong>${params[0].name}</strong><br/>${lines.join(
            "<br/>"
          )}`
        }
      },

      legend: {
        top: 45
      },

      grid: {
        left: 150,
        right: 40,
        top: 90,
        bottom: 40
      },

      xAxis: {
        type: "value",
        max: 1,
        axisLabel: {
          formatter: (value) => `${value * 100}%`
        }
      },

      yAxis: {
        type: "category",
        data: reversedFeatures.map((item) => item.feature),
        axisLabel: {
          interval: 0
        }
      },

      series: [
        {
          name: "Positive",
          type: "bar",
          stack: "direction",
          data: reversedFeatures.map(
            (item) => item.positive_rate
          ),
          itemStyle: {
            color: "#28a745"
          }
        },
        {
          name: "Negative",
          type: "bar",
          stack: "direction",
          data: reversedFeatures.map(
            (item) => item.negative_rate
          ),
          itemStyle: {
            color: "#dc3545"
          }
        },
        {
          name: "Zero",
          type: "bar",
          stack: "direction",
          data: reversedFeatures.map((item) => item.zero_rate),
          itemStyle: {
            color: "#adb5bd"
          }
        }
      ]
    }
  }, [featureImportance])

  const clientComparisonOption = useMemo(() => {
    if (clientResults.length === 0) {
      return null
    }

    const featureNames = featureImportance.map(
      (item) => item.feature
    )

    const series = clientResults.map((client) => {
      const importanceMap = Object.fromEntries(
        client.feature_importance.map((item) => [
          item.feature,
          item.mean_abs_shap
        ])
      )

      return {
        name: `Client ${client.client_id}`,
        type: "bar",
        data: featureNames.map(
          (feature) => importanceMap[feature] || 0
        ),
        barMaxWidth: 30
      }
    })

    return {
      title: {
        text: "Client Feature Importance Comparison",
        subtext: "Mean absolute SHAP value by client",
        left: "center"
      },

      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow"
        }
      },

      legend: {
        top: 45
      },

      grid: {
        left: 70,
        right: 30,
        top: 90,
        bottom: 100
      },

      xAxis: {
        type: "category",
        data: featureNames,
        axisLabel: {
          rotate: 35,
          interval: 0
        }
      },

      yAxis: {
        type: "value",
        name: "Mean |SHAP|"
      },

      series
    }
  }, [clientResults, featureImportance])

  if (!results) {
    return (
      <Alert variant="secondary">
        No federated SHAP results are available.
      </Alert>
    )
  }

  if (results.status !== "completed") {
    return (
      <Alert variant="warning">
        SHAP analysis status:{" "}
        <strong>{results.status || "unknown"}</strong>
      </Alert>
    )
  }

  const mostImportantFeature = featureImportance[0]

  return (
    <div
      className="px-3"
      style={scrollable
        ? { height: "530px", overflowY: "scroll", overflowX: "hidden" }
        : { overflowX: "hidden" }}
    >
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-1">Federated SHAP Results</h4>

          <small className="text-muted">
            Global and client-level model explanations
          </small>
        </div>

        <Badge bg="success">Completed</Badge>
      </div>

      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} lg={3}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <div className="text-muted small">
                Participating clients
              </div>

              <div className="fs-3 fw-bold">
                {results.participating_clients}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <div className="text-muted small">
                Explained samples
              </div>

              <div className="fs-3 fw-bold">
                {results.explained_samples?.toLocaleString()}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <div className="text-muted small">Explainer</div>

              <div className="fs-4 fw-semibold text-capitalize">
                {results.explainer}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <div className="text-muted small">
                Most important feature
              </div>

              <div className="fs-5 fw-semibold">
                {mostImportantFeature?.feature || "-"}
              </div>

              <small className="text-muted">
                Mean |SHAP|:{" "}
                {formatNumber(
                  mostImportantFeature?.mean_abs_shap,
                  4
                )}
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <Card.Body>
          <Tabs
            defaultActiveKey="global"
            className="mb-3"
            mountOnEnter
            variant="pills"
          >
            <Tab
              eventKey="global"
              title="Global Importance"
            >
              <ReactECharts
                option={globalImportanceOption}
                style={{
                  height: Math.max(
                    420,
                    featureImportance.length * 55
                  )
                }}
                notMerge
                lazyUpdate
              />
            </Tab>

            <Tab
              eventKey="direction"
              title="Impact Direction"
            >
              <ReactECharts
                option={signedImpactOption}
                style={{
                  height: Math.max(
                    420,
                    featureImportance.length * 55
                  )
                }}
                notMerge
                lazyUpdate
              />
            </Tab>

            <Tab
              eventKey="distribution"
              title="Direction Distribution"
            >
              <ReactECharts
                option={directionRatesOption}
                style={{
                  height: Math.max(
                    430,
                    featureImportance.length * 55
                  )
                }}
                notMerge
                lazyUpdate
              />
            </Tab>

            {clientComparisonOption && (
              <Tab
                eventKey="clients"
                title="Client Comparison"
              >
                <ReactECharts
                  option={clientComparisonOption}
                  style={{ height: 500 }}
                  notMerge
                  lazyUpdate
                />

                <ClientSummaryTable
                  clientResults={clientResults}
                  formatNumber={formatNumber}
                />
              </Tab>
            )}

            <Tab eventKey="details" title="Detailed Results">
              <FeatureImportanceTable
                featureImportance={featureImportance}
                formatNumber={formatNumber}
                formatPercentage={formatPercentage}
              />
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      <Card className="shadow-sm mt-3">
        <Card.Header className="fw-semibold">
          SHAP Configuration
        </Card.Header>

        <Card.Body>
          <Row className="g-3">
            <Col xs={12} md={3}>
              <div className="text-muted small">Explainer</div>
              <div className="text-capitalize">
                {results.explainer}
              </div>
            </Col>

            <Col xs={12} md={3}>
              <div className="text-muted small">Data split</div>
              <div className="text-capitalize">
                {results.data_split}
              </div>
            </Col>

            <Col xs={12} md={3}>
              <div className="text-muted small">
                Background size
              </div>
              <div>{results.background_size}</div>
            </Col>

            <Col xs={12} md={3}>
              <div className="text-muted small">
                Samples requested per client
              </div>
              <div>
                {results.requested_explanation_size}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  )
}

function FeatureImportanceTable({
  featureImportance,
  formatNumber,
  formatPercentage
}) {
  return (
    <div className="table-responsive">
      <Table bordered hover size="sm" className="align-middle">
        <thead className="table-light">
          <tr>
            <th>Rank</th>
            <th>Feature</th>
            <th>Mean |SHAP|</th>
            <th>Mean signed SHAP</th>
            <th>Standard deviation</th>
            <th>Positive</th>
            <th>Negative</th>
            <th>Zero</th>
          </tr>
        </thead>

        <tbody>
          {featureImportance.map((item, index) => (
            <tr key={item.feature}>
              <td>{index + 1}</td>

              <td>
                <strong>{item.feature}</strong>
              </td>

              <td>{formatNumber(item.mean_abs_shap)}</td>

              <td>
                <span
                  className={
                    item.mean_signed_shap >= 0
                      ? "text-success"
                      : "text-danger"
                  }
                >
                  {formatNumber(item.mean_signed_shap)}
                </span>
              </td>

              <td>{formatNumber(item.shap_std)}</td>

              <td>
                {formatPercentage(item.positive_rate)}
              </td>

              <td>
                {formatPercentage(item.negative_rate)}
              </td>

              <td>{formatPercentage(item.zero_rate)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

function ClientSummaryTable({
  clientResults,
  formatNumber
}) {
  return (
    <div className="table-responsive mt-4">
      <h6>Client summary</h6>

      <Table bordered hover size="sm" className="align-middle">
        <thead className="table-light">
          <tr>
            <th>Client</th>
            <th>Explained samples</th>
            <th>Most important feature</th>
            <th>Mean |SHAP|</th>
          </tr>
        </thead>

        <tbody>
          {clientResults.map((client) => {
            const sortedFeatures = [
              ...(client.feature_importance || [])
            ].sort(
              (a, b) =>
                b.mean_abs_shap - a.mean_abs_shap
            )

            const topFeature = sortedFeatures[0]

            return (
              <tr key={client.client_id}>
                <td>
                  <Badge bg="secondary">
                    Client {client.client_id}
                  </Badge>
                </td>

                <td>{client.explained_samples}</td>

                <td>{topFeature?.feature || "-"}</td>

                <td>
                  {formatNumber(
                    topFeature?.mean_abs_shap
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}