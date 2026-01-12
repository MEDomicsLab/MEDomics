import React, { useContext, useEffect, useMemo, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { useMEDflContext } from "../../workspace/medflContext"
import LockNode from "../rw/LockNode"
import { Tab, Tabs } from "react-bootstrap"
import { update } from "lodash"
import { requestBackend } from "../../../utilities/requests"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa"

export default function MlStrategyNode({ id, data }) {
  const { port } = useContext(WorkspaceContext)
  const { pageId } = useContext(PageInfosContext)

  const { updateNode } = useContext(FlowFunctionsContext)
  const { columnsIntersectionFromNetworkCheck } = useMEDflContext()

  console.log("MlStrategyNode render", { id, data, columnsIntersectionFromNetworkCheck })

  const [selectedColumns, setSelectedColumns] = useState(data.internal?.settings?.selectedColumns || [])
  const [validationFraction, setValidationFraction] = useState(data.internal?.settings?.validationFraction || 0.1)
  const [testFraction, setTestFraction] = useState(data.internal?.settings?.testFraction || 0.1)

  const [selectedClient, setSelectedClient] = useState(data.internal.settings.checkedClients ? data.internal.settings.checkedClients[0] : "")

  // Initialize selected columns with all available columns (first time)
  useEffect(() => {
    if (!selectedColumns || selectedColumns.length === 0) {
      setSelectedColumns(data.internal.settings.intersectionColumns || [])
    }
  }, [data.internal.settings.intersectionColumns])

  useEffect(() => {
    if (!selectedColumns || selectedColumns.length === 0) {
      setSelectedClient(data.internal.settings.checkedClients ? data.internal.settings.checkedClients[0] : "")
    }
  }, [data.internal.settings.checkedClients])

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

  const updateSplitMode = (mode) => {
    data.internal.settings.splitMode = mode
    updateNode({
      id,
      updatedData: data.internal
    })
  }

  const checkIds = () => {
    requestBackend(
      port,
      "/medfl/rw/ws/check-ids/" + pageId,
      { id: selectedClient, ids: data.internal.settings.perClientConfig?.[selectedClient]?.test_ids || [], column: "id" },
      (json) => {
        if (json.error) {
          console.error("getDataAgentStats error:", json.error)
        } else {
          console.log("Agent stats:", json)

          data.internal.settings.perClientConfig = {
            ...data.internal.settings.perClientConfig,
            [selectedClient]: {
              ...data.internal.settings.perClientConfig?.[selectedClient],
              idsCheck: json
            }
          }
          updateNode({
            id,
            updatedData: data.internal
          })

          console.log("Updated node data:", data)
        }
      },
      (err) => {
        console.error(err)
      }
    )
  }

  const Pill = ({ ok, text, warning = false }) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        marginRight: 8,
        background: warning ? "rgba(167, 133, 40, 0.1)" : ok ? "rgba(40,167,69,0.1)" : "rgba(220,53,69,0.1)",
        color: warning ? "#ee932bff" : ok ? "#28a745" : "#dc3545"
      }}
    >
      {ok ? <FaCheckCircle /> : <FaTimesCircle />} {text}
    </span>
  )

  return (
    <>
      <LockNode id={id} data={data} />

      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        nodeBody={<></>}
        defaultSettings={
          <div style={{ width: "300px" }}>
            <label>Select the columns</label>
            <FlInput
              name="Select columns"
              currentValue={selectedColumns}
              onInputChange={handleSelectColumns}
              settingInfos={{
                type: "list-multiple",
                tooltip: "Select the columns to use",
                choices: data.internal.settings.intersectionColumns
              }}
              setHasWarning={() => {}}
            />

            <span className="d-block my-3">Split mode</span>
            <Tabs defaultActiveKey="global" id="split-mode-tab" className="mb-3" onSelect={updateSplitMode} activeKey={data.internal.settings.splitMode || "global"}>
              <Tab eventKey="global" title="Global">
                <FlInput name="Test fraction" currentValue={testFraction} onInputChange={handleTestFraction} settingInfos={{ type: "float", tooltip: "" }} setHasWarning={() => {}} />

                <FlInput name="Validation fraction" currentValue={validationFraction} onInputChange={handleValidationFraction} settingInfos={{ type: "float", tooltip: "" }} setHasWarning={() => {}} />
              </Tab>
              <Tab eventKey="per_client" title="Per Client">
                <FlInput
                  name="Clients"
                  settingInfos={{
                    type: "list",
                    tooltip: "<p>Specify a data file (xlsx, csv, json)</p>",
                    choices: data.internal.settings.checkedClients?.map((client) => ({ name: client }))
                  }}
                  currentValue={selectedClient}
                  onInputChange={(e) => {
                    setSelectedClient(e.value)
                  }}
                  setHasWarning={() => {}}
                />
                {selectedClient && selectedClient != "" && (
                  <>
                    <FlInput
                      name="Validation fraction"
             
                      currentValue={data.internal.settings.perClientConfig?.[selectedClient]?.val_fraction || 0}
                      onInputChange={(v) => {
                        const num = Number(v?.value ?? v)
                        if (!Number.isNaN(num)) {
                          data.internal.settings.perClientConfig = {
                            ...data.internal.settings.perClientConfig,
                            [selectedClient]: {
                              ...data.internal.settings.perClientConfig?.[selectedClient],
                              val_fraction: num
                            }
                          }
                          updateNode({
                            id,
                            updatedData: data.internal
                          })
                        }
                      }}
                      settingInfos={{ type: "float", tooltip: "" }}
                      setHasWarning={() => {}}
                    />
                    <div className="form-check form-switch m-2 w-100 ">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="flexSwitchCheckDefault"
                        checked={data.internal.settings.perClientConfig?.[selectedClient]?.byIDS}
                        onChange={(e) => {
                          data.internal.settings.perClientConfig = {
                            ...data.internal.settings.perClientConfig,
                            [selectedClient]: {
                              ...data.internal.settings.perClientConfig?.[selectedClient],
                              byIDS: e.target.checked
                            }
                          }
                          updateNode({
                            id,
                            updatedData: data.internal
                          })
                        }}
                      />

                      <label className="form-check-label" for="flexSwitchCheckDefault">
                        By test ids
                      </label>
                    </div>

                    {data.internal.settings.perClientConfig?.[selectedClient]?.byIDS ? (
                      <div>
                        {" "}
                        <FlInput
                          name="Test IDs (comma separated)"
                          currentValue={data.internal.settings.perClientConfig?.[selectedClient]?.test_ids || ""}
                          onInputChange={(v) => {
                            const ids = (v?.value ?? v).split(",").map((id) => id.trim())
                            data.internal.settings.perClientConfig = {
                              ...data.internal.settings.perClientConfig,
                              [selectedClient]: {
                                ...data.internal.settings.perClientConfig?.[selectedClient],
                                test_ids: ids
                              }
                            }
                            updateNode({
                              id,
                              updatedData: data.internal
                            })
                          }}
                          settingInfos={{ type: "string", tooltip: "" }}
                          setHasWarning={() => {}}
                        />
                        <div className="d-flex align-items-center mt-2">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm d-flex align-items-center"
                            onClick={() => {
                              // TODO: implement ID existence verification logic
                              checkIds()
                            }}
                            disabled={!(data.internal.settings.perClientConfig?.[selectedClient]?.test_ids?.length > 0)}
                            title="Verify IDs in dataset"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
                            </svg>
                            <span className="ms-2">Verify IDs</span>
                          </button>
                        </div>
                        <div>
                          {data.internal.settings.perClientConfig?.[selectedClient]?.idsCheck && (
                            <div className="mt-2">
                              <Pill
                                ok={data.internal.settings.perClientConfig?.[selectedClient]?.idsCheck.exists_all}
                                text={data.internal.settings.perClientConfig?.[selectedClient]?.idsCheck.exists_all ? "All ids exists" : "Some missing ids"}
                                warning={
                                  !data.internal.settings.perClientConfig?.[selectedClient]?.idsCheck.exists_all &&
                                  data.internal.settings.perClientConfig?.[selectedClient]?.idsCheck.present_ids.length > 0
                                }
                              />

                              <div className="my-3">List of missing IDS</div>
                              <div style={{ maxHeight: "100px", overflowY: "auto", border: "1px solid #ddd", padding: "8px", borderRadius: "4px" }}>
                                {data.internal.settings.perClientConfig?.[selectedClient]?.idsCheck.missing_ids.length > 0
                                  ? data.internal.settings.perClientConfig?.[selectedClient]?.idsCheck.missing_ids.join(", ")
                                  : "None"}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <FlInput
                          name="Test fraction"
                          currentValue={data.internal.settings.perClientConfig?.[selectedClient]?.test_fraction || 0}
                          onInputChange={(v) => {
                            const num = Number(v?.value ?? v)
                            if (!Number.isNaN(num)) {
                              data.internal.settings.perClientConfig = {
                                ...data.internal.settings.perClientConfig,
                                [selectedClient]: {
                                  ...data.internal.settings.perClientConfig?.[selectedClient],
                                  test_fraction: num
                                }
                              }
                              updateNode({
                                id,
                                updatedData: data.internal
                              })
                            }
                          }}
                          settingInfos={{ type: "float", tooltip: "" }}
                          setHasWarning={() => {}}
                        />
                      </div>
                    )}
                  </>
                )}
              </Tab>
            </Tabs>
          </div>
        }
        nodeSpecific={<></>}
      />
    </>
  )
}
