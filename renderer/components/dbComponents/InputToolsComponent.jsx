import { useContext, useEffect, useState } from "react"
import { Card } from "primereact/card"
import { Dropdown } from "primereact/dropdown"
import { Button } from "primereact/button"
import { Stack } from "react-bootstrap"
import { DataContext } from "../workspace/dataContext"

// import tools
import BasicToolsDB from "./inputToolsDB/basicToolsDB"
import DropDuplicatesToolsDB from "./inputToolsDB/dropDuplicatesToolsDB"
import FeatureReductionToolsDB from "./inputToolsDB/featureReductionToolsDB/featureReductionToolsDB"
import ConvertCategoricalColumnIntoNumericDB from "./inputToolsDB/convertCategoricalColumnIntoNumericDB"
import GroupingTaggingToolsDB from "./inputToolsDB/groupingTaggingToolsDB"
import HoldoutSetCreationToolsDB from "./inputToolsDB/holdoutSetCreationToolsDB"
import MergeToolsDB from "./inputToolsDB/mergeToolsDB"
import DropColumnsAndTagsToolsDB from "./inputToolsDB/dropColumnsToolsDB"
import NormalizationToolsDB from "./inputToolsDB/normalizationToolsDB"
import SimpleCleaningToolsDB from "./inputToolsDB/simpleCleaningToolsDB"
import SubsetCreationToolsDB from "./inputToolsDB/subsetCreationToolsDB"
import TransformColumnToolsDB from "./inputToolsDB/transformColumnToolsDB"
import MEDprofilesPrepareData from "../input/MEDprofiles/MEDprofilesPrepareData"
import { getCollectionSize } from "../mongoDB/mongoDBUtils"

const SectionContainer = ({ title, children }) => (
  <div className="mb-3">
    <h6
      style={{
        backgroundColor: "#f0f0f0",
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
      <aside style={{ width: "280px", backgroundColor: "#f8f9fa", borderRight: "1px solid #ddd", padding: "1rem", overflowY: "auto" }}>
        <h3 style={{ textAlign: "center", marginBottom: "1rem" }}>Input Sections</h3>

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
                  backgroundColor: activeSection === sub.key ? "#e0e7ff" : "white",
                  border: "1px solid #ddd",
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <span>{sub.label}</span>
                <i className="pi pi-angle-right" style={{ fontSize: "1.1rem", color: "#555" }}></i>
              </div>
            ))}
          </SectionContainer>
        ))}
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>
  <div style={{ textAlign: "center", marginBottom: "20px" }}>
    <h2>Database Input Module</h2>
    <Card title="Select CSV File" style={{ backgroundColor: "#f0f0f0", marginBottom: "20px" }}>
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
      {/* 🔥 Si on a un outil actif : NE FAIRE AFFICHER QUE LUI */}
      {activeTool ? (
        renderActiveTool()
      ) : (
        /* 🔥 Sinon : affichage normal de la liste des outils */
        Object.values(SECTIONS)
          .flatMap((s) => s.subsections)
          .filter((sub) => sub.key === activeSection)
          .map((sub) => (
            <div key={sub.key}>
              <h3>{sub.label}</h3>
              <p style={{ color: "#555", marginBottom: "1.5rem" }}>
                {sub.description || "Explore and apply tools for this data preparation stage."}
              </p>

              <div className="grid grid-cols-2 gap-4">
                {sub.tools.map((tool, i) => (
                  <div
                    key={i}
                    onClick={() => setActiveTool(tool)}
                    style={{
                      backgroundColor: "#f4f5f7",
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
                      e.currentTarget.style.backgroundColor = "#e0e7ff"
                      e.currentTarget.style.transform = "scale(1.01)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#f4f5f7"
                      e.currentTarget.style.transform = "scale(1)"
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, fontSize: "1rem" }}>{tool.label}</h4>
                      <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.9rem", color: "#555" }}>
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
