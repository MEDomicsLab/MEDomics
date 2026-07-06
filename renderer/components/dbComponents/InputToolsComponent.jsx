import { Button } from "primereact/button"
import { Card } from "primereact/card"
import { Dropdown } from "primereact/dropdown"
import { useContext, useEffect, useState } from "react"
import { Stack } from "react-bootstrap"
import MEDprofilesPrepareData from "../input/MEDprofiles/MEDprofilesPrepareData"
import { getCollectionSize } from "../mongoDB/mongoDBUtils"
import { DataContext } from "../workspace/dataContext"
import ModuleLandingShell, { ModuleGuideText } from "../mainPages/moduleBasics/ModuleLandingShell"
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
    <h6 className="module-landing-input-section-title">{title}</h6>
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
      <div style={{ marginTop: "12px" }}>
        <Button label="← Back to tools" className="p-button-text mb-3" onClick={() => setActiveTool(null)} />
        <h3>{activeTool.label}</h3>
        <ToolComponent exportOptions={exportOptions} currentCollection={collectionId} collectionSize={collectionSize} />
      </div>
    )
  }

  return (
    <ModuleLandingShell
      title="Input Module"
      description="Preprocess and prepare tabular data for analysis and modeling."
      contentMaxWidth="1100px"
      alignTop
      infoContent={
        <ModuleGuideText>
          <p className="mb-0">
            This module consolidates all the tools necessary for preprocessing tabular data — from import and merge
            through cleaning, transformation, sampling, and feature reduction.
          </p>
        </ModuleGuideText>
      }
      documentation={{
        url: "https://medomicslab.gitbook.io/medomics-docs/tutorials/design/input-module",
        label: "Input Module documentation",
      }}
    >
      <div className="module-landing-input-layout">
        <aside className="module-landing-input-sidebar">
          <h5 className="module-landing-input-sidebar-title">Input Sections</h5>

          {Object.entries(SECTIONS).map(([key, section]) => (
            <SectionContainer key={key} title={section.label}>
              {section.subsections.map((sub) => (
                <div
                  key={sub.key}
                  onClick={() => {
                    setActiveSection(sub.key)
                    setActiveTool(null)
                  }}
                  className={`module-landing-input-nav-item ${activeSection === sub.key ? "is-active" : ""}`}
                >
                  <span>{sub.label}</span>
                  <i className="pi pi-angle-right" style={{ fontSize: "1rem", color: "#a3a3a3" }} />
                </div>
              ))}
            </SectionContainer>
          ))}
        </aside>

        <main className="module-landing-input-main">
          <Card title="Select CSV File" style={{ marginBottom: "16px" }}>
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

          {!collectionId ? (
            <p style={{ textAlign: "center", color: "var(--ml-text-muted)" }}>Please select a dataset to continue.</p>
          ) : (
            <>
              {activeTool ? (
                renderActiveTool()
              ) : (
                Object.values(SECTIONS)
                  .flatMap((s) => s.subsections)
                  .filter((sub) => sub.key === activeSection)
                  .map((sub) => (
                    <div key={sub.key}>
                      <h3>{sub.label}</h3>
                      <p style={{ color: "var(--ml-text-muted)", marginBottom: "1rem", fontSize: "0.86rem" }}>
                        {sub.description || "Explore and apply tools for this data preparation stage."}
                      </p>

                      <div className="module-landing-tool-grid">
                        {sub.tools.map((tool, i) => (
                          <div
                            key={i}
                            onClick={() => setActiveTool(tool)}
                            className="module-landing-input-tool-tile"
                          >
                            <div>
                              <h4>{tool.label}</h4>
                              <p>{tool.description}</p>
                            </div>
                            <i className="pi pi-angle-right" style={{ fontSize: "1.2rem", color: "var(--ml-accent)" }} />
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
    </ModuleLandingShell>
  )
}

export default InputToolsComponent
