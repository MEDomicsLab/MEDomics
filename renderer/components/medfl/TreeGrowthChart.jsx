const TreeGrowthChart = ({ roundResults }) => {
  const option = useMemo(() => {
    if (!Array.isArray(roundResults) || roundResults.length === 0) {
      return null
    }

    const validResults = roundResults.filter(
      (result) =>
        Number.isFinite(
          Number(result.global_num_trees)
        )
    )

    if (validResults.length === 0) {
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
        top: 65,
        containLabel: true
      },

      xAxis: {
        type: "category",
        name: "Federated round",
        nameLocation: "middle",
        nameGap: 30,

        data: validResults.map(
          (result) => result.round
        )
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

          data: validResults.map(
            (result) =>
              Number(result.global_num_trees)
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
    return null
  }

  return (
    <div className="p-3 border rounded bg-white">
      <ReactECharts
        option={option}
        style={{
          height: "370px",
          width: "100%"
        }}
        notMerge
        lazyUpdate
      />
    </div>
  )
}