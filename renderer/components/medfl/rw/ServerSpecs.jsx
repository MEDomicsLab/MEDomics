import React, { useContext, useEffect, useState } from "react"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { requestBackend } from "../../../utilities/requests"
import { Container, Row, Col, Card, Table, Spinner, Alert } from "react-bootstrap"
import { FaMicrochip, FaMemory, FaHdd, FaDesktop, FaCheckCircle, FaTimesCircle } from "react-icons/fa"

/**
 * MachineSpecsDisplay
 * Fetches and displays machine specifications in a clean, professional layout.
 */
export default function MachineSpecsDisplay() {
  const { port } = useContext(WorkspaceContext)
  const { pageId } = useContext(PageInfosContext)
  const [specs, setSpecs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    requestBackend(
      port,
      `/medfl/machine-specs/${pageId}`,
      {},
      (json) => {
        if (json.error) {
          setError(json.error)
          setSpecs(null)
        } else {
          setSpecs(json.data)
          setError(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setError("Unable to load machine specs.")
        setLoading(false)
      }
    )
  }, [port, pageId])

  const icon = (available) => (available ? <FaCheckCircle className="text-success" /> : <FaTimesCircle className="text-danger" />)

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    )
  }
  if (error) {
    return (
      <Container className="py-4">
        <Alert variant="danger">Error: {error}</Alert>
      </Container>
    )
  }
  if (!specs) return null

  const { os, cpu_physical_cores, cpu_logical_cores, cpu_usage_percent, total_memory_mb, memory_usage_percent, disks = [], has_hardware_gpu, has_software_gpu, gpus = [], physical_gpus = [] } = specs

  const formatMem = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`)

  return (
    <Container className="py-4">
  
      <Row className="g-4 mb-5">
        {/* OS & CPU */}
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Header className="fw-bold d-flex align-items-center" style={{ gap: "0.5rem" }}>
              <FaMicrochip /> OS &amp; CPU
            </Card.Header>
            <Card.Body className="p-4">
              <p>
                <strong>Operating System:</strong> {os}
              </p>
              <p>
                <strong>Physical cores:</strong> {cpu_physical_cores}
              </p>
              <p>
                <strong>Logical cores:</strong> {cpu_logical_cores}
              </p>
              <p>
                <strong>CPU usage:</strong> {cpu_usage_percent}%
              </p>
            </Card.Body>
            <Card.Footer className="bg-white">
              <div className="progress" style={{ height: "8px" }}>
                <div className={`progress-bar ${cpu_usage_percent > 80 ? "bg-danger" : "bg-primary"}`} style={{ width: `${cpu_usage_percent}%` }} />
              </div>
            </Card.Footer>
          </Card>
        </Col>

        {/* Memory */}
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Header className="fw-bold d-flex align-items-center" style={{ gap: "0.5rem" }}>
              <FaMemory /> Memory
            </Card.Header>
            <Card.Body className="p-4">
              <p>
                <strong>Total Memory:</strong> {formatMem(total_memory_mb)}
              </p>
              <p>
                <strong>Usage:</strong> {memory_usage_percent}%
              </p>
            </Card.Body>
            <Card.Footer className="bg-white">
              <div className="progress" style={{ height: "8px" }}>
                <div className={`progress-bar ${memory_usage_percent > 80 ? "bg-danger" : "bg-primary"}`} style={{ width: `${memory_usage_percent}%` }} />
              </div>
            </Card.Footer>
          </Card>
        </Col>
      </Row>

      {/* <Row className="mb-5">

        <Col>
          <Card className="shadow-sm">
            <Card.Header className="fw-bold d-flex align-items-center" style={{ gap: "0.5rem" }}>
              <FaHdd /> Storage
            </Card.Header>
            <Card.Body className="p-0">
              <Table hover responsive className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Device</th>
                    <th>Mount</th>
                    <th>Type</th>
                    <th>Total</th>
                    <th>Used</th>
                    <th>Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {disks.map((d, i) => (
                    <tr key={i}>
                      <td>{d.device}</td>
                      <td>{d.mountpoint}</td>
                      <td>{d.fstype}</td>
                      <td>{d.total_gb} GB</td>
                      <td>{d.used_percent}%</td>
                      <td>
                        <div className="progress" style={{ height: "6px" }}>
                          <div className={`progress-bar ${d.used_percent > 90 ? "bg-danger" : "bg-primary"}`} style={{ width: `${d.used_percent}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row> */}

      <Row className="g-4">
        {/* GPU Availability */}
        <Col md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Header className="fw-bold d-flex align-items-center" style={{ gap: "0.5rem" }}>
              <FaDesktop /> GPU Availability
            </Card.Header>
            <Card.Body className="p-4">
              <p>{icon(has_hardware_gpu)} Hardware GPU detected</p>
              <p>{icon(has_software_gpu)} Driver available</p>
            </Card.Body>
          </Card>
        </Col>

        {/* GPU Details */}
        {gpus.length > 0 && (
          <Col md={8}>
            <Card className="shadow-sm">
              <Card.Header className="fw-bold d-flex align-items-center" style={{ gap: "0.5rem" }}>
                <FaDesktop /> GPU Details
              </Card.Header>
              <Card.Body className="p-0">
                <Table hover responsive className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Name</th>
                      <th>Load</th>
                      <th>Memory</th>
                      <th>Temp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gpus.map((gpu, i) => (
                      <tr key={i}>
                        <td>{gpu.name}</td>
                        <td>{gpu.load_percent}%</td>
                        <td>
                          {gpu.memory_used_mb}/{gpu.memory_total_mb} MB
                        </td>
                        <td>{gpu.temperature_c}°C</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>

      {/* Physical GPU interfaces */}
      {physical_gpus.length > 0 && (
        <Row>
          <Col>
            <Card className="shadow-sm">
              <Card.Header className="fw-bold">Physical GPU Interfaces</Card.Header>
              <Card.Body>
                <pre className="mb-0" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                  {physical_gpus.join("\n")}
                </pre>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  )
}
