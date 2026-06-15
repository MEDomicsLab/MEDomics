import Image from "next/image"
import { Button } from "primereact/button"
import { Card } from "primereact/card"
import { Dropdown } from "primereact/dropdown"
import { useContext, useEffect, useState } from "react"
import { Stack } from "react-bootstrap"
import myimage from "../../../resources/medomics_transparent_bg.png"
import MEDprofilesPrepareData from "../input/MEDprofiles/MEDprofilesPrepareData"
import { getCollectionSize } from "../mongoDB/mongoDBUtils"
import { DataContext } from "../workspace/dataContext"
import BasicToolsDB from "./inputToolsDB/basicToolsDB"
import ConvertCategoricalColumnIntoNumericDB from "./inputToolsDB/convertCategoricalColumnIntoNumericDB"
import DropColumnsAndTagsToolsDB from "./inputToolsDB/dropColumnsToolsDB"
import DropDuplicatesToolsDB from "./inputToolsDB/dropDuplicatesToolsDB"
import FeatureReductionToolsDB from "./inputToolsDB/featureReductionToolsDB/featureReductionToolsDB"
import GroupingTaggingToolsDB from "./inputToolsDB/groupingTaggingToolsDB"
import HoldoutSetCreationToolsDB from "./inputToolsDB/holdoutSetCreationToolsDB"
import MergeToolsDB from "./inputToolsDB/mergeToolsDB"
import NormalizationToolsDB from "./inputToolsDB/normalizationToolsDB"
import SimpleCleaningToolsDB from "./inputToolsDB/simpleCleaningToolsDB"
import SubsetCreationToolsDB from "./inputToolsDB/subsetCreationToolsDB"
import TransformColumnToolsDB from "./inputToolsDB/transformColumnToolsDB"

const SectionContainer = ({ title, children }) => (
  <div className="mb-3">
    <h6
      style={{
        padding: "0.6rem 0.8rem",
        borderBottom: "1px solid #ddd",
        fontWeight: 600,
        borderRadius: "6px 6px 0 0",
      }}
    >
      {title}
    </h6>
    <Stack direction="vertical" gap={1} style={{ marginTop: "0.5rem" }}>
      {children}
    </Stack>
  </div>
)

