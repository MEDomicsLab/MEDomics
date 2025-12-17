import { Card } from 'primereact/card'
import { Divider } from 'primereact/divider'
import { Tag } from 'primereact/tag'
import React, { useContext, useEffect, useState } from "react"
import { getCollectionData } from "../dbComponents/utils"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import { DataContext } from "../workspace/dataContext"
import ModulePage from "./moduleBasics/modulePage"

/**
 *
 * @returns a page that shows the model informations
 */
const ModelViewer = ({ id }) => {
  const [data, setData] = useState(null)
  const { globalData } = useContext(DataContext)

  useEffect(() => {
    const getData = async () => {
      let metadataFileID = MEDDataObject.getChildIDWithName(globalData, id, "metadata.json")
      let localData = await getCollectionData(metadataFileID)
      setData(localData[0])
    }
    getData()
  }, [id])

  // Template for the card section
  const renderCardSection = (title, content, icon) => (
    <Card style={{ width: '100%', marginBottom: '20px' }}>
      <div className="p-card-header" style={{ display: 'flex', alignItems: 'center' }}>
        <Tag icon={icon} severity="info" style={{ marginRight: '10px' }}></Tag>
        <h3>{title}</h3>
      </div>
      <Divider style={{ margin: '5px 0' }} />
      <div style={{ marginTop: '5px' }}>
        {content}
      </div>
    </Card>
  );

  return (
    <>
      {data && (
        <>
          <h1>Model Information: {<strong>{id && globalData[id].name}</strong>}</h1>
          
          {/* Required Columns Section */}
          {renderCardSection(
            "Required Columns",
            <ul>
              {data.columns.map((col, i) => (
                <li key={i}>{col}</li>
              ))}
            </ul>,
            "pi pi-database"
          )}

          {/* Model Target Section */}
          {renderCardSection(
            "Model Target",
            <p>{data.target}</p>,
            "pi pi-bullseye"
          )}

          {/* Preprocessing Steps Section */}
          {data.steps && renderCardSection(
            "Preprocess Steps",
            <ol>
              {data.steps?.map((step, i) => (
                <li key={i}>{step.type}</li>
              ))}
            </ol>,
            "pi pi-cog"
          )}

          {/* Machine Learning Type Section */}
          {renderCardSection(
            "Machine Learning Type",
            <p>{data.ml_type}</p>,
            "pi pi-circle"
          )}
        </>
      )}
    </>
  )
}

/**
 * @param {String} pageId Id of the page for multi-tabs support
 *
 * @description This component is the base for all the flow pages. It contains the sidebar, the workflow and the backdrop.
 */
const ModelViewerWithContext = ({ pageId }) => {
  return (
    <>
      <ModulePage pageId={pageId} shadow>
        <ModelViewer id={pageId} />
      </ModulePage>
    </>
  )
}

export default ModelViewerWithContext
