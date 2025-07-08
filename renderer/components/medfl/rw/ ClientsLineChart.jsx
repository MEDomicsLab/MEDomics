import React, { useState, useMemo } from "react"
import ReactECharts from "echarts-for-react"

const ClientEvalLineChart = ({ clientEvalMetrics, title = "Client Evaluation Metrics Over Rounds" }) => {
  const [selectedMetric, setSelectedMetric] = useState("accuracy")

  // Process data using useMemo for better performance
  const { uniqueClients, rounds, chartOption } = useMemo(() => {
    const uniqueClients = [...new Set(clientEvalMetrics.map((m) => m.clientId))]
    const rounds = [...new Set(clientEvalMetrics.map((m) => m.round))].sort((a, b) => a - b)

    // Create series data
    const series = []
    const metrics = selectedMetric === "all" ? ["accuracy", "auc", "loss"] : [selectedMetric]

    uniqueClients.forEach((clientId) => {
      metrics.forEach((metric) => {
        const clientData = clientEvalMetrics.filter((m) => m.clientId === clientId).sort((a, b) => a.round - b.round)

        const dataPerRound = rounds.map((round) => {
          const point = clientData.find((d) => d.round === round)
          return point ? point[metric] : null
        })

        series.push({
          name: `Client - ${clientId.substring(0, 6)} - ${metric}`,
          type: "line",
          data: dataPerRound,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: {
            width: 2
          }
        })
      })
    })

    // Create chart option
    const option = {
      title: {
        text: title,
        left: "center",
        textStyle: {
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(50,50,50,0.9)",
        borderWidth: 0,
        textStyle: { color: "#fff" },
        formatter: (params) => {
          let tooltip = `<b>Round ${params[0].axisValue}</b><br/>`
          params.forEach((p) => {
            tooltip += `${p.seriesName}: ${p.data !== null ? p.data.toFixed(4) : "N/A"}<br/>`
          })
          return tooltip
        }
      },
      legend: {
        data: series.map((s) => s.name),
        top: 40,
        type: "scroll",
        pageIconColor: "#666",
        pageTextStyle: { color: "#333" }
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "12%",
        top: "20%",
        containLabel: true
      },
      xAxis: {
        type: "category",
        name: "Round",
        nameLocation: "middle",
        nameGap: 30,
        boundaryGap: false,
        data: rounds,
        axisLine: {
          lineStyle: {
            color: "#666"
          }
        }
      },
      yAxis: {
        type: "value",
        name: selectedMetric === "all" ? "Metric Value" : selectedMetric.toUpperCase(),
        nameTextStyle: {
          padding: [0, 0, 0, 40]
        },
        axisLine: {
          lineStyle: {
            color: "#666"
          }
        },
        splitLine: {
          lineStyle: {
            type: "dashed"
          }
        }
      },
      series
    }

    return { uniqueClients, rounds, chartOption: option }
  }, [clientEvalMetrics, selectedMetric, title])

  return (
    <div className="p-3 border rounded bg-white shadow-sm">
      <div className="d-flex flex-wrap gap-2 mb-3">
        {["accuracy", "auc", "loss", "all"].map((metric) => (
          <button key={metric} onClick={() => setSelectedMetric(metric)} className={`btn btn-sm ${selectedMetric === metric ? "btn-primary" : "btn-outline-secondary"}`}>
            {metric.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Key forces re-render when metric changes */}
      <ReactECharts option={chartOption} style={{ height: 450 }} key={`chart-${selectedMetric}`} />
    </div>
  )
}

export default ClientEvalLineChart
