import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { getCurve, curveColor } from "./med3paResultsUtils"

// Import echarts only on client side
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false })

/**
 * @description Metrics vs Declaration Rate curves (the "MDR" chart of the mockup),
 * with a vertical mark line at the active DR and an optional second marker
 * (e.g. a patient's confidence position on the Patient Detail page).
 *
 * @param {Object} metricsByDr session.metrics_by_dr
 * @param {Array} visibleMetrics metric names to plot
 * @param {Number} currentDr active declaration rate (vertical dotted line)
 * @param {Object|null} extraMarker optional {value, label, color} second vertical line
 * @param {Array} lostMarkers [{dr, profiles:[{id,label}]}] — dots on the DR axis marking
 *   where each profile drops out, matching when it greys out in the APC tree
 * @param {Number} height chart height in px
 */
const LOST_SERIES = "Profile lost"

export default function MdrCurvesChart({ metricsByDr, visibleMetrics, currentDr, extraMarker = null, lostMarkers = [], height = 300 }) {
  const option = useMemo(() => {
    const series = (visibleMetrics || []).map((metric, i) => ({
      name: metric,
      type: "line",
      showSymbol: false,
      data: getCurve(metricsByDr, metric),
      lineStyle: { width: 2, color: curveColor(metric, i) },
      itemStyle: { color: curveColor(metric, i) }
    }))

    const markLines = [
      {
        xAxis: currentDr,
        lineStyle: { color: "#185FA5", type: "dotted", width: 2 },
        label: { formatter: `DR ${Math.round(currentDr)}%`, color: "#185FA5", fontSize: 10 }
      }
    ]
    if (extraMarker) {
      markLines.push({
        xAxis: extraMarker.value,
        lineStyle: { color: extraMarker.color || "#8E5BB5", type: "solid", width: 2 },
        label: { formatter: extraMarker.label || "", color: extraMarker.color || "#8E5BB5", fontSize: 10 }
      })
    }
    if (series.length > 0) {
      series[0].markLine = { symbol: "none", silent: true, data: markLines }
    }

    // Dots along the DR axis, one per declaration rate where at least one profile
    // drops out. Plotted against a hidden 0-1 axis so they sit just above the axis
    // line regardless of what range the metric axis happens to have.
    if (lostMarkers.length > 0) {
      series.push({
        name: LOST_SERIES,
        type: "scatter",
        yAxisIndex: 1,
        symbolSize: 9,
        z: 5,
        data: lostMarkers.map((m) => [m.dr, 0.02]),
        itemStyle: { color: "#B5651D", borderColor: "#fff", borderWidth: 1 },
        emphasis: { scale: 1.6 }
      })
    }

    return {
      animation: false,
      grid: { left: 45, right: 20, top: 30, bottom: 38 },
      tooltip: {
        trigger: "axis",
        // Hovering anywhere in a DR column lists that column's metrics, and — when
        // profiles drop out there — which ones, so the dot explains itself.
        formatter: (params) => {
          const rows = Array.isArray(params) ? params : [params]
          if (rows.length === 0) return ""
          const dr = rows[0].axisValue
          const lines = [`Declaration rate: <b>${dr}%</b>`]
          rows.forEach((row) => {
            if (row.seriesName === LOST_SERIES) return
            const v = Array.isArray(row.value) ? row.value[1] : row.value
            lines.push(`${row.marker} ${row.seriesName}: ${typeof v === "number" ? v.toFixed(3) : v}`)
          })
          const hit = lostMarkers.find((m) => m.dr === dr)
          if (hit) {
            lines.push(`<b>Profile${hit.profiles.length > 1 ? "s" : ""} lost here:</b>`)
            hit.profiles.forEach((p) => lines.push(`&nbsp;&nbsp;#${p.id} · ${p.label}`))
          }
          return lines.join("<br/>")
        }
      },
      legend: { top: 0, left: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 10, color: "#495057" } },
      xAxis: {
        type: "value",
        min: 0,
        max: 100,
        name: "Declaration rate (%)",
        nameLocation: "middle",
        nameGap: 22,
        nameTextStyle: { fontSize: 10, color: "#6C757D" },
        axisLabel: { formatter: "{value}%", fontSize: 9, color: "#888780" },
        splitLine: { lineStyle: { color: "#E9ECEF" } }
      },
      yAxis: [
        {
          type: "value",
          min: (v) => Math.max(0, Math.floor(v.min * 10) / 10 - 0.1),
          max: 1,
          axisLabel: { fontSize: 9, color: "#888780" },
          splitLine: { lineStyle: { color: "#E9ECEF" } }
        },
        // Invisible 0-1 axis that anchors the drop-out dots to the bottom of the
        // plot; the metric axis rescales to the data, so it cannot be used for this.
        { type: "value", min: 0, max: 1, show: false }
      ],
      series: series
    }
  }, [metricsByDr, visibleMetrics, currentDr, extraMarker, lostMarkers])

  return <ReactECharts option={option} style={{ height: height, width: "100%" }} notMerge={true} />
}
