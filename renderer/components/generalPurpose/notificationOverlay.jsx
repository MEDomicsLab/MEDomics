import React, { useState, useContext, useEffect, useRef } from "react"
import { Badge } from "primereact/badge"
import { OverlayPanel } from "primereact/overlaypanel"
import { Button } from "primereact/button"
import { NotificationContext } from "./notificationContext"
import { ipcRenderer } from "electron"
import { Card } from "react-bootstrap"

/**
 * @description - This component is the notification overlay component that will be used in the main layout component
 *
 */
const NotificationOverlay = () => {
  const { notifications, setNotifications } = useContext(NotificationContext) // used to get the notifications
  const op = useRef(null)
  const [notificationCards, setNotificationCards] = useState([])
  const [localNotifications, setLocalNotifications] = useState([])

  /**
   * @description - This function is used to add a new notification to the notification overlay
   */
  const addNotification = (newNotification) => {
    setLocalNotifications((currentNotifications) => {
      let newNotifications = [...currentNotifications]
      let alreadyExists = false
      newNotifications.forEach((oldNotification) => {
        if (oldNotification.id === newNotification.id) {
          alreadyExists = true
          oldNotification.message += "\n" + newNotification.message
        }
      })
      if (!alreadyExists) {
        newNotifications.push(newNotification)
      }
      return newNotifications
    })

    setNotifications((currentNotifications) => {
      let newNotifications = [...currentNotifications]
      let alreadyExists = false
      newNotifications.forEach((notification) => {
        if (notification.id === newNotification.id) {
          alreadyExists = true
          notification.message = newNotification.message
        }
      })
      if (!alreadyExists) {
        newNotifications.push(newNotification)
      }
      return newNotifications
    })
  }

  useEffect(() => {
    ipcRenderer.on("notification", (event, arg) => {
      addNotification(arg)
    })
  }, [])

  useEffect(() => {
    ipcRenderer.invoke("getInstalledPythonPackages").then((res) => {
      console.log("Installed Python Packages: ", res)
    })
  }, [])

  useEffect(() => {
    parseNotifications()
  }, [notifications])

  const removeNotification = (id) => {
    let newNotifications = localNotifications.filter((notification) => notification.id !== id)
    setLocalNotifications(newNotifications)
    setNotifications(newNotifications)
  }

  const parseNotifications = () => {
    let cards = []
    notifications.forEach((notification, index) => {
      cards.push(<NotificationCard key={index} notification={notification} removeNotification={removeNotification} />)
    })
    setNotificationCards(cards)
  }

  const style = {
    position: "absolute",
    right: "5px",
    bottom: "5px",
    padding: "0rem"
  }

  const style2 = {
    position: "absolute",
    right: "10px",
    bottom: "10px",
    maxWidth: "30rem",
    maxHeight: "20rem"
  }

  const styleCard = {
    backgroundColor: "red"
  }

  // eslint-disable-next-line no-unused-vars
  const addRandomNotification = () => {
    let id = Math.floor(Math.random() * 1000)
    let message = "This is a random notification with id: " + id
    let newNotification = { id: id, message: message, header: "Random Notification" }
    setNotifications([...notifications, newNotification])
  }

  return (
    <>
      <div className="notification-overlay" style={styleCard}>
        {/*  */}
        <Button icon="pi pi-bell" text aria-label="Notification" onClick={(e) => op.current.toggle(e)} style={style}>
          {notifications.length > 0 && <Badge value={notifications.length} severity="danger"></Badge>}
        </Button>
        <OverlayPanel ref={op} style={style2} dismissable={false}>
          <p
            style={{
              color: "#a3a3a3",
              font: "Arial",
              fontSize: "12px",
              padding: "0.75rem 0.25rem 0.05rem 0.75rem",
              margin: "0 0 0 0",
              position: "relative",
              top: "-10px",
              left: "-10px"
            }}
          >
            Notifications
          </p>
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", padding: "0rem" }}>
            {notifications.length == 0 && <h6 style={{ paddingInline: "1rem" }}>No notifications</h6>}
            {notifications.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", padding: "0rem", maxHeight: "15rem", width: "auto", overflowY: "auto", overflowX: "hidden" }}>{notificationCards}</div>
            )}
          </div>
          {/* For tests purposes */}
          {/* <Button label="Add Notification" onClick={addRandomNotification} /> */}
        </OverlayPanel>
      </div>
    </>
  )
}

const NotificationCard = ({ notification, removeNotification }) => {
  // |------------------X-|
  // | NotificationCard   |
  // |--------------------|
  return (
    <Card style={{ display: "flex", flexDirection: "column", padding: "0rem", boxShadow: "0 1px 3px rgb(0 0 0 / 30%)", width: "28rem", justifyContent: "center", paddingLeft: "0.4rem" }}>
      <div className="notification-card" style={{ display: "flex", flexDirection: "column", padding: "0rem", justifyContent: "center" }}>
        {/* Close button */}
        <button
          style={{ alignSelf: "flex-end", position: "relative", top: "0.5rem", right: "0.5rem", border: "none", backgroundColor: "transparent" }}
          onClick={() => {
            removeNotification(notification.id)
          }}
        >
          <i className="pi pi-times"></i>
        </button>
        <div style={{ display: "flex", flexDirection: "row", padding: "0rem", margin: "0rem" }}>
          {notification.header && <h6 style={{ top: "-1rem", position: "relative" }}>{notification.header}</h6>}
        </div>
        <p>{notification.message}</p>
      </div>
    </Card>
  )
}

export default NotificationOverlay
