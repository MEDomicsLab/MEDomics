import { IoClose } from "react-icons/io5"
import { FaWindows, FaApple } from "react-icons/fa"
import { FcLinux } from "react-icons/fc"

export default function ClientInfos({ device, onClose }) {
  const getOsIcon = () => {
    const os = device.os.toLowerCase()
    if (os.includes("win")) return <FaWindows style={{ color: "#00adef" }} />
    if (os.includes("mac") || os.includes("apple") || os.includes("darwin")) return <FaApple />
    if (os.includes("linux")) return <FcLinux />
    return null
  }

  return (
    <div
      style={{
        width: "300px",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        position: "relative"
      }}
    >
     

      {/* Card Content */}
      <div style={{ padding: "10px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            borderBottom: "1px solid #e9ecef",
            paddingBottom: "16px"
          }}
        >
          <div>
            {/* <h3
              style={{
                margin: 0,
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#212529"
              }}
            >
              {device.hostname}
            </h3> */}
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.75rem",
                color: "#6c757d",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}
            >
              Device Summary
            </p>
          </div>
          <div style={{ fontSize: "24px" }}>{getOsIcon()}</div>
        </div>

        {/* Details List */}
        <div
          style={{
            display: "grid",
            gap: "12px",
            marginBottom: "20px"
          }}
        >
          {[
            { label: "Client ID", value: device.id },
            { label: "Last Active", value: new Date(device.lastSeen).toLocaleString() },
            { label: "Expiration Date", value: new Date(device.expires).toDateString() },
            { label: "OS Version", value: device.os },
            // { label: "Client Version", value: device.clientVersion },
            // {
            //   label: "Authorization Status",
            //   value: device.authorized ? "Authorized" : "Unauthorized",
            //   style: { color: device.authorized ? "#198754" : "#dc3545", fontWeight: 500 }
            // },
            // {
            //   label: "Network Type",
            //   value: device.isExternal ? "External" : "Internal",
            //   style: { color: "#0d6efd", fontWeight: 500 }
            // },
            // { label: "Associated User", value: device.user }
          ].map((item, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline"
              }}
            >
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "#6c757d",
                  fontWeight: 500
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "#212529",
                  maxWidth: "60%",
                  textAlign: "right",
                  ...item.style
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Address Section */}
        <div
          style={{
            borderTop: "1px solid #e9ecef",
            paddingTop: "16px"
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              color: "#6c757d",
              textTransform: "uppercase",
              marginBottom: "8px",
              fontWeight: 600,
              letterSpacing: "0.5px"
            }}
          >
            Network Addresses
          </div>
          <div
            style={{
              backgroundColor: "#f8f9fa",
              borderRadius: "6px",
              padding: "12px"
            }}
          >
            {device.addresses.map((address, index) => (
              <div
                key={index}
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  color: "#495057",
                  padding: "4px 0",
                  borderBottom: index !== device.addresses.length - 1 ? "1px solid #e9ecef" : "none"
                }}
              >
                {address}
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {}}
          style={{
            width: "100%",
            marginTop: "20px",
            padding: "10px 16px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background-color 0.15s ease-in-out",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#bb2d3b")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#dc3545")}
        >
          Revoke Client Access
        </button>
      </div>
    </div>
  )
}
