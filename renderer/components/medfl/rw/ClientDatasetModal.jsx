import React, { useContext, useEffect } from "react"
import { Button, Form, Row, Col, Nav, Tab, Alert } from "react-bootstrap"
import Modal from "react-bootstrap/Modal"
import ManageScripts from "./ManageScripts"
import FlDatasetrwNode from "../nodesTypes/DatasetrwNode"
import FlInput from "../flInput"
import { requestBackend } from "../../../utilities/requests"
import DatasetInfo from "./Datasetinfo"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"

export default function ClientDatasetModal({ show, onHide, clients = [] }) {
    const { port } = useContext(WorkspaceContext)
    const {  pageId } = useContext(PageInfosContext)
    
  
  // Global (same-for-all) configuration
  const [output, setOutput] = React.useState("")
  const [validFrac, setValidFrac] = React.useState(null)
  const [testFrac, setTestFrac] = React.useState(null)

  // Per-client mode toggle
  const [perClient, setPerClient] = React.useState(false)

  // Per-client state: { [clientId]: { output, validFrac, testFrac } }
  const [clientConfigs, setClientConfigs] = React.useState({})

  const [datasetStats, setDatasetStats] = React.useState(null)

  // Ensure each client has an entry when clients change
  React.useEffect(() => {
    setClientConfigs((prev) => {
      const next = { ...prev }
      clients.forEach((c) => {
        if (!next[c]) {
          next[c] = { output: "", validFrac: null, testFrac: null }
        }
      })
      // Clean up removed clients
      Object.keys(next).forEach((key) => {
        if (!clients.includes(key)) delete next[key]
      })
      return next
    })
  }, [clients])

  // Active client tab
  const [activeClient, setActiveClient] = React.useState(clients[0] || null)
  React.useEffect(() => {
    if (!activeClient && clients.length > 0) setActiveClient(clients[0])
    if (activeClient && !clients.includes(activeClient) && clients.length > 0) {
      setActiveClient(clients[0])
    }
  }, [clients, activeClient])

  useEffect(() => {
    if (activeClient) {
      getClientStats()
    }
  }, [activeClient])

  // Handlers (global)
  const onChangeOutput = (nodeType) => setOutput(nodeType.value)
  const onChangeValidFrac = (e) => setValidFrac(e.value)
  const onChangeTestFrac = (e) => setTestFrac(e.value)

  // Handlers (per-client)
  const updateClientField = (clientId, field, value) => {
    setClientConfigs((prev) => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        [field]: value
      }
    }))
  }
  const getClientStats = () => {
    requestBackend(
      port,
      "/medfl/rw/ws/stats/" + pageId,
      { id: activeClient },
      (json) => {
        if (json.error) {
          console.error("getDataAgentStats error:", json.error)
        } else {
          console.log("Agent stats:", json)
          setDatasetStats(json)
          // Process and display the stats as needed
        }
      },
      (err) => {
        console.error(err)
      }
    )
  }

  const renderGlobalForm = () => (
    <div className="d-flex flex-column gap-3">
      <FlInput
        name="Output"
        settingInfos={{
          type: "text",
          tooltip: "Output of the dataset"
        }}
        currentValue={output}
        onInputChange={onChangeOutput}
        setHasWarning={() => {}}
      />
      <FlInput
        name="Validation fraction"
        settingInfos={{
          type: "float",
          tooltip: "The validation fraction refers to the proportion of data reserved for evaluating model performance during training, separate from training and test sets."
        }}
        currentValue={validFrac}
        onInputChange={(e) => onChangeValidFrac(e)}
        setHasWarning={() => {}}
      />
      <FlInput
        name="Test fraction"
        settingInfos={{
          type: "float",
          tooltip: "The test fraction refers to the proportion of data reserved for final model testing for each node."
        }}
        currentValue={testFrac}
        onInputChange={(e) => onChangeTestFrac(e)}
        setHasWarning={() => {}}
      />
    </div>
  )

  const renderPerClientForm = () => {
    if (!clients.length) {
      return (
        <Alert variant="warning" className="mb-0">
          No clients found to configure.
        </Alert>
      )
    }

    return (
      <Tab.Container activeKey={activeClient || clients[0]} onSelect={(k) => setActiveClient(k)}>
        <Nav variant="pills" className="flex-column">
          {clients.map((c) => (
            <Nav.Item key={c}>
              <Nav.Link eventKey={c} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        <Tab.Content>
          {clients.map((c) => {
            const cfg = clientConfigs[c] || { output: "", validFrac: null, testFrac: null }
            return (
              <Tab.Pane eventKey={c} key={c}>
                <div className="d-flex flex-column gap-3 mt-3">
                  <FlInput
                    name="Output"
                    settingInfos={{ type: "text", tooltip: `Output for client ${c}` }}
                    currentValue={cfg.output}
                    onInputChange={(e) => updateClientField(c, "output", e.value)}
                    setHasWarning={() => {}}
                  />
                  <FlInput
                    name="Validation fraction"
                    settingInfos={{
                      type: "float",
                      tooltip: `Validation fraction for client ${c}`
                    }}
                    currentValue={cfg.validFrac}
                    onInputChange={(e) => updateClientField(c, "validFrac", e.value)}
                    setHasWarning={() => {}}
                  />
                  <FlInput
                    name="Test fraction"
                    settingInfos={{
                      type: "float",
                      tooltip: `Test fraction for client ${c}`
                    }}
                    currentValue={cfg.testFrac}
                    onInputChange={(e) => updateClientField(c, "testFrac", e.value)}
                    setHasWarning={() => {}}
                  />
                </div>
              </Tab.Pane>
            )
          })}
        </Tab.Content>
      </Tab.Container>
    )
  }

  return (
    <div>
      <Modal show={show} onHide={onHide} size="xl" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">Dataset configuration</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="d-flex flex-column gap-3">
            <Form>
              <Form.Check type="switch" id="switch-per-client-config" label="Configure each client separately" checked={perClient} onChange={(e) => setPerClient(e.target.checked)} />
            </Form>

            {!perClient ? (
              <>
                <Alert variant="info" className="mb-0">
                  Global configuration applies to <strong>all clients</strong>.
                </Alert>
                {renderGlobalForm()}
              </>
            ) : (
              <>
                <Alert variant="secondary" className="mb-0">
                  Per-client configuration is <strong>enabled</strong>. Select a client to set its values.
                </Alert>
                <Row>
                  <Col xs={12} md={6}>
                    {renderPerClientForm()}
                  </Col>
                  <Col xs={12} md={6}>
                    <DatasetInfo data={datasetStats} resumed={true} />
                  </Col>
                </Row>
              </>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          {/* Hook up to your save logic if needed */}
          {/* <Button variant="primary" onClick={handleSave}>Save</Button> */}
          <Button variant="outline-secondary" onClick={onHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
