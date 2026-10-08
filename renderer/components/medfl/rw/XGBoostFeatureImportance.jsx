import React, { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import { Alert, Card, Tab, Tabs } from "react-bootstrap"

const formatFeatureName = (feature) => {
  return feature
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const FeatureImportanceChart = ({
  values,
  title,
  description
}) => {
  const option = useMemo(() => {
    if (!values || Object.keys(values).length === 0) {
      return null
    }

    const entries = Object.entries(values)
      .map(([feature, value]) => ({
        feature,
        value: Number(value)
      }))
      .filter((item) => Number.isFinite(item.value))
      .sort((a, b) => a.value - b.value)

    return {
      title: {
        text: title,
        left: "center",
        textStyle: {
          fontSize: 16,
          fontWeight: 600
        }
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
            ${title}: ${Number(item.value).toLocaleString(undefined, {
              maximumFractionDigits: 4
            })}
          `
        }
      },

      grid: {
        left: 20,
        right: 35,
        bottom: 30,
        top: 65,
        containLabel: true
      },

      xAxis: {
        type: "value",
        min: 0,
        name: "Importance value",
        nameLocation: "middle",
        nameGap: 30,
        splitLine: {
          show: true
        }
      },

      yAxis: {
        type: "category",
        data: entries.map((item) =>
          formatFeatureName(item.feature)
        ),
        axisLabel: {
          interval: 0
        }
      },

      series: [
        {
          name: title,
          type: "bar",
          data: entries.map((item) => item.value),
          barMaxWidth: 35,

          label: {
            show: true,
            position: "right",
            formatter: (params) =>
              Number(params.value).toLocaleString(undefined, {
                maximumFractionDigits: 2
              })
          },

          emphasis: {
            focus: "series"
          }
        }
      ]
    }
  }, [values, title])

  if (!option) {
    return (
      <Alert variant="secondary">
        No {title.toLowerCase()} results are available.
      </Alert>
    )
  }

  const featureCount = Object.keys(values).length
  const chartHeight = Math.max(350, featureCount * 60)

  return (
    <div>
      {description && (
        <p className="text-muted mb-3">
          {description}
        </p>
      )}

      <ReactECharts
        option={option}
        style={{
          height: `${chartHeight}px`,
          width: "100%"
        }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  )
}

const XGBoostFeatureImportance = ({
  featureImportance
}) => {
  if (!featureImportance) {
    return (
      <Alert variant="info">
        Feature importance is not available yet.
      </Alert>
    )
  }

  const {
    round,
    gain,
    weight,
    cover,
    timestamp
  } = featureImportance

  return (
    <Card className="shadow-sm">
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 className="mb-1">
              Global Feature Importance
            </h5>

            <small className="text-muted">
              XGBoost round {round ?? "-"}
            </small>
          </div>

          {timestamp && (
            <small className="text-muted">
              {new Date(timestamp).toLocaleString()}
            </small>
          )}
        </div>
      </Card.Header>

      <Card.Body>
        <Tabs
          defaultActiveKey="gain"
          id={`xgboost-feature-importance-${round ?? "latest"}`}
          className="mb-4"
          fill
        >
          <Tab
            eventKey="gain"
            title="Gain"
          >
            <FeatureImportanceChart
              values={gain}
              title="Feature Importance — Gain"
              description="Gain represents the improvement in the model produced by splits using each feature."
            />
          </Tab>

          <Tab
            eventKey="weight"
            title="Weight"
          >
            <FeatureImportanceChart
              values={weight}
              title="Feature Importance — Weight"
              description="Weight represents how many times each feature is used to create a split across all trees."
            />
          </Tab>

          <Tab
            eventKey="cover"
            title="Cover"
          >
            <FeatureImportanceChart
              values={cover}
              title="Feature Importance — Cover"
              description="Cover represents the number of observations affected by splits involving each feature."
            />
          </Tab>
        </Tabs>
      </Card.Body>
    </Card>
  )
}

export default XGBoostFeatureImportance