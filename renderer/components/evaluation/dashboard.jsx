import { Button } from "primereact/button"
import { Card } from "primereact/card"
import { useContext, useState } from "react"
import { Col, Row } from "react-bootstrap"
import Iframe from "react-iframe"
import { toast } from "react-toastify"
import ProgressBarRequests from "../generalPurpose/progressBarRequests"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"


/**
 *
 * @param {Boolean} isUpdating Either the dashboard is updating or not
 * @param {Function} setIsUpdating Function to set the isUpdating state
 * @returns the dashboard of the evaluation page content
 */
const Dashboard = ({ isUpdating, setIsUpdating, errorPrediction=null, error=null }) => {
  const { pageId } = useContext(PageInfosContext) // we get the pageId to send to the server
  const [url, setUrl] = useState(undefined) // we use this to store the url of the dashboard
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
    if (data.dashboard_url) {
      setUrl(data.dashboard_url)
      setIsUpdating(false)
    }
  }

  return (
    <>
      {errorPrediction ? (
        <div className="m-3" style={{color: "#cf616cff"}}>
          <h4>Cannot create dashboard, please fix the errors in the prediction step first</h4>
        </div>
      ) : error ? (
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
        {error.stack_trace && error.stack_trace}</pre>
        </Card>
      ) : (
      <>
        {url && !isUpdating ? (
          <div style={{ overflow: "auto", height: "700px" }}>
            <Iframe url={url} width="100%" height="100%" frameBorder="0" />
          </div>
        ) : (
          <ProgressBarRequests
            delayMS={1000}
            isUpdating={isUpdating}
            setIsUpdating={setIsUpdating}
            progress={progress}
            setProgress={setProgress}
            requestTopic={"evaluation/progress/dashboard/" + pageId}
            onDataReceived={onProgressDataReceived}
          />
        )}
      </>)}
    </>
  )
}

export default Dashboard
