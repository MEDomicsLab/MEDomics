import React, { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import {
  Alert,
  Card,
  Tab,
  Tabs
} from "react-bootstrap"

const formatFeatureName = (feature) => {
  return String(feature)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    )
}

const FeatureImportanceChart = ({
  values,
  title,
  description
}) => {
  const entries = useMemo(() => {
    if (
      !values ||
      typeof values !== "object"
    ) {
      return []
    }

    return Object.entries(values)
      .map(([feature, value]) => ({
        feature,
        value: Number(value)
      }))
      .filter((item) =>
        Number.isFinite(item.value)
      )
      .sort(
        (first, second) =>
          first.value - second.value
      )
  }, [values])

  const option = useMemo(() => {
    if (entries.length === 0) {
      return null
    }

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
          const item = params?.[0]

          if (!item) {
            return ""
          }

          return `
            <strong>${item.name}</strong>
            <br/>
            ${title}: ${Number(
              item.value
            ).toLocaleString(undefined, {
              maximumFractionDigits: 6
            })}
          `
        }
      },

      grid: {
        left: 20,
        right: 70,
        bottom: 40,
        top: 70,
        containLabel: true
      },

      xAxis: {
        type: "value",
        min: 0,

        name: "Importance value",
        nameLocation: "middle",
        nameGap: 32,

        splitLine: {
          show: true
        }
      },

      yAxis: {
        type: "category",

        data: entries.map((item) =>
          formatFeatureName(
            item.feature
          )
        ),

        axisLabel: {
          interval: 0,
          width: 190,
          overflow: "truncate"
        }
      },

      series: [
        {
          name: title,
          type: "bar",

          data: entries.map(
            (item) => item.value
          ),

          barMaxWidth: 35,

          label: {
            show: true,
            position: "right",

            formatter: (params) =>
              Number(
                params.value
              ).toLocaleString(
                undefined,
                {
                  maximumFractionDigits: 4
                }
              )
          },

          emphasis: {
            focus: "series"
          }
        }
      ]
    }
  }, [entries, title])

  if (!option) {
    return (
      <Alert variant="secondary">
        No {title.toLowerCase()} values are available.
      </Alert>
    )
  }

  const chartHeight = Math.max(
    350,
    entries.length * 55
  )

  return (
    <div>
      {description ? (
        <p className="text-muted mb-3">
          {description}
        </p>
      ) : null}

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
        Feature importance is not available.
      </Alert>
    )
  }

  const {
    gain = {},
    weight = {},
    cover = {}
  } = featureImportance

  return (
    <Card className="shadow-sm">
      <Card.Header>
        <h5 className="mb-1">
          Global feature importance
        </h5>

        <small className="text-muted">
          Computed from the final aggregated XGBoost model
        </small>
      </Card.Header>

      <Card.Body>
        <Tabs
          defaultActiveKey="gain"
          id="xgboost-feature-importance-tabs"
          className="mb-4"
          fill
        >
          <Tab
            eventKey="gain"
            title="Gain"
          >
            <FeatureImportanceChart
              values={gain}
              title="Feature importance — Gain"
              description="Gain represents the average improvement produced by splits using each feature."
            />
          </Tab>

          <Tab
            eventKey="weight"
            title="Weight"
          >
            <FeatureImportanceChart
              values={weight}
              title="Feature importance — Weight"
              description="Weight represents how many times each feature is used to create a split across all trees."
            />
          </Tab>

          <Tab
            eventKey="cover"
            title="Cover"
          >
            <FeatureImportanceChart
              values={cover}
              title="Feature importance — Cover"
              description="Cover represents the average number of observations affected by splits involving each feature."
            />
          </Tab>
        </Tabs>
      </Card.Body>
    </Card>
  )
}

export default XGBoostFeatureImportance