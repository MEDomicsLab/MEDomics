import React from "react"
import { FaLinux, FaWindows, FaList, FaServer, FaMemory, FaApple } from "react-icons/fa"
import { AiOutlineDatabase, AiOutlineAppstore, AiOutlineInfoCircle } from "react-icons/ai"
import { MdFingerprint } from "react-icons/md"
import { BiTargetLock } from "react-icons/bi"
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts"
import { Badge } from "react-bootstrap"
import { FiCpu } from "react-icons/fi"
import { BsGpuCard } from "react-icons/bs"
import { FcLinux } from "react-icons/fc"

/**
 * ClientDetails - Professional display of FL client dataset properties
 * Left: metadata; Right: mini bar chart with per-class colors & values
 */
export default function ClientDetails({ clientProperties }) {
  const getOsIcon = (os) => {
   
    os = os.toLowerCase()
    if (os.includes("win")) return <FaWindows style={{ color: "#00adef" }} />
    if (os.includes("mac") || os.includes("apple") || os.includes("darwin")) return <FaApple />
    if (os.includes("linux")) return <FcLinux />
    return null
  }

  if (!clientProperties || Object.keys(clientProperties).length === 0) {
    return (
      <div className="text-center text-muted py-4 d-flex flex-column align-items-center " style={{ minHeight: "40vh" }}>
        <AiOutlineInfoCircle size={32} className="mb-2" />
        <h6 className="mb-0">Data not available yet</h6>
      </div>
    )
  }
  return (
    <div className="container mt-4">
      {Object.entries(clientProperties).map(([hostname, records]) => (
        <div key={hostname} className="card shadow-sm mb-4 border ">
          <div className="card-header   d-flex align-items-center py-2">
            <FaServer className="me-2" />
            <h5 className="mb-0 fw-semibold">{hostname}</h5>
          </div>

          <div className="card-body p-2">
            {records.map((record, index) => {
              const distData = record.label_distribution.split(",").map((item) => {
                const [cls, cnt] = item.split(":")
                return { name: cls, count: +cnt }
              })

              // Define color palette for classes
              const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28FD0"]

              return (
                <div key={record.id} className="border rounded  p-3 mb-3 bg-white">
                  <Badge bg="secondary">Client {index + 1} </Badge>
                  <div className="w-100 p-1 card-header mt-2 border rounded">Dataset</div>
                  <div className="row g-2 align-items-center">
                    {/* Metadata */}
                    <div className="col-md-8">
                      <div className="row g-2 mb-2">
                        <div className="col-6 d-flex align-items-center">
                          <MdFingerprint className="me-2 text-primary" />
                          <small title={record.id} className="text-truncate">
                            <strong>ID:</strong>&nbsp;{record.id.slice(0, 8)}...
                          </small>
                        </div>
                        <div className="col-6 d-flex align-items-center">
                          {getOsIcon(record.os_type)} 
                          <small>
                            <strong>OS:</strong>&nbsp;{record.os_type}
                          </small>
                        </div>
                      </div>
                      <div className="row g-2 mb-2">
                        <div className="col-6 d-flex align-items-center">
                          <AiOutlineDatabase className="me-2 text-warning" />
                          <small>
                            <strong>Samples:</strong>&nbsp;{record.num_samples}
                          </small>
                        </div>
                        <div className="col-6 d-flex align-items-center">
                          <AiOutlineAppstore className="me-2 text-secondary" />
                          <small>
                            <strong>Features:</strong>&nbsp;{record.num_features}
                          </small>
                        </div>
                      </div>
                      <div className="row g-2 mb-2">
                        <div className="col-6 d-flex align-items-center">
                          <BiTargetLock className="me-2 text-danger" />
                          <small>
                            <strong>Target:</strong>&nbsp;{record.target}
                          </small>
                        </div>
                        <div className="col-6 d-flex align-items-center">
                          <FaList className="me-2 text-dark" />
                          <small>
                            <strong>Classes:</strong>&nbsp;{record.classes}
                          </small>
                        </div>
                      </div>
                      <div className="mb-2 text-truncate">
                        <small>
                          <strong>Columns:</strong>&nbsp;{record.features}
                        </small>
                      </div>
                    </div>
                    {/* Bar Chart with colored bars and legend */}
                    <div className="col-md-4">
                      <div style={{ width: "100%", height: 100 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={distData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                            <XAxis dataKey="name" />
                            <Tooltip formatter={(value, name) => [value, `Class ${name}`]} />
                            <Legend
                              payload={distData.map((entry, index) => ({
                                value: `Class ${entry.name}: ${entry.count}`,
                                type: "square",
                                id: entry.name,
                                color: COLORS[index % COLORS.length]
                              }))}
                              wrapperStyle={{ fontSize: 10 }}
                            />
                            <Bar dataKey="count">
                              {distData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-center mt-1">
                        <small className="text-primary fw-semibold">Distribution</small>
                      </div>
                    </div>
                  </div>
                  <div className="w-100 p-1 card-header mt-2 border rounded">Hardware</div>
                  <div className="row g-2 my-2">
                    <div className="col-6 d-flex align-items-center">
                      <FiCpu className="me-2 text-primary" />
                      <small title={record.id} className="text-truncate">
                        <strong>Physical cores</strong>&nbsp;{record.cpu_physical_cores}
                      </small>
                    </div>
                    <div className="col-6 d-flex align-items-center">
                      <FiCpu className="me-2 text-primary" />
                      <small title={record.id} className="text-truncate">
                        <strong>logical cores</strong>&nbsp;{record.cpu_logical_cores}
                      </small>
                    </div>
                  </div>
                  <div className="row g-2 my-2">
                    <div className="col-6 d-flex align-items-center">
                      <FaMemory className="me-2 text-primary" />
                      <small title={record.id} className="text-truncate">
                        <strong>Total Memory</strong>&nbsp;{record.total_memory_gb} GB
                      </small>
                    </div>
                    <div className="col-6 d-flex align-items-center">
                      <BsGpuCard className="me-2 text-primary" />
                      <small title={record.id} className="text-truncate">
                        <strong>Number of GPUs</strong>&nbsp;{record.gpu_count}
                      </small>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
