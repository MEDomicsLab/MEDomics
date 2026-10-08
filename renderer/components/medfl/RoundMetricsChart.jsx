import React, { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import { Alert } from "react-bootstrap"

const toFiniteNumber = (value) => {
  const numericValue = Number(value)

  return Number.isFinite(numericValue)
    ? numericValue
    : null
}

const RoundMetricsChart = ({
  roundResults = [],
  title = "Metrics over federated rounds",
  accuracyField,
  aucField,
  lossField,
  extraSeries = []
}) => {
  const option = useMemo(() => {
    if (
      !Array.isArray(roundResults) ||
      roundResults.length === 0
    ) {
      return null
    }

    const rounds = roundResults.map(
      (result, index) =>
        result?.round ?? index + 1
    )

    const series = []

    const addSeries = ({
      name,
      field,
      yAxisIndex = 0,
      type = "line"
    }) => {
      if (!field) {
        return
      }

      const values = roundResults.map(
        (result) =>
          toFiniteNumber(result?.[field])
      )

      const hasAtLeastOneValue =
        values.some(
          (value) => value !== null
        )

      if (!hasAtLeastOneValue) {
        return
      }

      series.push({
        name,
        type,
        yAxisIndex,
        data: values,

        smooth: true,
        connectNulls: true,

        symbol: "circle",
        symbolSize: 7,

        lineStyle: {
          width: 3
        },

        emphasis: {
          focus: "series"
        }
      })
    }

    // Accuracy
    addSeries({
      name: "Accuracy",
      field: accuracyField
    })

    // AUC
    addSeries({
      name: "AUC",
      field: aucField
    })

    // Loss
    addSeries({
      name: "Loss",
      field: lossField,
      yAxisIndex: 1
    })

    // Any additional metrics
    extraSeries.forEach((item) => {
      addSeries({
        name: item.name,
        field: item.field,
        type: item.type || "line",
        yAxisIndex:
          item.yAxisIndex ?? 0
      })
    })

    if (series.length === 0) {
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
          type: "line"
        },

        valueFormatter: (value) => {
          const numericValue =
            Number(value)

          if (
            !Number.isFinite(
              numericValue
            )
          ) {
            return "-"
          }

          return numericValue.toFixed(4)
        }
      },

      legend: {
        data: series.map(
          (item) => item.name
        ),

        top: 32
      },

      grid: {
        left: "4%",
        right: "5%",
        bottom: "12%",
        top: 90,
        containLabel: true
      },

      xAxis: {
        type: "category",

        boundaryGap: false,

        data: rounds,

        name: "Federated round",

        nameLocation: "middle",

        nameGap: 35,

        axisTick: {
          alignWithLabel: true
        }
      },

      yAxis: [
        {
          type: "value",

          name: "Score",

          min: 0,
          max: 1,

          axisLabel: {
            formatter: (value) =>
              Number(value).toFixed(2)
          }
        },

        {
          type: "value",

          name: "Loss",

          position: "right",

          min: 0,

          axisLabel: {
            formatter: (value) =>
              Number(value).toFixed(3)
          }
        }
      ],

      series
    }
  }, [
    roundResults,
    title,
    accuracyField,
    aucField,
    lossField,
    extraSeries
  ])

  if (!option) {
    return (
      <Alert
        variant="light"
        className="text-center text-muted"
      >
        No round metrics are available.
      </Alert>
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{
        height: "420px",
        width: "100%"
      }}
      notMerge={true}
      lazyUpdate={true}
    />
  )
}

export const TreeGrowthChart = ({
  roundResults = []
}) => {
  const option = useMemo(() => {
    if (
      !Array.isArray(roundResults) ||
      roundResults.length === 0
    ) {
      return null
    }

    const validResults =
      roundResults
        .map(
          (result, index) => ({
            round:
              result?.round ??
              index + 1,

            trees:
              toFiniteNumber(
                result?.global_num_trees
              )
          })
        )
        .filter(
          (result) =>
            result.trees !== null
        )

    if (
      validResults.length === 0
    ) {
      return null
    }

    return {
      title: {
        text: "Global tree growth",
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
        }
      },

      grid: {
        left: "4%",
        right: "4%",
        bottom: "10%",
        top: 70,
        containLabel: true
      },

      xAxis: {
        type: "category",

        data:
          validResults.map(
            (result) =>
              result.round
          ),

        name: "Federated round",

        nameLocation: "middle",

        nameGap: 32
      },

      yAxis: {
        type: "value",

        name: "Number of trees",

        minInterval: 1
      },

      series: [
        {
          name: "Global trees",

          type: "bar",

          data:
            validResults.map(
              (result) =>
                result.trees
            ),

          barMaxWidth: 45,

          label: {
            show: true,
            position: "top"
          },

          emphasis: {
            focus: "series"
          }
        }
      ]
    }
  }, [roundResults])

  if (!option) {
    return (
      <Alert
        variant="light"
        className="text-center text-muted"
      >
        Tree growth information is not available.
      </Alert>
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{
        height: "370px",
        width: "100%"
      }}
      notMerge={true}
      lazyUpdate={true}
    />
  )
}

export default RoundMetricsChart