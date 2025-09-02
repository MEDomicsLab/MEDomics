import React, { useRef } from "react"
import { FaDesktop, FaLaptop, FaServer, FaMobile, FaChevronLeft, FaChevronRight } from "react-icons/fa"
import { FaApple, FaLinux, FaWindows } from "react-icons/fa6"

const ClientConnectionPanel = ({ connectedClients, minAvailableClients }) => {
  const scrollRef = useRef(null)

  // OS to icon mapping
  const renderOsIcon = (os) => {
    const osLower = os.toLowerCase()
    if (osLower.includes("windows")) return <FaWindows className="text-primary" />
    if (osLower.includes("mac")) return <FaApple className="text-secondary" />
    if (osLower.includes("linux")) return <FaLinux className="text-success" />
    return <FaLaptop className="text-secondary" />
  }

  // Scroll handlers
  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: "smooth" })
    }
  }

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: "smooth" })
    }
  }

  return (
    <div className="client-panel-container p-2 bg-white rounded-3 ">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="fw-bold mb-0">Connected Clients</h3>
          <div className="d-flex align-items-center mt-2">
            <span className="badge bg-success me-2">{connectedClients.length} Active</span>
            <span className="badge bg-light text-dark border">{minAvailableClients} Total</span>
          </div>
        </div>

        <div className="d-flex">
          <button className="btn btn-sm btn-outline-secondary me-2" onClick={scrollLeft}>
            <FaChevronLeft />
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={scrollRight}>
            <FaChevronRight />
          </button>
        </div>
      </div>

      {connectedClients.length > 0 ? (
        <div className="position-relative">
          <div ref={scrollRef} className="clients-carousel d-flex overflow-auto py-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {connectedClients.map((client) => (
              <div key={client.id} className="client-card d-flex flex-shrink-0 me-3 p-3 rounded border" style={{ minWidth: "220px" , maxHeight: "70px" }}>
                <div className="d-flex align-items-center ">
                  <div className="client-icon bg-light rounded-circle p-3 me-3">{renderOsIcon(client.os)}</div>
      
                </div>

                <div className="client-info">
                  <h6 className="fw-bold mb-1 text-truncate small">{client.hostname || client.id}</h6>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted small">{client.os}</span>
                    <span className="badge bg-success bg-opacity-10 text-success small">Active</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 bg-light rounded">
          <div className="mb-3">
            <FaDesktop className="text-muted" size={40} />
          </div>
          <h5 className="text-muted">No clients connected</h5>
          <p className="text-muted small mb-0">Waiting for client connections...</p>
        </div>
      )}
    </div>
  )
}

export default ClientConnectionPanel
