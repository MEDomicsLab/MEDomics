import React from "react"

export default function ProgressTable({ title, currentRound, roundResults, serverRunning }) {
  const styles = {
    roundProgressContainer: {
      // backgroundColor: "#f8f9fa",
      borderRadius: "8px",
      border: "1px solid #e9ecef",
      overflow: "hidden",
      height: "440px",
      overflowY: "auto"
    },
    sectionHeader: {
      padding: "1rem",
      backgroundColor: "#f8f9fa",
      borderBottom: "1px solid #e9ecef",
      fontWeight: "500",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    roundHeader: {
      display: "flex",
      alignItems: "center",
      padding: "1rem",
      backgroundColor: "#f8f9fa",
      borderBottom: "1px solid #e9ecef"
    },
    roundBadge: {
      backgroundColor: "#007bff",
      color: "white",
      borderRadius: "20px",
      padding: "0.25rem 0.75rem",
      fontSize: "0.85rem",
      fontWeight: "500",
      marginRight: "1rem"
    },
    roundContent: {
      padding: "1rem",
      backgroundColor: "#fff"
    },
    resultsTable: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "0.85rem",
      maxHeight: "300px",
      overflowY: "auto"
    },
    tableHeader: {
      backgroundColor: "#f0f0f0",
      textAlign: "left",
      padding: "0.5rem"
    },
    tableCell: {
      padding: "0.5rem",
      borderBottom: "1px solid #f0f0f0"
    }
  }

  return (
    <div style={styles.roundProgressContainer}>
      <div style={styles.sectionHeader}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {currentRound > 0 && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={styles.roundBadge}>
              Round {currentRound} of {numRounds}
            </div>
            <div style={{ color: "#28a745", fontWeight: "500" }}>{Math.round((currentRound / numRounds) * 100)}%</div>
          </div>
        )}
      </div>
      <div style={styles.roundContent}>
        {roundResults.length > 0 ? (
          <table style={styles.resultsTable}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>Round</th>
                <th style={styles.tableHeader}>Loss</th>
                <th style={styles.tableHeader}>Accuracy</th>
                <th style={styles.tableHeader}>AUC</th>
                <th style={styles.tableHeader}>Clients</th>
                <th style={styles.tableHeader}>Time (s)</th>
              </tr>
            </thead>
            <tbody>
              {roundResults.map((result, index) => (
                <tr key={index}>
                  <td style={styles.tableCell}>{result.round}</td>
                  <td style={styles.tableCell}>{result.loss}</td>
                  <td style={styles.tableCell}>{result.accuracy}%</td>
                  <td style={styles.tableCell}>{result.auc}</td>
                  <td style={styles.tableCell}>{result.clientsTrained}</td>
                  <td style={styles.tableCell}>{result.timeTaken}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "#6c757d"
            }}
          >
            {serverRunning ? "Waiting for first round..." : "Start server to begin training"}
          </div>
        )}
      </div>
    </div>
  )
}
