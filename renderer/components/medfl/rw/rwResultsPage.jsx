import React, { useState, useEffect } from "react"
import ReactECharts from "echarts-for-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer, BarChart, Bar } from "recharts"
import { Tab, Tabs, Table, Card, Container, Row, Col, Spinner, Button, ListGroup } from "react-bootstrap"
import { Server, Laptop, Hdd } from "react-bootstrap-icons"
import { loadFileFromPathSync } from "../../../utilities/fileManagementUtils"
import ClientEvalLineChart from "./ ClientsLineChart"
import ClientDetails from "./ClientDetails"
import { BsFillFileEarmarkBarGraphFill } from "react-icons/bs"
import { PiGraphFill } from "react-icons/pi"
import { FaHashtag, FaPlayCircle, FaClock, FaCalendarAlt } from "react-icons/fa"

/**
 * Federated Learning Experiment Dashboard
 * A research-grade visualization of federated training and evaluation metrics,
 * device distribution, and configuration details.
 */
const RwResultsPage = ({ url }) => {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState("overview")
  const [savedDate, setSavedDate] = useState("")

  // Load data on mount or URL change
  useEffect(() => {
    loadFileFromPathSync(url).then((result) => {
      setData(result.data)
      setSavedDate(new Date(result.date).toLocaleString())
    })
  }, [url])

  // Show spinner while loading
  if (!data) {
    return (
      <Container className="vh-100 d-flex flex-column justify-content-center align-items-center">
        <Spinner animation="border" role="status" />
        <p className="mt-3 text-muted">Loading federated learning results...</p>
      </Container>
    )
  }

  // Device distribution stats
  const stats = data.connectedClients.reduce(
    (acc, client) => {
      const os = client.os.toLowerCase()
      if (os.includes("linux")) acc.linux++
      else if (os.includes("windows")) acc.windows++
      else if (os.includes("mac") ) acc.macOS++
      return acc
    },
    { linux: 0, windows: 0, macOS: 0 }
  )

  const deviceStats = [
    { name: "Linux", value: stats.linux, icon: <Server /> },
    { name: "Windows", value: stats.windows, icon: <Laptop /> },
    { name: "macOS", value: stats.macOS, icon: <Hdd /> }
  ]

  // Group client metrics by ID
  const groupByClient = (metrics) =>
    metrics.reduce((acc, m) => {
      acc[m.clientId] = acc[m.clientId] || []
      acc[m.clientId].push({ round: m.round, accuracy: m.accuracy })
      return acc
    }, {})

  const trainByClient = groupByClient(data.clientTrainMetrics)
  const evalByClient = groupByClient(data.clientEvalMetrics)

  // Build ECharts option for global metrics
  const buildOption = (seriesData, title) => ({
    title: { text: title, left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" },
    legend: { top: 30, data: Object.keys(seriesData) },
    grid: { left: 40, right: 20, bottom: 40, top: 60 },
    xAxis: { type: "category", data: data.trainingResults.map((r) => r.round) },
    yAxis: { type: "value" },
    series: Object.entries(seriesData).map(([name, arr]) => ({ name, type: "line", data: arr, smooth: true }))
  })

  const globalTrainSeries = {
    Loss: data.trainingResults.map((r) => r.loss),
    Accuracy: data.trainingResults.map((r) => r.accuracy),
    AUC: data.trainingResults.map((r) => r.auc)
  }
  const globalEvalSeries = {
    Loss: data.evaluationResults.map((r) => r.loss),
    Accuracy: data.evaluationResults.map((r) => r.accuracy),
    AUC: data.evaluationResults.map((r) => r.auc)
  }

  const totalTime = data.trainingResults.reduce((sum, r) => sum + parseFloat(r.timeTaken), 0).toFixed(2)

  // format start date
  const startDate = new Date(data.trainingResults[0].timestamp).toLocaleString()

  return (
    <Container fluid className="py-4 overflow-auto h-100">
      <h2 className="text-center mb-4">Federated Learning Experiment Dashboard</h2>

      <Tabs activeKey={tab} onSelect={setTab} className="mb-4 justify-content-center">
        <Tab eventKey="overview" title="Overview">
          <Row className="gy-3">
            <Col md={4}>
              <Card className="h-100 shadow-sm">
                {/* Header */}
                <Card.Header className="d-flex align-items-center bg-primary text-white">
                  <PiGraphFill className="me-2" size={20} />
                  <Card.Title className="mb-0">Experiment Configuration</Card.Title>
                </Card.Header>

                {/* Body */}
                <Card.Body className="d-flex flex-column justify-content-between">
                  <ListGroup variant="flush" className="mb-3">
                    <ListGroup.Item className="d-flex justify-content-between align-items-center">
                      <span>
                        <FaHashtag className="me-2 text-secondary" />
                        ID
                      </span>
                      <strong>{data.config.id}</strong>
                    </ListGroup.Item>

                    <ListGroup.Item className="d-flex justify-content-between align-items-center">
                      <span>
                        <FaPlayCircle className="me-2 text-secondary" />
                        Strategy
                      </span>
                      <strong>{data.config.strategy}</strong>
                    </ListGroup.Item>

                    <ListGroup.Item className="d-flex justify-content-between align-items-center">
                      <span>
                        <FaClock className="me-2 text-secondary" />
                        Rounds
                      </span>
                      <strong>{data.config.numRounds}</strong>
                    </ListGroup.Item>

                    <ListGroup.Item className="d-flex justify-content-between align-items-center">
                      <span>
                        <FaCalendarAlt className="me-2 text-secondary" />
                        Started
                      </span>
                      <strong>{startDate}</strong>
                    </ListGroup.Item>

                    <ListGroup.Item className="d-flex justify-content-between align-items-center">
                      <span>
                        <FaClock className="me-2 text-secondary" />
                        Total Time
                      </span>
                      <strong>{totalTime} s</strong>
                    </ListGroup.Item>
                  </ListGroup>

                  {/* Action */}
                  <Button variant="outline-primary" className="mt-auto align-self-start" onClick={() => window.open(data.config.configPath, "_blank")}>
                    <PiGraphFill className="me-2" />
                    Open Scene
                  </Button>
                </Card.Body>

                {/* Footer (optional) */}
                <Card.Footer className="text-muted">
                  {/* You could show e.g. “Last saved: …” or other metadata here */}
                  Saved on {savedDate}
                </Card.Footer>
              </Card>
            </Col>

            <Col md={8}>
              <Card>
                <Card.Body>
                  <ReactECharts style={{ height: 350 }} option={buildOption(globalTrainSeries, "Global Training Metrics")} />
                  <small className="text-muted">Figure 1: Loss, Accuracy, and AUC over training rounds.</small>
                </Card.Body>
              </Card>
            </Col>

            <Col md={8}>
              <Card>
                <Card.Body>
                  <ReactECharts style={{ height: 350 }} option={buildOption(globalEvalSeries, "Global Evaluation Metrics")} />
                  <small className="text-muted">Figure 2: Loss, Accuracy, and AUC over evaluation rounds.</small>
                </Card.Body>
              </Card>
            </Col>

            <Col md={4}>
              <Card>
                <Card.Body>
                  <Card.Title>Device Distribution</Card.Title>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={deviceStats} margin={{ top: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="value" fill="#2a9d8f" />
                    </BarChart>
                  </ResponsiveContainer>
                  <small className="text-muted">Figure 3: OS distribution among clients.</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>

        <Tab eventKey="clients" title="Client Performance">
          <Row className="gy-4">
            {["Training", "Evaluation"].map((type) => {
              const clientData = type === "Training" ? data.clientTrainMetrics : data.clientEvalMetrics
              return (
                <Col md={6} key={type}>
                  <Card className="border-0">
                    <Card.Body>
                      <Card.Title>Client {type} Metrics Over Rounds</Card.Title>
                      <ResponsiveContainer width="100%" height={540}>
                        <ClientEvalLineChart clientEvalMetrics={clientData} title=""></ClientEvalLineChart>
                      </ResponsiveContainer>
                      <small className="text-muted">
                        Figure {type === "Training" ? 4 : 5}: {type} metrics trajectories.
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
              )
            })}
          </Row>
        </Tab>

        <Tab eventKey="devices" title="Device Details">
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Server</Card.Title>
              <Table responsive striped size="sm">
                <thead>
                  <tr>
                    <th>Hostname</th>
                    <th>OS</th>
                    <th>IP</th>
                    <th>Last Seen</th>
                    <th>Version</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{data.devices.server.hostname}</td>
                    <td>{data.devices.server.os}</td>
                    <td>{data.devices.server.addresses[0]}</td>
                    <td>{new Date(data.devices.server.lastSeen).toUTCString()}</td>
                    <td>{data.devices.server.clientVersion}</td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <Card.Title>Clients</Card.Title>
              <Table responsive striped size="sm">
                <thead>
                  <tr>
                    <th>Hostname</th>
                    <th>OS</th>
                    <th>IP</th>
                    <th>Last Seen</th>
                    <th>Version</th>
                  </tr>
                </thead>
                <tbody>
                  {data.devices.clients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.hostname}</td>
                      <td>{client.os}</td>
                      <td>{client.addresses[0]}</td>
                      <td>{new Date(client.lastSeen).toUTCString()}</td>
                      <td>{client.clientVersion}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="Datasets" title="Client Datasets">
          <ClientDetails clientProperties={data ? data.clientProperties : []} />
        </Tab>
      </Tabs>
    </Container>
  )
}

export default RwResultsPage
