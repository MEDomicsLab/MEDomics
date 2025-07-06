import React, { useState, useEffect } from "react"

const RoundMonitor = ({ clientEvalMetrics, roundResults, connectedClients, totalRounds }) => {
  const [currentRound, setCurrentRound] = useState(1)
  const [roundStatus, setRoundStatus] = useState("collecting")
  const [clientMetrics, setClientMetrics] = useState([])
  const [aggregationData, setAggregationData] = useState(null)
  const [roundHistory, setRoundHistory] = useState([])
  const [performanceChartData, setPerformanceChartData] = useState({})

  // Track round progress and metrics
  useEffect(() => {
    // Filter metrics for current round
    const roundMetrics = clientEvalMetrics.filter((m) => m.round === currentRound)
    setClientMetrics(roundMetrics)

    // Check if all clients have reported
    if (roundMetrics.length >= connectedClients.length) {
      setRoundStatus("aggregating")
    }

    // Check if aggregation is complete
    const roundAggregation = roundResults.find((r) => r.round === currentRound)
    if (roundAggregation) {
      setAggregationData(roundAggregation)
      setRoundStatus("completed")

      // Update round history
      setRoundHistory((prev) => [
        ...prev,
        {
          round: currentRound,
          clientMetrics: [...roundMetrics],
          aggregation: roundAggregation
        }
      ])
    }
  }, [clientEvalMetrics, roundResults, currentRound, connectedClients])

  // Prepare chart data whenever history changes
  useEffect(() => {
    const accuracyData = []
    const lossData = []
    const aucData = []

    roundHistory.forEach((round) => {
      accuracyData.push({
        round: round.round,
        value: round.aggregation.accuracy
      })

      lossData.push({
        round: round.round,
        value: round.aggregation.loss
      })

      aucData.push({
        round: round.round,
        value: round.aggregation.auc
      })
    })

    setPerformanceChartData({
      accuracy: accuracyData,
      loss: lossData,
      auc: aucData
    })
  }, [roundHistory])

  // Move to next round when aggregation is complete
  useEffect(() => {
    if (roundStatus === "completed" && currentRound < totalRounds) {
      const timer = setTimeout(() => {
        setCurrentRound(currentRound + 1)
        setRoundStatus("collecting")
        setAggregationData(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [roundStatus, currentRound, totalRounds])

  // Calculate delta from previous round
  const calculateDelta = (metric) => {
    if (roundHistory.length < 2) return null

    const prevRound = roundHistory[roundHistory.length - 2]
    const currentValue = aggregationData[metric]
    const prevValue = prevRound.aggregation[metric]

    const delta = currentValue - prevValue
    return {
      value: delta,
      isPositive: delta > 0,
      percentage: Math.abs((delta / prevValue) * 100).toFixed(2)
    }
  }

  // Get client name from ID
  const getClientName = (clientId) => {
    const client = connectedClients.find((c) => c.id === clientId)
    return client?.name || clientId
  }

  // Progress percentage calculation
  const progressPercentage = Math.min(Math.round((clientMetrics.length / connectedClients.length) * 100), 100)

  // Overall training progress
  const trainingProgress = Math.min(Math.round((currentRound / totalRounds) * 100), 100)

  return (
    <div style={styles.container}>
      {/* Training overview header */}
      <div style={styles.trainingHeader}>
        <div>
          <h2 style={styles.trainingTitle}>Federated Training Session</h2>
          <div style={styles.trainingMeta}>
            <span>
              Round {currentRound} of {totalRounds}
            </span>
            <span>•</span>
            <span>{connectedClients.length} Clients Connected</span>
          </div>
        </div>

        <div style={styles.trainingProgress}>
          <div style={styles.progressBar(trainingProgress)}>
            <div style={styles.progressFill(trainingProgress)} />
          </div>
          <div style={styles.progressText}>{trainingProgress}% Complete</div>
        </div>
      </div>

      {/* Current round tracking */}
      <div style={styles.roundContainer}>
        <div style={styles.roundHeader}>
          <div style={styles.roundInfo}>
            <h2 style={styles.roundTitle}>Round {currentRound}</h2>
            <div style={styles.statusBadge(roundStatus)}>{roundStatus.charAt(0).toUpperCase() + roundStatus.slice(1)}</div>
          </div>

          <div style={styles.progressContainer}>
            <div style={styles.progressBar(progressPercentage)}>
              <div style={styles.progressFill(trainingProgress)} />
            </div>
            <div style={styles.progressText}>
              {clientMetrics.length}/{connectedClients.length} clients reported
            </div>
          </div>
        </div>

        {roundStatus !== "completed" ? (
          <div style={styles.clientMetricsContainer}>
            <h3 style={styles.sectionTitle}>Client Evaluation Metrics</h3>
            <div style={styles.metricsGrid}>
              {connectedClients.map((client) => {
                const metric = clientMetrics.find((m) => m.clientId === client.id)
                return (
                  <div key={client.id} style={styles.clientCard}>
                    <div style={styles.clientHeader}>
                      <div style={styles.clientIcon}>{renderOsIcon(client.os)}</div>
                      <div style={styles.clientName}>{client.name || client.id}</div>
                      {metric ? <div style={styles.statusIndicatorActive} /> : <div style={styles.statusIndicatorPending} />}
                    </div>

                    {metric ? (
                      <div style={styles.metricsData}>
                        <div style={styles.metricItem}>
                          <span style={styles.metricLabel}>Accuracy:</span>
                          <span style={styles.metricValue}>{metric.accuracy.toFixed(2)}%</span>
                        </div>
                        <div style={styles.metricItem}>
                          <span style={styles.metricLabel}>AUC:</span>
                          <span style={styles.metricValue}>{metric.auc.toFixed(3)}</span>
                        </div>
                        <div style={styles.metricItem}>
                          <span style={styles.metricLabel}>Loss:</span>
                          <span style={styles.metricValue}>{metric.loss.toFixed(4)}</span>
                        </div>
                        <div style={styles.metricTimestamp}>Reported: {new Date(metric.timestamp).toLocaleTimeString()}</div>
                      </div>
                    ) : (
                      <div style={styles.metricsPending}>
                        <div style={styles.spinner} />
                        <span>Awaiting metrics...</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={styles.aggregationContainer}>
            <div style={styles.aggregationCard}>
              <h3 style={styles.sectionTitle}>Round {currentRound} Aggregation Results</h3>

              <div style={styles.aggregationMetrics}>
                <div style={styles.aggMetricCard}>
                  <div style={styles.aggMetricLabel}>Accuracy</div>
                  <div style={styles.aggMetricValue}>{aggregationData.accuracy.toFixed(2)}%</div>
                  {calculateDelta("accuracy") && (
                    <div style={styles.aggMetricDelta}>
                      <span style={calculateDelta("accuracy").isPositive ? styles.deltaPositive : styles.deltaNegative}>
                        {calculateDelta("accuracy").isPositive ? "↑" : "↓"}
                        {Math.abs(calculateDelta("accuracy").value).toFixed(2)}% ({calculateDelta("accuracy").percentage}%)
                      </span>{" "}
                      from previous
                    </div>
                  )}
                </div>

                <div style={styles.aggMetricCard}>
                  <div style={styles.aggMetricLabel}>AUC Score</div>
                  <div style={styles.aggMetricValue}>{aggregationData.auc.toFixed(3)}</div>
                  {calculateDelta("auc") && (
                    <div style={styles.aggMetricDelta}>
                      <span style={calculateDelta("auc").isPositive ? styles.deltaPositive : styles.deltaNegative}>
                        {calculateDelta("auc").isPositive ? "↑" : "↓"}
                        {Math.abs(calculateDelta("auc").value).toFixed(3)}
                      </span>{" "}
                      from previous
                    </div>
                  )}
                </div>

                <div style={styles.aggMetricCard}>
                  <div style={styles.aggMetricLabel}>Loss</div>
                  <div style={styles.aggMetricValue}>{aggregationData.loss.toFixed(4)}</div>
                  {calculateDelta("loss") && (
                    <div style={styles.aggMetricDelta}>
                      <span style={calculateDelta("loss").isPositive ? styles.deltaNegative : styles.deltaPositive}>
                        {calculateDelta("loss").isPositive ? "↑" : "↓"}
                        {Math.abs(calculateDelta("loss").value).toFixed(4)}
                      </span>{" "}
                      from previous
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.aggregationDetails}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Round Duration:</span>
                  <span style={styles.detailValue}>{aggregationData.timeTaken}s</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Clients Trained:</span>
                  <span style={styles.detailValue}>{aggregationData.clientsTrained}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Completed At:</span>
                  <span style={styles.detailValue}>{new Date(aggregationData.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              {currentRound < totalRounds ? (
                <div style={styles.nextRoundNotice}>Next round starting in 5 seconds...</div>
              ) : (
                <div style={styles.trainingComplete}>
                  <i className="material-icons" style={styles.completeIcon}>
                    check_circle
                  </i>
                  <div>Training Complete!</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Performance history chart */}
      {roundHistory.length > 0 && (
        <div style={styles.chartContainer}>
          <h3 style={styles.sectionTitle}>Performance History</h3>
          <div style={styles.chartArea}>
            <div style={styles.chart}>
              <div style={styles.chartHeader}>Accuracy</div>
              <div style={styles.chartContent}>
                {performanceChartData.accuracy?.map((point, idx) => (
                  <div key={idx} style={styles.chartPoint}>
                    <div style={styles.chartValue}>{point.value.toFixed(2)}%</div>
                    <div style={styles.chartRound}>R{point.round}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.chart}>
              <div style={styles.chartHeader}>Loss</div>
              <div style={styles.chartContent}>
                {performanceChartData.loss?.map((point, idx) => (
                  <div key={idx} style={styles.chartPoint}>
                    <div style={styles.chartValue}>{point.value.toFixed(4)}</div>
                    <div style={styles.chartRound}>R{point.round}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.chart}>
              <div style={styles.chartHeader}>AUC</div>
              <div style={styles.chartContent}>
                {performanceChartData.auc?.map((point, idx) => (
                  <div key={idx} style={styles.chartPoint}>
                    <div style={styles.chartValue}>{point.value.toFixed(3)}</div>
                    <div style={styles.chartRound}>R{point.round}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Styles (extending your existing styles)
const styles = {
  container: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    overflow: "hidden",
    marginBottom: "2rem",
    transition: "all 0.3s ease"
  },
  trainingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.5rem",
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #edf2f7"
  },
  trainingTitle: {
    fontSize: "1.5rem",
    fontWeight: "600",
    margin: "0 0 0.25rem",
    color: "#2d3748"
  },
  trainingMeta: {
    display: "flex",
    gap: "0.75rem",
    color: "#718096",
    fontSize: "0.95rem"
  },
  trainingProgress: {
    width: "30%",
    minWidth: "250px"
  },
  roundContainer: {
    padding: "1.5rem"
  },
  roundHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem"
  },
  roundInfo: {
    display: "flex",
    alignItems: "center",
    gap: "1rem"
  },
  roundTitle: {
    fontSize: "1.5rem",
    fontWeight: "600",
    margin: "0",
    color: "#2d3748"
  },
  statusBadge: (status) => ({
    padding: "0.35rem 1rem",
    borderRadius: "20px",
    fontWeight: "500",
    fontSize: "0.85rem",
    backgroundColor: status === "completed" ? "#e6f4ea" : status === "aggregating" ? "#fef6e9" : "#e8f0fe",
    color: status === "completed" ? "#137333" : status === "aggregating" ? "#b54708" : "#1a73e8"
  }),
  progressContainer: {
    width: "40%",
    minWidth: "300px"
  },
  progressBar: (percentage) => ({
    height: "8px",
    backgroundColor: "#e2e8f0",
    borderRadius: "4px",
    overflow: "hidden",
    position: "relative"
  }),
  progressFill: (percentage) => ({
    height: "100%",
    backgroundColor: "#4299e1",
    width: `${percentage}%`,
    borderRadius: "4px",
    transition: "width 0.5s ease"
  }),
  progressText: {
    textAlign: "right",
    fontSize: "0.9rem",
    color: "#718096",
    marginTop: "0.5rem"
  },
  clientMetricsContainer: {
    marginTop: "1rem"
  },
  sectionTitle: {
    fontSize: "1.1rem",
    fontWeight: "600",
    margin: "0 0 1.5rem",
    color: "#2d3748"
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "1.5rem"
  },
  clientCard: {
    backgroundColor: "#fff",
    borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
    border: "1px solid #edf2f7",
    overflow: "hidden",
    transition: "transform 0.2s",
    ":hover": {
      transform: "translateY(-3px)"
    }
  },
  clientHeader: {
    display: "flex",
    alignItems: "center",
    padding: "1rem",
    backgroundColor: "#f9fafc",
    borderBottom: "1px solid #edf2f7"
  },
  clientIcon: {
    marginRight: "0.75rem",
    fontSize: "1.25rem",
    color: "#4a5568"
  },
  clientName: {
    fontWeight: "500",
    flex: 1
  },
  statusIndicatorActive: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: "#48bb78"
  },
  statusIndicatorPending: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: "#ecc94b"
  },
  metricsData: {
    padding: "1rem"
  },
  metricItem: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "0.75rem"
  },
  metricLabel: {
    color: "#718096",
    fontSize: "0.9rem"
  },
  metricValue: {
    fontWeight: "500",
    color: "#2d3748"
  },
  metricTimestamp: {
    fontSize: "0.8rem",
    color: "#a0aec0",
    textAlign: "right",
    marginTop: "1rem"
  },
  metricsPending: {
    padding: "1.5rem",
    textAlign: "center",
    color: "#a0aec0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem"
  },
  spinner: {
    width: "24px",
    height: "24px",
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #4299e1",
    borderRadius: "50%",
    animation: "spin 1s linear infinite"
  },
  aggregationContainer: {
    marginTop: "1rem",
    display: "flex",
    justifyContent: "center"
  },
  aggregationCard: {
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    padding: "2rem",
    width: "100%",
    boxShadow: "0 4px 6px rgba(0,0,0,0.03)"
  },
  aggregationMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "1.5rem",
    marginBottom: "2rem"
  },
  aggMetricCard: {
    backgroundColor: "#fff",
    borderRadius: "10px",
    padding: "1.5rem",
    textAlign: "center",
    boxShadow: "0 2px 5px rgba(0,0,0,0.03)"
  },
  aggMetricLabel: {
    fontSize: "1rem",
    color: "#718096",
    marginBottom: "0.5rem"
  },
  aggMetricValue: {
    fontSize: "1.8rem",
    fontWeight: "600",
    color: "#2d3748",
    marginBottom: "0.5rem"
  },
  aggMetricDelta: {
    fontSize: "0.9rem",
    color: "#718096"
  },
  deltaPositive: {
    color: "#38a169",
    fontWeight: "500"
  },
  deltaNegative: {
    color: "#e53e3e",
    fontWeight: "500"
  },
  aggregationDetails: {
    backgroundColor: "#fff",
    borderRadius: "8px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
    border: "1px solid #edf2f7"
  },
  detailItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.5rem 0",
    borderBottom: "1px solid #f0f4f8",
    ":last-child": {
      borderBottom: "none"
    }
  },
  detailLabel: {
    color: "#718096"
  },
  detailValue: {
    fontWeight: "500",
    color: "#2d3748"
  },
  nextRoundNotice: {
    textAlign: "center",
    padding: "1rem",
    backgroundColor: "#ebf8ff",
    color: "#3182ce",
    borderRadius: "6px",
    fontWeight: "500"
  },
  trainingComplete: {
    textAlign: "center",
    padding: "1.5rem",
    backgroundColor: "#e6f4ea",
    color: "#137333",
    borderRadius: "6px",
    fontWeight: "500",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem"
  },
  completeIcon: {
    fontSize: "2.5rem",
    color: "#137333"
  },
  chartContainer: {
    padding: "1.5rem",
    borderTop: "1px solid #edf2f7"
  },
  chartArea: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "1.5rem"
  },
  chart: {
    backgroundColor: "#f9fafc",
    borderRadius: "8px",
    padding: "1rem",
    border: "1px solid #e2e8f0"
  },
  chartHeader: {
    fontWeight: "600",
    marginBottom: "1rem",
    textAlign: "center"
  },
  chartContent: {
    display: "flex",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: "120px"
  },
  chartPoint: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  chartValue: {
    fontWeight: "500",
    marginBottom: "0.25rem"
  },
  chartRound: {
    fontSize: "0.75rem",
    color: "#718096"
  },
  "@keyframes spin": {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" }
  }
}

// Helper to render OS icons (implement based on your icon library)
const renderOsIcon = (os) => {
  // Your implementation here
  return <div>🖥️</div>
}

export default RoundMonitor
