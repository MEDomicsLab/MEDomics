import React, { useState, useEffect } from 'react'
import { ipcRenderer } from 'electron'
import { ProgressBar } from 'primereact/progressbar'
import { Card } from 'primereact/card'
import { Dialog } from 'primereact/dialog'
import { toast } from 'react-toastify'

/**
 * Component that displays notifications about application updates
 */
const UpdateNotification = () => {
  const [updateMessage, setUpdateMessage] = useState('')
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    // Listen for update messages from the main process
    ipcRenderer.on('update-message', (event, message) => {
      setUpdateMessage(message)
      
      // If the message indicates an update is available or downloaded, show the dialog
      if (message.includes('Update available')) {
        setShowUpdateDialog(true)
      } else if (message.includes('Update downloaded')) {
        setShowUpdateDialog(true)
      } else if (message.includes('Downloading update')) {
        setIsDownloading(true)
      } else if (message.includes('You\'re running the latest version')) {
        toast.info(message)
      }
    })

    // Listen for download progress
    ipcRenderer.on('update-download-progress', (event, progressObj) => {
      setDownloadProgress(progressObj.percent)
    })

    // Cleanup
    return () => {
      ipcRenderer.removeListener('update-message', () => {})
      ipcRenderer.removeListener('update-download-progress', () => {})
    }
  }, [])

  const handleClose = () => {
    setShowUpdateDialog(false)
    setIsDownloading(false)
  }

  return (
    <>
      {showUpdateDialog && (
        <Dialog 
          header="Application Update" 
          visible={showUpdateDialog}
          onHide={handleClose}
          style={{ width: '50vw' }}
        >
          <Card className="update-notification-card">
            <div className="p-4">
              <p>{updateMessage}</p>
              
              {isDownloading && (
                <div className="mt-3">
                  <ProgressBar value={downloadProgress} showValue={true} />
                  <div className="text-center mt-2">
                    {`Downloading: ${downloadProgress.toFixed(2)}%`}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Dialog>
      )}
    </>
  )
}

export default UpdateNotification