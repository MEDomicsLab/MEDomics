import React, { useContext, useEffect, useMemo, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { useMEDflContext } from "../../workspace/medflContext"

export default function MlStrategyNode({ id, data }) {
  const { updateNode } = useContext(FlowFunctionsContext)
  const { columnsIntersectionFromNetworkCheck } = useMEDflContext()

  console.log("MlStrategyNode render", { id, data, columnsIntersectionFromNetworkCheck })

  const [selectedColumns, setSelectedColumns] = useState(data.internal?.settings?.selectedColumns || [])
  const [validationFraction, setValidationFraction] = useState(data.internal?.settings?.validationFraction || 0.1)
  const [testFraction, setTestFraction] = useState(data.internal?.settings?.testFraction || 0.1)

  // Initialize selected columns with all available columns (first time)
  useEffect(() => {
    if ((!selectedColumns || selectedColumns.length === 0) && columnsIntersectionFromNetworkCheck.length > 0) {
      setSelectedColumns(columnsIntersectionFromNetworkCheck)
    }
  }, [columnsIntersectionFromNetworkCheck])

  const handleSelectColumns = (v) => {
    const val = v?.value.value ?? v
    if (Array.isArray(val)) {
      // Normalize all items to {label, name}
      const formatted = val.map((x) => (typeof x === "string" ? { label: x, name: x } : { label: x?.label ?? x?.name, name: x?.name ?? x?.label }))
      setSelectedColumns(formatted)
    } else if (typeof val === "string") {
      setSelectedColumns([{ label: val, name: val }])
    } else {
      setSelectedColumns([])
    }
  }

  const handleTestFraction = (v) => {
    const num = Number(v?.value ?? v)
    if (!Number.isNaN(num)) setTestFraction(num)
  }

  const handleValidationFraction = (v) => {
    const num = Number(v?.value ?? v)
    if (!Number.isNaN(num)) setValidationFraction(num)
  }

  // Sync state back into node
  useEffect(() => {
    data.internal.settings.selectedColumns = selectedColumns.map((c) => c.name)
    data.internal.settings.validationFraction = validationFraction
    data.internal.settings.testFraction = testFraction

    updateNode({
      id,
      updatedData: data.internal
    })
  }, [id, selectedColumns, validationFraction, testFraction])

  return (
    <Node
      key={id}
      id={id}
      data={data}
      setupParam={data.setupParam}
      nodeBody={<></>}
      defaultSettings={
        <>
          <label>Select the columns</label>
          <FlInput
            name="Select columns"
            currentValue={selectedColumns}
            onInputChange={handleSelectColumns}
            settingInfos={{
              type: "list-multiple",
              tooltip: "Select the columns to use",
              choices: columnsIntersectionFromNetworkCheck
            }}
            setHasWarning={() => {}}
          />

          <FlInput name="Test fraction" currentValue={testFraction} onInputChange={handleTestFraction} settingInfos={{ type: "float", tooltip: "" }} setHasWarning={() => {}} />

          <FlInput name="Validation fraction" currentValue={validationFraction} onInputChange={handleValidationFraction} settingInfos={{ type: "float", tooltip: "" }} setHasWarning={() => {}} />
        </>
      }
      nodeSpecific={<></>}
    />
  )
}