const InputToolsComponent = ({ exportOptions }) => {
  const { globalData } = useContext(DataContext)
  const [collectionId, setCollectionId] = useState(null)
  const [collectionSize, setCollectionSize] = useState(0)
  const [activeSection, setActiveSection] = useState(null)
  const [activeTool, setActiveTool] = useState(null)

  const selectedCSVFiles = Object.values(globalData).filter((item) => item.type === "csv")

  useEffect(() => {
    if (collectionId) {
      const fetchCollectionSize = async () => {
        const size = await getCollectionSize(collectionId)
        setCollectionSize(size)
      }
      fetchCollectionSize()
    }
  }, [collectionId])

  const SECTIONS = {
    organization: {
      label: "Data Organization",
      subsections: [
        {
          key: "import",
          label: "Import & Merge",
          tools: [
            { label: "Basic Tools", component: BasicToolsDB, description: "Load and inspect datasets before preprocessing." },
            { label: "Merge Tools", component: MergeToolsDB, description: "Combine multiple datasets into one unified table." },
          ],
        },
        {
          key: "structuring",
          label: "Structuring & Tagging",
          tools: [
            { label: "Column Tagging Tools", component: GroupingTaggingToolsDB, description: "Tag columns by type or meaning for downstream analysis." },
            { label: "Row Tagging / Subset Creation", component: SubsetCreationToolsDB, description: "Label or filter specific samples for sub-analysis." },
          ],
        },
      ],
    },
    wrangling: {
      label: "Data Wrangling",
      subsections: [
        {
          key: "cleaning",
          label: "Cleaning & Deletion",
          tools: [
            { label: "Simple Cleaning", component: SimpleCleaningToolsDB, description: "Clean missing values and outliers efficiently." },
            { label: "Drop Duplicates", component: DropDuplicatesToolsDB, description: "Identify and remove duplicate rows." },
            { label: "Drop Columns / Tags", component: DropColumnsAndTagsToolsDB, description: "Remove irrelevant columns or tagged features." },
          ],
        },
        {
          key: "transform",
          label: "Transformation & Encoding",
          tools: [
            { label: "Transform Columns", component: TransformColumnToolsDB, description: "Apply transformations to numerical or categorical features." },
            { label: "Convert Categorical into Numeric", component: ConvertCategoricalColumnIntoNumericDB, description: "Encode categorical variables for ML compatibility." },
            { label: "Normalization Tools", component: NormalizationToolsDB, description: "Normalize or scale features for consistent model behavior." },
          ],
        },
        {
          key: "sampling",
          label: "Sampling",
          tools: [
            { label: "Holdout Set Creation Tools", component: HoldoutSetCreationToolsDB, description: "Split datasets into learning and holdout subsets." },
          ],
        },
      ],
    },
    misc: {
      label: "Data Insights",
      subsections: [
        {
          key: "reduction",
          label: "Feature Reduction",
          tools: [
            { label: "Feature Reduction Tools", component: FeatureReductionToolsDB, description: "Reduce dimensionality or select key predictors." },
          ],
        },
        {
          key: "medprofiles",
          label: "MEDprofiles",
          tools: [
            { label: "MEDprofiles", component: MEDprofilesPrepareData, description: "Prepare datasets following MEDomics profiles for standardized structure and compatibility across modules." },
          ],
        },
      ],
    },
  }

  const renderActiveTool = () => {
    if (!activeTool) return null
    const ToolComponent = activeTool.component
    return (
      <div style={{ marginTop: "20px" }}>
        <Button label="← Back to tools" className="p-button-text mb-3" onClick={() => setActiveTool(null)} />
        <h3>{activeTool.label}</h3>
        <ToolComponent exportOptions={exportOptions} currentCollection={collectionId} collectionSize={collectionSize} />
      </div>
    )
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Sidebar */}
      <aside style={{ width: "280px", borderRight: "1px solid #ddd", padding: "1rem", overflowY: "auto" }}>
        <h5 style={{ 
          textAlign: "center", 
          marginBottom: "1rem",
          padding: "0.6rem 0.8rem",
          borderBottom: "1px solid #ddd",
          fontWeight: 600,
          borderRadius: "6px 6px 0 0",
        }} >Input Sections</h5>

        {Object.entries(SECTIONS).map(([key, section]) => (
          <SectionContainer key={key} title={section.label}>
            {section.subsections.map((sub) => (
              <div
                key={sub.key}
                onClick={() => {
                  setActiveSection(sub.key)
                  setActiveTool(null)
                }}
                style={{
                  cursor: "pointer",
                  padding: "8px 10px",
                  marginBottom: "6px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  ...(activeSection === sub.key ? { backgroundColor: "#569fff" } : {}),
                  border: "1px solid #ddd",
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <span>{sub.label}</span>
                <i className="pi pi-angle-right" style={{ fontSize: "1.1rem", color: "#a3a3a3" }}></i>
              </div>
            ))}
          </SectionContainer>
        ))}
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>
  <div style={{ textAlign: "center", marginBottom: "20px" }}>
    <h1 className="text-center fw-bold text-secondary mt-2" style={{ fontSize: "3rem", letterSpacing: "1px" }}>
      Input Module
    </h1>
    <div className="mx-auto text-center mb-4" >
      <Image className="text-center" src={myimage} alt="" style={{ height: "30px", width: "30px" }} />
    </div>
    <Card title="Select CSV File" style={{ marginBottom: "20px" }}>
      <Dropdown
        filter
        style={{ maxWidth: "300px" }}
        value={selectedCSVFiles.find((item) => item.id === collectionId)}
        onChange={(e) => setCollectionId(e.value.id)}
        options={selectedCSVFiles}
        optionLabel="name"
        placeholder="Select CSV file"
        className="w-full md:w-14rem"
      />
    </Card>
  </div>

  {!collectionId ? (
    <p style={{ textAlign: "center" }}>Please select a dataset to continue.</p>
  ) : (
    <>
      {/* only showcase the active tool */}
      {activeTool ? (
        renderActiveTool()
      ) : (
        Object.values(SECTIONS)
          .flatMap((s) => s.subsections)
          .filter((sub) => sub.key === activeSection)
          .map((sub) => (
            <div key={sub.key}>
              <h3>{sub.label}</h3>
              <p style={{ color: "#a3a3a3", marginBottom: "1.5rem" }}>
                {sub.description || "Explore and apply tools for this data preparation stage."}
              </p>

              <div className="grid grid-cols-2 gap-4">
                {sub.tools.map((tool, i) => (
                  <div
                    key={i}
                    onClick={() => setActiveTool(tool)}
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      padding: "0.8rem 1rem",
                      cursor: "pointer",
                      transition: "all 0.2s ease-in-out",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#569fff"
                      e.currentTarget.style.transform = "scale(1.01)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent"
                      e.currentTarget.style.transform = "scale(1)"
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, fontSize: "1rem" }}>{tool.label}</h4>
                      <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.9rem", color: "#a3a3a3" }}>
                        {tool.description}
                      </p>
                    </div>
                    <i className="pi pi-angle-right" style={{ fontSize: "1.4rem", color: "#4338ca" }}></i>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </>
  )}
</main>

    </div>
  )
}

export default InputToolsComponent
