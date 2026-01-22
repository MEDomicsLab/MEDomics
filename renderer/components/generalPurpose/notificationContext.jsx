import React, { createContext, useState } from "react"

// This context is used to store the notifications that will be displayed in the notification overlay
/**
 * @typedef {React.Context} NotificationContext
 * @description
 * @summary
 * @see
 */
const NotificationContext = createContext()

function NotificationContextProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        setNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export { NotificationContextProvider, NotificationContext }
