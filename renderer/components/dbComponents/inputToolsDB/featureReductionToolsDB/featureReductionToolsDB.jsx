import React, { useContext } from "react"
import { TabPanel, TabView } from "primereact/tabview"
import SpearmanDB from "./spearmanDB"
import CreatePCADB from "./createPcaDB"
import ApplyPCADB from "./ApplyPcaDB"
import { Message } from "primereact/message"
import { DataContext } from "../../../workspace/dataContext"

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
