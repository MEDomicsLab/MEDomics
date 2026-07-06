import React, { useState } from "react"
import ModulePage from "./moduleBasics/modulePage"

import Med3paConfigForm from "../med3pa/upload_data_page"
import OverviewPage from "../med3pa/overviewPage"
import AnalysisPage from "../med3pa/analysisPage"
import DeploymentPage from "../med3pa/deploymentPage"
import LookupPage from "../med3pa/lookupPage"
import PatientDetailPage from "../med3pa/patientDetailPage"
import HistoryPage from "../med3pa/historyPage"

const NAV_ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "configuration", label: "Configuration" },
  { key: "analysis", label: "Analysis Workspace" },
  { key: "deployment", label: "Deployment" },
  { key: "lookup", label: "Patient Lookup" },
  { key: "history", label: "Session History" }
]

/**
 * @description MED3pa module page: one MEDomicsLab tab containing its own internal
 * navigation (mirroring the tkinter mockup) — Overview, Configuration, Analysis
 * Workspace, Deployment, Patient Lookup (+ detail) and Session History.
 */
const MED3paPage = ({ pageId, initialPage = "overview" }) => {
  const [activePage, setActivePage] = useState(initialPage)
  const [sessionName, setSessionName] = useState(null) // session opened in the Analysis Workspace
  const [patient, setPatient] = useState(null) // patient opened in the detail dashboard
  const [refreshKey, setRefreshKey] = useState(0) // bumped on navigation so pages reload their DB lists

  const goToPage = (key) => {
    setActivePage(key)
    setRefreshKey((k) => k + 1)
  }

  const renderPage = () => {
    switch (activePage) {
      case "overview":
        return <OverviewPage refreshKey={refreshKey} />
      case "configuration":
        return (
          <Med3paConfigForm
            onAnalysisComplete={(name) => {
              setSessionName(name)
              goToPage("analysis")
            }}
            onNextStep={() => goToPage("analysis")}
          />
        )
      case "analysis":
        return <AnalysisPage goToPage={goToPage} initialSessionName={sessionName} refreshKey={refreshKey} />
      case "deployment":
        return <DeploymentPage goToPage={goToPage} refreshKey={refreshKey} />
      case "lookup":
        return (
          <LookupPage
            refreshKey={refreshKey}
            openPatient={(p) => {
              setPatient(p)
              goToPage("patientDetail")
            }}
          />
        )
      case "patientDetail":
        return <PatientDetailPage patient={patient} goBack={() => goToPage("lookup")} />
      case "history":
        return (
          <HistoryPage
            refreshKey={refreshKey}
            openSession={(name) => {
              setSessionName(name)
              goToPage("analysis")
            }}
          />
        )
      default:
        return <OverviewPage refreshKey={refreshKey} />
    }
  }

  const navKey = activePage === "patientDetail" ? "lookup" : activePage

  return (
    <ModulePage pageId={pageId} shadow={true}>
      <div style={{ display: "flex", minHeight: "100%", fontFamily: "sans-serif" }}>
        {/* Internal sidebar */}
        <div style={{ width: 190, flexShrink: 0, background: "#F8F9FA", borderRight: "1px solid #E9ECEF", padding: "16px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px", marginBottom: 18 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#185FA5" }}>MED3pa</span>
            <span style={{ background: "#185FA5", color: "#E6F1FB", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 8px" }}>v1</span>
          </div>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.key}
              onClick={() => goToPage(item.key)}
              style={{
                padding: "7px 10px",
                marginBottom: 2,
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
                background: navKey === item.key ? "#FFFFFF" : "transparent",
                color: navKey === item.key ? "#185FA5" : "#495057",
                fontWeight: navKey === item.key ? 600 : 400,
                boxShadow: navKey === item.key ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
        {/* Active page */}
        <div style={{ flexGrow: 1, minWidth: 0 }}>{renderPage()}</div>
      </div>
    </ModulePage>
  )
}

export default MED3paPage
