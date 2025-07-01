import React from "react"
import ReactECharts from "echarts-for-react"

const RoundLineChart = ({ roundResults, title }) => {
  const rounds = roundResults.map((r) => r.round)
  const accuracies = roundResults.map((r) => r.accuracy)
  const aucs = roundResults.map((r) => r.auc)
  const losses = roundResults.map((r) => r.loss)

  const option = {
    title: {
      text: title,
      left: "center"
    },
    tooltip: {
      trigger: "axis"
    },
    legend: {
      data: ["Accuracy", "Loss", "AUC"],
      top: 30
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: rounds
    },
    yAxis: {
      type: "value",
      name: "Metric Value"
    },
    series: [
      {
        name: "Accuracy",
        type: "line",
        data: accuracies,
        smooth: true,
        lineStyle: {
          color: "#28a745"
        },
        itemStyle: {
          color: "#28a745"
        }
      },
      {
        name: "Loss",
        type: "line",
        data: losses,
        smooth: true,
        lineStyle: {
          color: "#dc3545"
        },
        itemStyle: {
          color: "#dc3545"
        }
      },
      {
        name: "AUC",
        type: "line",
        data: aucs,
        smooth: true,
        lineStyle: {
          color: "#007bff"
        },
        itemStyle: {
          color: "#007bff"
        }
      }
    ]
  }

  return (
    <div className=" p-3 border rounded bg-white">
      <ReactECharts option={option} style={{ height: 400 }} />
    </div>
  )
}

export default RoundLineChart
