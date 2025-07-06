import React, { useEffect, useState } from "react"
import ReactEcharts from "echarts-for-react"
import { MultiSelect } from "primereact/multiselect"

const FlCompareResults = ({ data }) => {
  //states
  const [selectedNodes, selectNodes] = useState(
    data
      .map((item) => {
        return item.node_name
      })
      .slice(0, 3)
  )

  const [chartMetrics, setMetrics] = useState([])
  const [seriesData, setSeries] = useState([])

  const getChartResults = () => {
    const parsedData = data.map((item) => {
      return {
        nodeName: item.node_name,
        classificationReport: item.classification_report
      }
    })

    const metrics = Object.keys(parsedData[0].classificationReport)
    const seriesData = metrics.map((metric) => {
      return {
        name: metric,
        type: "bar",
        data: parsedData.map((item) => item.classificationReport[metric])
      }
    })

    setMetrics(metrics)
    setSeries(seriesData)
  }

  useEffect(() => {
    getChartResults()
  }, [selectNodes])

  const chartOptions = {
    tooltip: {
      trigger: "axis"
    },
    legend: {
      data: chartMetrics
    },
    toolbox: {
      show: true,
      feature: {
        saveAsImage: {}
      }
    },
    xAxis: {
      type: "category",
      data: selectedNodes
    },
    yAxis: {
      type: "value"
    },
    series: seriesData
  }
  return (
    <>
      <div style={{ display: "flex", gap: "10px", justifyContent: "center", margin: "20px " }}>
        <div style={{ fontSize: "20px", paddingTop: "8px" }}>Select clients to compare between</div>

        <MultiSelect
          value={selectedNodes}
          options={data.map((item) => {
            return item.node_name
          })}
          onChange={(e) => selectNodes(e.value)}
          placeholder="Select clients"
          className="w-full  md:w-20rem"
          display="chip"
          style={{ width: "400px" }}
        />
      </div>

      <ReactEcharts option={chartOptions} style={{ height: "400px", width: "100%" }} notMerge={true} lazyUpdate={true} theme={"theme_name"} />
    </>
  )
}

export default FlCompareResults
