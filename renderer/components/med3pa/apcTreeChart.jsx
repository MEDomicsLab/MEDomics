import React, { useMemo, useRef, useState } from "react"
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
 * @param {Boolean} pannable enable drag-to-pan and (ctrl/⌘ + wheel) zoom
 */
export default function ApcTreeChart({
  tree,
  profilesMap = {},
  lostIds = new Set(),
  colorMetric = "Mean confidence level",
  colorScheme = "confidence",
  displayMetrics = [],
  highlightIds = null,
  onNodeClick = null,
  height = 340,
  pannable = true
}) {
  const { nodes, edges } = useMemo(() => layoutTree(tree), [tree])

  // Pan / zoom state applied as a transform on the content group.
  const svgRef = useRef(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const dragRef = useRef(null) // { startX, startY, origX, origY, moved }

  // Convert a client-space point to viewBox coordinates.
  const toView = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW_W,
      y: ((clientY - rect.top) / rect.height) * VIEW_H
    }
  }

  const onMouseDown = (e) => {
    if (!pannable || e.button !== 0) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y, moved: false }
  }

  const onMouseMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const rect = svgRef.current.getBoundingClientRect()
    const dx = ((e.clientX - d.startX) / rect.width) * VIEW_W
    const dy = ((e.clientY - d.startY) / rect.height) * VIEW_H
    if (Math.abs(e.clientX - d.startX) > 3 || Math.abs(e.clientY - d.startY) > 3) d.moved = true
    setView((v) => ({ ...v, x: d.origX + dx, y: d.origY + dy }))
  }

  const endDrag = () => {
    dragRef.current = null
  }

  // Zoom around the cursor with ctrl/⌘ + wheel (plain wheel keeps page scroll).
  const onWheel = (e) => {
    if (!pannable || !(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const p = toView(e.clientX, e.clientY)
    setView((v) => {
      const k = Math.min(6, Math.max(0.3, v.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
      const ratio = k / v.k
      return { k, x: p.x - (p.x - v.x) * ratio, y: p.y - (p.y - v.y) * ratio }
    })
  }

  // Node clicks are suppressed if the pointer was dragged (pan gesture).
  const handleNodeClick = (node, profile) => {
    if (dragRef.current?.moved) return
    onNodeClick && onNodeClick(node, profile)
  }

  const resetView = () => setView({ x: 0, y: 0, k: 1 })

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
    <div style={{ width: "100%", overflow: "hidden", position: "relative" }}>
      {pannable && (view.k !== 1 || view.x !== 0 || view.y !== 0) && (
        <button
          onClick={resetView}
          title="Reset view"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 2,
            padding: "2px 8px",
            fontSize: 11,
            borderRadius: 4,
            border: "1px solid #CED4DA",
            background: "#FFFFFF",
            color: "#495057",
            cursor: "pointer"
          }}
        >
          Reset view
        </button>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{
          width: "100%",
          height: height,
          minWidth: 500,
          cursor: pannable ? (dragRef.current ? "grabbing" : "grab") : "default",
          touchAction: "none"
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onWheel={onWheel}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
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
          const colorValue = value === null ? null : colorScheme === "confidence" ? value / 100 : value
          const fill = lost ? "#F2F4F4" : colorValue !== null ? metricColor(colorValue, colorScheme) : "#F8F9FA"
          const txtColor = lost ? "#ADB5BD" : colorValue !== null ? textColorOn(fill) : "#212529"
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
              onClick={() => handleNodeClick(node, profile)}
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
        </g>
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
          {colorScheme === "confidence" ? 100 : 1}
        </text>
      </svg>
    </div>
  )
}
