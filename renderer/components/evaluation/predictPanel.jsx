import React, { useContext, useState } from "react"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"
import ProgressBarRequests from "../generalPurpose/progressBarRequests"
import DataTableFromDB from "../dbComponents/dataTableFromDB"

/**
 *
 * @param {Boolean} isUpdating Either the PredictPanel is updating or not
 * @param {Function} setIsUpdating Function to set the isUpdating state
 * @param {Object} data The data to display
 * @returns the PredictPanel of the evaluation page content
 */
const PredictPanel = ({ isUpdating, setIsUpdating, data }) => {
  const { pageId } = useContext(PageInfosContext) // we get the pageId to send to the server
  const [progressValue, setProgressValue] = useState(0) // we use this to store the progress value of the dashboard

  /**
   *
   * @param {Object} data Data received from the server on progress update
   */
  const onProgressDataReceived = (data) => {
    setProgressValue(data.now)
    if (data.now >= 100) {
      setIsUpdating(false)
    }
  }

  return (
    <div>
      <h1>Predictions: </h1>
      {!isUpdating && data ? (
        <>
          <div style={{ overflow: "auto", height: "500px" }}>
            <DataTableFromDB data={{ id: data.collection_id }} isReadOnly={true} />
          </div>
        </>
      ) : (
        <ProgressBarRequests
          isUpdating={isUpdating}
          setIsUpdating={setIsUpdating}
          progress={{ now: progressValue }}
          setProgress={(prog) => setProgressValue(prog.now)}
          requestTopic={"evaluation/progress/predict/" + pageId}
          onDataReceived={onProgressDataReceived}
        />
      )}
    </div>
  )
}

export default PredictPanel
