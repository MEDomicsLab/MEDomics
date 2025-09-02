import React, { createContext, useContext, useState } from "react"

// Context for sidebar loading state

export const SidebarLoadingContext = createContext({
  sidebarProcessing: false,
  setSidebarProcessing: () => {},
  sidebarProcessingMessage: "",
  setSidebarProcessingMessage: () => {},
})

export function useSidebarLoading() {
  return useContext(SidebarLoadingContext)
}

export function SidebarLoadingProvider({ children }) {
  const [sidebarProcessing, setSidebarProcessing] = useState(false)
  const [sidebarProcessingMessage, setSidebarProcessingMessage] = useState("")
  return (
    <SidebarLoadingContext.Provider value={{ sidebarProcessing, setSidebarProcessing, sidebarProcessingMessage, setSidebarProcessingMessage }}>
      {children}
    </SidebarLoadingContext.Provider>
  );
}
