/* eslint-disable no-undef */
import React, { createContext, useState } from "react"

// This context is used to store the pageInfos (id and config of the workflow)
const PageInfosContext = createContext()

/**
 * @param {*} children components that will use the context
 * @description This component is used to provide the pageInfos context to all the components that need it.
 *  It is used to store the pageInfos (id and config of the workflow)
 */
function PageInfosProvider({ children }) {
  const [config, setConfig] = useState(null)
  const [pageId, setPageId] = useState("")

  return (
    // in the value attribute we pass the pageInfos and the function to update it.
    // These will be available to all the components that use this context
    <PageInfosContext.Provider
      value={{
        config,
        setConfig,
        pageId,
        setPageId
      }}
    >
      {children}
    </PageInfosContext.Provider>
  )
}

export { PageInfosContext, PageInfosProvider }
