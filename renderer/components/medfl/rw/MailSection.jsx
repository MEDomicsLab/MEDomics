import React, { useState, useEffect, useContext } from "react"
import { FiMail, FiPaperclip, FiSend } from "react-icons/fi"
import { Modal } from "react-bootstrap"
import { requestBackend } from "../../../utilities/requests"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { FaFileAlt } from "react-icons/fa"

const EmailSection = ({ show, onHide, script, os }) => {
  const [recipients, setRecipients] = useState([])
  const [subject, setSubject] = useState("Installation Script")
  const [body, setBody] = useState("Please find attached the installation script.")
  const [attachment, setAttachment] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)
  const [currentEmail, setCurrentEmail] = useState("")

  const { port } = useContext(WorkspaceContext)

  const handleAttachmentChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0])
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setIsSending(true)

    sendMail()
  }
  const sendMail = () => {
    requestBackend(
      port,
      "/medfl/send-mail/",
      {
        fileContentBase64: btoa(script),
        filename: os === "windows" ? "script.bat" : "script.sh",
        subject: subject,
        body: body,
        recipients: recipients
      },
      (json) => {
        if (json.error) toast.error("Error: " + json.error)
        else {
          console.log(json)
          setIsSending(false)
          setSentSuccess(true)
        }
      },
      (err) => {
        console.error(err)
      }
    )
  }

  const styles = {
    container: {
      backgroundColor: "#ffffff",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
      border: "1px solid #eaeaea",
      padding: "1.5rem",
      margin: "0 auto",
      width: "70%",
      height: "300px",
      overflow: "auto"
    },
    header: {
      display: "flex",
      alignItems: "center",
      marginBottom: "1.5rem",
      paddingBottom: "0.75rem",
      borderBottom: "1px solid #f0f0f0"
    },
    title: {
      fontSize: "1.25rem",
      fontWeight: "600",
      margin: "0",
      display: "flex",
      alignItems: "center"
    },
    icon: {
      marginRight: "0.75rem",
      fontSize: "1.5rem",
      color: "#3b82f6"
    },
    formGroup: {
      marginBottom: "1.25rem"
    },
    label: {
      display: "block",
      marginBottom: "0.5rem",
      fontWeight: "500",
      color: "#333",
      fontSize: "0.9rem"
    },
    input: {
      width: "100%",
      padding: "0.5rem",
      backgroundColor: "#fff",
      border: "1px solid #ddd",
      borderRadius: "4px",
      fontSize: "0.9rem",
      transition: "border-color 0.2s"
    },
    textarea: {
      width: "100%",
      padding: "0.75rem",
      backgroundColor: "#fff",
      border: "1px solid #ddd",
      borderRadius: "4px",
      fontSize: "0.9rem",
      minHeight: "120px",
      resize: "vertical"
    },

    fileContainer: {
      display: "flex",
      alignItems: "center",
      marginTop: "0.5rem"
    },
    fileButton: {
      display: "inline-flex",
      alignItems: "center",
      padding: "0.5rem 1rem",
      backgroundColor: "#f8f9fa",
      border: "1px solid #ddd",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "0.85rem",
      transition: "background 0.2s"
    },
    fileName: {
      marginLeft: "0.75rem",
      fontSize: "0.85rem",
      color: "#666"
    },
    button: {
      display: "inline-flex",
      alignItems: "center",
      padding: "0.75rem 1.5rem",
      backgroundColor: "#3b82f6",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "0.9rem",
      fontWeight: "500",
      transition: "background 0.2s"
    },
    buttonIcon: {
      marginRight: "0.5rem"
    },
    successMessage: {
      display: "flex",
      alignItems: "center",
      padding: "0.75rem 1rem",
      backgroundColor: "#d1fae5",
      color: "#065f46",
      borderRadius: "4px",
      marginTop: "1rem",
      fontSize: "0.9rem"
    },
    attachmentPreview: {
      display: "flex",
      alignItems: "center",
      padding: "0.75rem",
      backgroundColor: "#f8f9fa",
      borderRadius: "4px",
      marginTop: "1rem",
      border: "1px dashed #ddd"
    },
    attachmentIcon: {
      marginRight: "0.75rem",
      fontSize: "1.25rem",
      color: "#6b7280"
    },
    attachmentInfo: {
      flex: 1
    },
    attachmentName: {
      fontWeight: "500",
      fontSize: "0.9rem"
    },
    attachmentSize: {
      fontSize: "0.8rem",
      color: "#6b7280"
    }
  }

  return (
    <div>
      <Modal show={show} onHide={onHide} size="lg" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">
            {" "}
            <FiMail style={styles.icon} />
            Send script via Email{" "}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <form onSubmit={handleSubmit}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Recipients:</label>
              <div className="d-flex flex-wrap align-items-center gap-2 border  rounded p-1">
                {recipients.map((email, index) => (
                  <span key={index} className="badge bg-primary d-flex align-items-center me-1 mb-1">
                    {email.trim()}
                    <button
                      type="button"
                      className="btn-close btn-close-white btn-sm ms-2"
                      aria-label="Remove"
                      onClick={() => {
                        const updated = recipients.filter((_, i) => i !== index)
                        setRecipients(updated)
                      }}
                    ></button>
                  </span>
                ))}

                <input
                  type="text"
                  className="form-control border-0 flex-grow-1 outline-none"
                  style={{ minWidth: "150px" }}
                  value={currentEmail}
                  onChange={(e) => {
                    const val = e.target.value
                    setCurrentEmail(val)

                    if (val.includes("@") && val.includes(".") && val.endsWith(",")) {
                      const emailToAdd = val.slice(0, -1).trim()
                      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToAdd)

                      if (emailToAdd && validEmail && !recipients.includes(emailToAdd)) {
                        setRecipients([...recipients, emailToAdd])
                        setCurrentEmail("")
                      }
                     
                    }
                  }}
                  placeholder="Add recipient..."
                />
              </div>

              <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>Separate multiple emails with commas</div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Subject:</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={styles.input} required />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Message:</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} style={styles.textarea} required />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Attachment:</label>
              <div style={styles.fileContainer}>
                <label style={styles.fileButton}>
                  <FaFileAlt style={{ marginRight: "0.5rem" }} />
                  {
                    os === "windows" ? "script.bat" : "script.sh"
                  }
                  <input type="file" onChange={handleAttachmentChange} style={{ display: "none" }} />
                </label>
                {attachment && (
                  <div style={styles.fileName}>
                    {attachment.name} ({Math.round(attachment.size / 1024)} KB)
                  </div>
                )}
              </div>

              {attachment && (
                <div style={styles.attachmentPreview}>
                  <FiPaperclip style={styles.attachmentIcon} />
                  <div style={styles.attachmentInfo}>
                    <div style={styles.attachmentName}>{attachment.name}</div>
                    <div style={styles.attachmentSize}>
                      {Math.round(attachment.size / 1024)} KB · {attachment.type}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" style={styles.button} disabled={isSending}>
              {isSending ? (
                "Sending..."
              ) : (
                <>
                  <FiSend style={styles.buttonIcon} />
                  Send Email
                </>
              )}
            </button>

            {sentSuccess && (
              <div style={styles.successMessage}>
                <FiMail style={{ marginRight: "0.5rem" }} />
                Email sent successfully!
              </div>
            )}
          </form>
        </Modal.Body>
        <Modal.Footer></Modal.Footer>
      </Modal>
    </div>
  )
}

export default EmailSection
