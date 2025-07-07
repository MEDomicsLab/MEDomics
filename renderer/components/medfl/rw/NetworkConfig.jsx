import React, { useContext, useEffect, useState } from "react"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { requestBackend } from "../../../utilities/requests"
import { FaLinux, FaWindows, FaApple, FaServer, FaLaptop, FaNetworkWired, FaSyncAlt } from "react-icons/fa"
import { FcLinux, FcSettings } from "react-icons/fc"

function getOSIcon(os) {
  const osName = os?.toLowerCase()
  if (!osName) return <FaLaptop className="text-secondary" />
  if (osName.includes("linux")) return <FcLinux size={25} />
  if (osName.includes("windows")) return <FaWindows style={{ color: "#357EC7" }} />
  if (osName.includes("mac")) return <FaApple />
  return <FaLaptop className="text-secondary" />
}

export default function FederatedNetworkConfigView({ config, setDevices }) {
  const { pageId } = useContext(PageInfosContext)
  const { port } = useContext(WorkspaceContext)

  const [clients, setClients] = useState(null)
  const [server, setServer] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  console.log("FederatedNetworkConfigView config:", config)
  useEffect(() => {
    const fetchDevices = () => {
      setIsLoading(true)
      requestBackend(
        port,
        "/medfl/devices/" + pageId,
        {},
        (json) => {
          if (json.error) console.error("Error: " + json.error)
          else {
            let server = json.devices.find((d) => (d.tags || []).includes("tag:server"))
            let clientsList = json.devices.filter((d) => !(d.tags || []).includes("tag:server"))
            setClients(clientsList)
            setServer(server)
            setDevices({
              server: server,
              clients: clientsList
            })
          }
          setIsLoading(false)
        },
        (err) => {
          console.error(err)
          setIsLoading(false)
        }
      )
    }

    !clients && fetchDevices()
  }, [pageId, port])

  return (
    <div className="p-2">
      {/* <div className="d-flex align-items-center mb-4">
        <FaNetworkWired className="fs-2  me-2" />
        <h4 className="mb-0">Federated Network Configuration</h4>
      </div> */}

      {isLoading ? (
        <div className="text-center py-4">
          <div className="spinner-border " role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 mb-0">Loading network configuration...</p>
        </div>
      ) : (
        <>
          {/* Server Info */}
          {server && (
            <div className="mb-4">
              <h5 className="d-flex align-items-center mb-3">
                <FaServer className="me-2" />
                Server
              </h5>
              <div className="d-flex align-items-center border rounded p-2 bg-white " style={{ width: "fit-content" }}>
                <div className="me-3 fs-4">{getOSIcon(server.os)}</div>
                <div>
                  <div>
                    <strong>{server.name}</strong>
                  </div>
                  <div className="text-muted small">{server.addresses[0]}</div>
                </div>
              </div>
            </div>
          )}

          {/* Clients Info */}
          <div className="mb-4">
            <h5 className="d-flex align-items-center mb-3">
              <FaLaptop className="me-2" />
              Clients <span className="badge bg-secondary ms-2">{clients?.length || 0}</span>
            </h5>
            <div className="d-flex gap-4 g-3">
              {clients?.length > 0 ? (
                clients?.map((client, index) => (
                  <div className=" mb-2 " key={index}>
                    <div className="d-flex align-items-center border rounded p-2 pe-4 bg-white" style={{ width: "fit-content" }}>
                      <div className="me-3 fs-5">{getOSIcon(client.os)}</div>
                      <div>
                        <div>
                          <strong>{client.name}</strong>
                        </div>
                        <div className="text-muted small">{client.addresses[0]}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-12">
                  <div className="alert alert-warning mb-0">No client devices found</div>
                </div>
              )}
            </div>
          </div>

          {/* Strategy Info */}
          <div className="card ">
            <div className="card-header  d-flex align-items-center">
              <FcSettings className="me-2" />
              <span> Configuration</span>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="d-flex align-items-center mb-2">
                    <span className="fw-bold me-2">Strategy:</span>
                    <span className="badge bg-primary">{config.server.strategy}</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center">
                    <span className="fw-bold me-2">Rounds:</span>
                    <span className="badge bg-success">{config.server.rounds}</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center">
                    <span className="fw-bold me-2">Activate transfer learning:</span>
                    <span className="badge bg-success">{config.model.activateTl}</span>
                  </div>
                </div>
                {config.model.activateTl == "true" && (
                  <div className="col-md-6">
                    <div className="d-flex align-items-center">
                      <span className="fw-bold me-2">Pretrained model:</span>
                      <span className="">{config.model.file?.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
