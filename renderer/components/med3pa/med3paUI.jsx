import React, { useState } from "react"

/**
 * Small shared presentational pieces for the MED3pa pages, matching the
 * inline-styled look of upload_data_page.jsx (mockup colors).
 */

export function PageHeader({ title, subtitle, right = null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6C757D" }}>{subtitle}</div>
      </div>
      {right}
    </div>
  )
}

export function StepBar({ activeStep }) {
  const steps = [
    { n: "1", name: "Configuration" },
    { n: "2", name: "Analysis" },
    { n: "3", name: "Deploy" }
  ]
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
      {steps.map((step, i) => {
        const state = i < activeStep ? "done" : i === activeStep ? "active" : "todo"
        const bg = state === "done" ? "#0F6E56" : state === "active" ? "#185FA5" : "#E9ECEF"
        return (
          <span key={step.n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: bg,
                color: state === "todo" ? "#6C757D" : "#fff",
                fontSize: 11,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {state === "done" ? "✓" : step.n}
            </span>
            <span style={{ fontSize: 12, fontWeight: state === "active" ? 500 : 400, color: state === "active" ? "#212529" : "#6C757D" }}>{step.name}</span>
            {i < steps.length - 1 && <span style={{ display: "inline-block", width: 32, height: 1, background: "#E9ECEF", marginLeft: 4 }} />}
          </span>
        )
      })}
    </div>
  )
}

export function Card({ title, subtitle, children, style = {} }) {
  return (
    <div style={{ border: "1px solid #E9ECEF", borderRadius: 8, padding: "12px 16px", background: "#fff", ...style }}>
      {title && <div style={{ fontSize: 13, fontWeight: 500, color: "#185FA5", marginBottom: subtitle ? 2 : 10 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 11, color: "#6C757D", marginBottom: 10 }}>{subtitle}</div>}
      {children}
    </div>
  )
}

export function Kpi({ title, value, sub, subColor = "#6C757D", children }) {
  return (
    <div style={{ border: "1px solid #E9ECEF", borderRadius: 8, padding: "10px 12px", background: "#fff", minHeight: 90 }}>
      <div style={{ fontSize: 12, color: "#6C757D", marginBottom: 2 }}>{title}</div>
      {children}
      <div style={{ fontSize: 24, fontWeight: 600, color: "#212529" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subColor, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function Badge({ text, bg, color }) {
  return (
    <span style={{ background: bg, color: color, borderRadius: 10, padding: "3px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{text}</span>
  )
}

export function Collapsible({ title, subtitle, accentColor = "#185FA5", defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: "#F8F9FA", border: "1px solid #E9ECEF", borderRadius: 6, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s", fontSize: 11, color: "#6C757D" }}>▶</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: accentColor }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: "#6C757D" }}>{subtitle}</div>}
        </div>
      </div>
      {open && <div style={{ padding: "0 10px 10px 28px" }}>{children}</div>}
    </div>
  )
}

export function MetricBar({ label, desc, value, color }) {
  const v = Math.max(0, Math.min(1, value ?? 0))
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span>
          <b>{label}</b> {desc && <span style={{ color: "#6C757D", fontSize: 11 }}>{desc}</span>}
        </span>
        <b style={{ color: color }}>{(value ?? 0).toFixed(2)}</b>
      </div>
      <div style={{ background: "#E9ECEF", borderRadius: 5, height: 9, marginTop: 3 }}>
        <div style={{ background: color, borderRadius: 5, height: 9, width: `${v * 100}%` }} />
      </div>
    </div>
  )
}

export const PRIMARY_BTN = {
  padding: "8px 18px",
  background: "#185FA5",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500
}

export const SUCCESS_BTN = { ...PRIMARY_BTN, background: "#0F6E56" }
export const GHOST_BTN = { ...PRIMARY_BTN, background: "transparent", color: "#185FA5", border: "1px solid #185FA5" }
