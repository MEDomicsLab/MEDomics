import { Button } from "primereact/button"
import { Card } from "primereact/card"
import { useContext, useState } from "react"
import { Col, Row } from "react-bootstrap"
import { toast } from "react-toastify"
import DataTableFromDB from "../dbComponents/dataTableFromDB"
import ProgressBarRequests from "../generalPurpose/progressBarRequests"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"

/**
 *
 * @param {Boolean} isUpdating Either the PredictPanel is updating or not
 * @param {Function} setIsUpdating Function to set the isUpdating state
 * @param {Object} data The data to display
 * @returns the PredictPanel of the evaluation page content
 */
const PredictPanel = ({ isUpdating, setIsUpdating, data, error=null }) => {
  const { pageId } = useContext(PageInfosContext) // we get the pageId to send to the server
  const [progress, setProgress] = useState({
    now: 0,
    currentLabel: ""
  }) // the progress value

  /**
   *
   * @param {Object} data Data received from the server on progress update
   */
  const onProgressDataReceived = (data) => {
    setProgress(data)
    if (data.now >= 100) {
      setIsUpdating(false)
    }
  }

  return (
    <div>
      {error ? (
        <Card className="mt-3">
        <Row className="error-dialog-header">
          <Col md="auto">
            <h5>{error.message && error.message[0].toUpperCase() + error.message.slice(1)}</h5>
          </Col>
          <Col>
            <Button
              icon="pi pi-copy"
              rounded
              text
              severity="secondary"
              onClick={() => {
                navigator.clipboard.writeText(error.message && error.message)
                toast.success("Copied to clipboard")
              }}
            />
          </Col>
        </Row>
        <pre
          style={{ 
            maxHeight: '600px', 
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}>
          {error.stack_trace && error.stack_trace}
        </pre>
        </Card>
      ) : (
      <>
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
            progress={progress}
            setProgress={setProgress}
            requestTopic={"evaluation/progress/predict/" + pageId}
            onDataReceived={onProgressDataReceived}
          />
        )}
      </>)}
    </div>
  )
}

export default PredictPanel
