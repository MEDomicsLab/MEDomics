import React, { useMemo } from "react"
import { layoutTree, metricColor, textColorOn } from "./med3paResultsUtils"

const VIEW_W = 1000
const VIEW_H = 620

/**
 * @description Get the value of a metric for a profile, looking first in the metrics
 * dict then in the node information dict (mean confidence, population %, ...)
 */
export function profileValue(profile, metric) {
  if (!profile) return null
  const fromMetrics = profile.metrics?.[metric]
  if (fromMetrics !== undefined && fromMetrics !== null) return fromMetrics
  const info = profile["node information"] || {}
  const fromInfo = info[metric]
  return fromInfo === undefined ? null : fromInfo
}

/**
 * @description SVG rendering of the APC hierarchical decision tree (mockup's tree panel).
 * Nodes are colored by a chosen metric, fade out when their profile is lost at the
 * current DR, and can be clicked for details. A profile path can be highlighted
 * (Patient Detail page).
 *
 * @param {Object} tree session.tree (nested c_left/c_right dict)
 * @param {Object} profilesMap node_id -> profile dict at the current samples ratio / DR
 * @param {Set} lostIds node ids whose profile is lost at the current DR
 * @param {String} colorMetric metric used for the node fill color
 * @param {String} colorScheme "confidence" (red-green) or "performance" (blues)
 * @param {Array} displayMetrics metric names printed inside the nodes
 * @param {Set|null} highlightIds node ids on a highlighted path (patient profile)
 * @param {Function} onNodeClick callback(nodeLayout, profile)
 * @param {Number} height rendered height in px
 */
export default function ApcTreeChart({
  tree,
  profilesMap = {},
  lostIds = new Set(),
  colorMetric = "mean_confidence_level",
  colorScheme = "confidence",
  displayMetrics = [],
  highlightIds = null,
  onNodeClick = null,
  height = 340
}) {
  const { nodes, edges } = useMemo(() => layoutTree(tree), [tree])

  if (!tree) {
    return (
      <div style={{ height: height, display: "flex", alignItems: "center", justifyContent: "center", color: "#6C757D", fontSize: 12 }}>
        No profile tree available for this session.
      </div>
    )
  }

  const boxW = 170
  const sx = (x) => (x / 100) * VIEW_W
  const sy = (y) => (y / 100) * VIEW_H

  return (
    <div style={{ width: "100%", overflow: "auto" }}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ width: "100%", height: height, minWidth: 500 }}>
        {edges.map((e, i) => {
          const highlighted = highlightIds && highlightIds.has(e.childId)
          return (
            <line
              key={i}
              x1={sx(e.x1)}
              y1={sy(e.y1) + 20}
              x2={sx(e.x2)}
              y2={sy(e.y2) - 20}
              stroke={highlighted ? "#185FA5" : "#ADB5BD"}
              strokeWidth={highlighted ? 3 : 1.5}
              markerEnd=""
            />
          )
        })}
        {nodes.map((node) => {
          const profile = profilesMap[node.id]
          const lost = lostIds.has(node.id)
          const value = profileValue(profile, colorMetric)
          const fill = lost ? "#F2F4F4" : value !== null ? metricColor(value, colorScheme) : "#F8F9FA"
          const txtColor = lost ? "#ADB5BD" : value !== null ? textColorOn(fill) : "#212529"
          const onPath = highlightIds && highlightIds.has(node.id)

          const lines = [node.rule]
          displayMetrics.forEach((m) => {
            const v = profileValue(profile, m)
            if (v !== null && v !== undefined) lines.push(`${m}: ${typeof v === "number" ? v.toFixed(2) : v}`)
          })
          if (lost) lines.push("(lost at this DR)")

          const boxH = 22 + lines.length * 15
          const x = sx(node.x) - boxW / 2
          const y = sy(node.y) - boxH / 2

          return (
            <g
              key={node.id}
              opacity={lost ? 0.45 : 1}
              style={{ cursor: onNodeClick ? "pointer" : "default" }}
              onClick={() => onNodeClick && onNodeClick(node, profile)}
            >
              <rect
                x={x}
                y={y}
                width={boxW}
                height={boxH}
                rx={8}
                fill={fill}
                stroke={onPath ? "#185FA5" : lost ? "#CED4DA" : "#6C757D"}
                strokeWidth={onPath ? 3.5 : 1.2}
              />
              <text x={sx(node.x)} y={y + 16} textAnchor="middle" fontSize={12} fontWeight="bold" fill={txtColor}>
                {node.id === 1 || node.rule === "All population" ? "All population" : `Node ${[node.rule]}`}
              </text>
              {lines.slice(1).map((line, li) => (
                <text key={li} x={sx(node.x)} y={y + 31 + li * 15} textAnchor="middle" fontSize={10.5} fill={txtColor}>
                  {line.length > 30 ? line.slice(0, 29) + "…" : line}
                </text>
              ))}
            </g>
          )
        })}
        {/* color legend */}
        <defs>
          <linearGradient id="med3pa-tree-legend" x1="0" x2="1" y1="0" y2="0">
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <stop key={v} offset={`${v * 100}%`} stopColor={metricColor(v, colorScheme)} />
            ))}
          </linearGradient>
        </defs>
        <rect x={VIEW_W - 220} y={VIEW_H - 26} width={160} height={10} fill="url(#med3pa-tree-legend)" rx={3} />
        <text x={VIEW_W - 226} y={VIEW_H - 17} textAnchor="end" fontSize={10} fill="#6C757D">
          {colorMetric}
        </text>
        <text x={VIEW_W - 220} y={VIEW_H - 2} fontSize={9} fill="#6C757D">
          0
        </text>
        <text x={VIEW_W - 60} y={VIEW_H - 2} textAnchor="end" fontSize={9} fill="#6C757D">
          1
        </text>
      </svg>
    </div>
  )
}
