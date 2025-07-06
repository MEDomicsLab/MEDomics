import React, { useState, useEffect, useContext } from "react"

import Table from "react-bootstrap/Table"
import Card from "react-bootstrap/Card"
import Button from "react-bootstrap/Button"
import { FaWindows } from "react-icons/fa"
import { FcLinux } from "react-icons/fc"
import { FaApple } from "react-icons/fa"
import Badge from "react-bootstrap/Badge"

export default function ClientsTables({ devices }) {
    useEffect(() => {
    }
    , [devices.length]);
      const formatDate = (dateString) =>
        new Date(dateString).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
    
      const truncateAddress = (address) => (address.length > 15 ? `${address.substring(0, 12)}...` : address)
    
      const getStatusBadges = (device) => {
        const badges = []
        if (!device.authorized) badges.push("danger")
        if (device.updateAvailable) badges.push("warning")
        if (device.keyExpiryDisabled) badges.push("primary")
    
        return badges.map((variant, index) => (
          <Badge key={index} bg={variant} className="me-1 mb-1 text-uppercase" style={{ fontSize: "0.75em" }}>
            {variant === "danger" ? "Unauthorized" : variant === "warning" ? "Update Available" : "Key Expiry Disabled"}
          </Badge>
        ))
      }
  return (
    <div>
         <Card className="shadow-sm border-0" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',}}>
                    <Card.Header className="bg-light border-0">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h5 className="mb-0 text-dark">Connected Devices</h5>
                          <small className="text-muted">Last updated: {String(new Date())} ago</small>
                        </div>
                        <Button variant="outline-secondary" size="sm">
                          Refresh
                        </Button>
                      </div>
                    </Card.Header>
        
                    <div className="table-responsive">
                      <Table hover className="mb-0">
                        <thead className="bg-light">
                          <tr>
                            <th>Device</th>
                            <th style={{ paddingLeft: "17px" }}>OS</th>
                            <th>IP Addresses</th>
                            <th>User</th>
                            <th>Last Activity</th>
                            <th>Version</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {devices.map((device) => (
                            <tr key={device.id}>
                              {/* Device Info */}
                              <td>
                                <div className="d-flex align-items-center">
                                  <div>
                                    <div className="fw-semibold">{device.hostname}</div>
                                    <small className="text-muted">{device.nodeId}</small>
                                  </div>
                                </div>
                              </td>
        
                              {/* OS */}
                              <td>
                                <div className="d-flex align-items-center">
                                  <i className={`bi me-2 ${device.os === "windows" ? "bi-windows text-primary" : "bi-terminal-fill text-success"}`}></i>
                                  <span className="text-capitalize text-center">
                                    {device.os == "windows" ? <FaWindows style={{ color: "#357EC7" }} size={25}></FaWindows> : device.os == "linux" ? <FcLinux size={30}></FcLinux> : <FaApple></FaApple>}
                                  </span>
                                </div>
                              </td>
        
                              {/* IP Addresses */}
                              <td>
                                {device.addresses.map((address, index) => (
                                  <div key={index} className="mb-1">
                                    <code className="bg-light p-1 rounded" title={address}>
                                      {truncateAddress(address)}
                                    </code>
                                  </div>
                                ))}
                              </td>
        
                              {/* User */}
                              <td className="text-nowrap">
                                <span className="text-dark">{device.user.split("@")[0]}</span>
                              </td>
        
                              {/* Last Activity */}
                              <td>
                                <div className="text-dark">{formatDate(device.lastSeen)}</div>
                                <small className="text-muted">Expires {formatDate(device.expires)}</small>
                              </td>
        
                              {/* Version */}
                              <td>
                                <code>{device.clientVersion.split("-")[0]}</code>
                              </td>
        
                              {/* Status */}
                              <td>
                                <div className="d-flex flex-wrap gap-1">{getStatusBadges(device)}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                    <Card.Footer className="bg-light border-0">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="text-muted">Showing {devices.length} devices</div>
                        <div className="d-flex gap-2">
                          <Button variant="outline-secondary" size="sm">
                            Previous
                          </Button>
                          <Button variant="outline-secondary" size="sm">
                            Next
                          </Button>
                        </div>
                      </div>
                    </Card.Footer>
                  </Card>
    </div>
  )
}
