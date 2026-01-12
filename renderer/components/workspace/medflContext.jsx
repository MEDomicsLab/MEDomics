// MEDflContext.js
import React, { createContext, useContext, useState } from "react"

/**
 * @typedef {React.Context} MEDflContext
 * @description A context object that provides global data and data manipulation functions to its children components.
 * @see https://reactjs.org/docs/context.html
 */
const MEDflContext = createContext()

/**
 * @typedef {React.FunctionComponent} MEDflContextProvider
 * @description A provider component that wraps its children components with the MEDflContext context object.
 * @param {Object} props - The props for the MEDflContextProvider component.
 * @param {Object} props.children - The children components to wrap with the MEDflContext context object.
 * @returns {JSX.Element} - The MEDflContextProvider component.
 */
export const MEDflContextProvider = ({ children }) => {
  const [medflData, setData] = useState({})

  const [flPipelineConfigs, setFlresultsConfigs] = useState([])

  const [columnsIntersectionFromNetworkCheck, setColumnsIntersectionFromNetworkCheck] = useState([])

  const [networkChecked, setNetworkChecked] = useState({})

  const [networkClients, setNetworkClients] = useState({})

  /**
   * @function addFlData
   * @description Adds new data to the global data array.
   * @param {any} newData - The new data to add.
   */
  const addFlData = (newData) => {
    setData(newData)
  }

  /**
   * @function addFlData
   * @description Adds new data to the global data array.
   * @param {any} newData - The new data to add.
   */
  const updatePipelineConfigs = (newData) => {
    setFlresultsConfigs(newData)
  }

  const updateColumnsIntersectionFromNetworkCheck = (newData) => {
    setColumnsIntersectionFromNetworkCheck(newData)
  }

  return (
    <MEDflContext.Provider
      value={{
        medflData,
        addFlData,
        flPipelineConfigs,
        updatePipelineConfigs,
        columnsIntersectionFromNetworkCheck,
        updateColumnsIntersectionFromNetworkCheck,
        networkChecked,
        setNetworkChecked,
        networkClients,
        setNetworkClients
      }}
    >
      {children}
    </MEDflContext.Provider>
  )
}

/**
 * @typedef {Function} useMEDflContext
 * @description A custom hook to consume the MEDflContext within functional components.
 * @returns {Object} - An object containing the global data array and the addData function.
 */
export const useMEDflContext = () => {
  const context = useContext(MEDflContext)
  if (!context) {
    throw new Error("useMEDflContext must be used within a MEDflContextProvider")
  }
  return context
}
