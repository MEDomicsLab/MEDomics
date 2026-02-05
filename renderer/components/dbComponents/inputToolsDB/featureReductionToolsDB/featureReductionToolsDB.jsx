import React, { useContext } from "react"
import { TabPanel, TabView } from "primereact/tabview"
import SpearmanDB from "./spearmanDB"
import CreatePCADB from "./createPcaDB"
import ApplyPCADB from "./ApplyPcaDB"
import { Message } from "primereact/message"
import { DataContext } from "../../../workspace/dataContext"
import { Tooltip } from 'primereact/tooltip'

const FeatureReductionToolsDB = ({ currentCollection }) => {
  const { globalData } = useContext(DataContext)
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "5px"
      }}
    >
       <Tooltip
      target=".experimental-tag"
      content="This tool is experimental and mostly intended for visual exploration. Prefer using the Learning Module for validated pipelines."
    />

    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-5px" }}>
      <div
        className="experimental-tag"
        style={{
          background: "#fff3cd",              
          padding: "3px 10px",
          borderRadius: "12px",
          border: "1px solid #ffeeba",        
          fontSize: "0.75rem",
          color: "#856404",                  
          display: "inline-flex",
          alignItems: "center",
          gap: "6px"
        }}
      >
        <i className="pi pi-info-circle" style={{ fontSize: "0.85rem" }}></i>
        Recommended in Learning Module
      </div>
    </div>
      <Message style={{ marginBottom: "15px" }} severity="success" text={`Current Collection: ${globalData[currentCollection].name}`} />
      <TabView>
        <TabPanel header="PCA">
          <TabView>
            <TabPanel header="Create PCA">
              <CreatePCADB currentCollection={currentCollection} />
            </TabPanel>
            <TabPanel header="Apply PCA">
              <ApplyPCADB currentCollection={currentCollection} />
            </TabPanel>
          </TabView>
        </TabPanel>
        <TabPanel header="Spearman">
          <SpearmanDB currentCollection={currentCollection} />
        </TabPanel>
      </TabView>
    </div>
  )
}

export default FeatureReductionToolsDB
