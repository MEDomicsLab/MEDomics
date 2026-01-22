import { React, createContext } from "react"

const ServerConnectionContext = createContext(null)

function ServerConnectionProvider({ children, port, setPort }) {
  return (
    <>
      <ServerConnectionContext.Provider value={{ port, setPort }}>{children}</ServerConnectionContext.Provider>
    </>
  )
}

export { ServerConnectionContext, ServerConnectionProvider }
