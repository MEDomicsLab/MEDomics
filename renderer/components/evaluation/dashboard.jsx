import React, { useContext, useState } from "react"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"
import ProgressBarRequests from "../generalPurpose/progressBarRequests"
import Iframe from "react-iframe"

/**
 *
 * @param {Boolean} isUpdating Either the dashboard is updating or not
 * @param {Function} setIsUpdating Function to set the isUpdating state
 * @returns the dashboard of the evaluation page content
 */
const Dashboard = ({ isUpdating, setIsUpdating }) => {
  const { pageId } = useContext(PageInfosContext) // we get the pageId to send to the server
  const [url, setUrl] = useState(undefined) // we use this to store the url of the dashboard
  const [progressValue, setProgressValue] = useState(0) // we use this to store the progress value of the dashboard

  /**
   *
   * @param {Object} data Data received from the server on progress update
   */
  const onProgressDataReceived = (data) => {
    setProgressValue(data.now)
    if (data.dashboard_url) {
      setUrl(data.dashboard_url)
      setIsUpdating(false)
    }
  }

  return (
    <>
      {url && !isUpdating ? (
        <Iframe url={url} width="100%" height="100%" frameBorder="0" />
      ) : (
        <ProgressBarRequests
          delayMS={1000}
          isUpdating={isUpdating}
          setIsUpdating={setIsUpdating}
          progress={{ now: progressValue }}
          setProgress={(prog) => setProgressValue(prog.now)}
          requestTopic={"evaluation/progress/dashboard/" + pageId}
          onDataReceived={onProgressDataReceived}
        />
      )}
    </>
  )
}

export default Dashboard
