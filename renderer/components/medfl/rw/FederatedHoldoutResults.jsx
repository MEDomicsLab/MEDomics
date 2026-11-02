import React from "react"
import { Message } from "primereact/message"
import HoldoutResults, { ThresholdSelection } from "../HoldoutResults"
import ClientHoldoutResults from "./ClientHoldoutResults"

const format = (value, digits = 3) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? "-" : Number(value).toFixed(digits))

/**
 * Clients that did not send holdout results (no file, too few rows, or an error)
 */
const ExcludedClients = ({ title, clients, severity, describe }) =>
  clients?.length ? (
    <Message
      severity={severity}
      className="w-100 mb-2 justify-content-start"
      content={
        <div>
          <b>{title}</b>
          <ul className="mb-0">
            {clients.map((client, index) => (
              <li key={index}>
                {client.client_id || "Unknown client"}: {describe(client)}
              </li>
            ))}
          </ul>
        </div>
      }
    />
  ) : null

/**
 * Results of the federated holdout test of a real-world run (Federated Holdout node).
 * Each client tests the final global model on its own holdout file, the server pools the results.
 * @param {Object} result result printed by the MEDfl server (FEDERATED_HOLDOUT_RESULT log line)
 */
export default function FederatedHoldoutResults({ result }) {
  if (!result) {
    return <Message severity="info" className="w-100 my-3" text="No holdout results yet. Add a Federated Holdout node to the configuration: the results arrive after the last round." />
  }

  const excluded = (
    <>
      <ExcludedClients title="Clients without a holdout file" clients={result.missing_clients} severity="warn" describe={(client) => client.error || "no holdout file"} />
      <ExcludedClients
        title={`Clients skipped (fewer than ${result.minimum_samples} usable rows)`}
        clients={result.skipped_clients}
        severity="warn"
        describe={(client) => `${client.rows} rows${client.reason ? ` (${client.reason})` : ""}`}
      />
      <ExcludedClients title="Clients that failed" clients={result.failed_clients} severity="error" describe={(client) => client.error} />
    </>
  )

  // clients left out of the optimized threshold (no validation data, too few rows, or an error)
  const selection = result.threshold_selection
  const validationExcluded = selection ? (
    <>
      <ExcludedClients title="Clients without validation data for the threshold" clients={selection.missing_clients} severity="warn" describe={(client) => client.error || "no validation data"} />
      <ExcludedClients
        title={`Clients skipped for the threshold (fewer than ${result.minimum_samples} validation rows)`}
        clients={selection.skipped_clients}
        severity="warn"
        describe={(client) => `${client.rows} rows`}
      />
      <ExcludedClients title="Clients whose validation data failed" clients={selection.failed_clients} severity="error" describe={(client) => client.error} />
    </>
  ) : null

  const excludedCount = (result.missing_clients?.length || 0) + (result.skipped_clients?.length || 0) + (result.failed_clients?.length || 0)

  if (result.status !== "completed" || !result.pooled) {
    return (
      <div className="my-3">
        <Message severity="error" className="w-100 mb-2" text={`The federated holdout test failed: ${result.error || result.status}`} />
        {excluded}
        {validationExcluded}
      </div>
    )
  }

  return (
    <div className="my-3" style={{ maxHeight: "60vh", overflowY: "auto" }}>
      <div className="fw-bold mb-2 h2">Federated holdout test</div>
      <div className="text-muted mb-2">
        {result.participating_clients} client(s) tested the final global model on their local holdout file · AUC {result.auc_method}
        {result.auc_weighted_mean !== null && result.auc_weighted_mean !== undefined ? ` · mean of the client AUCs weighted by rows: ${format(result.auc_weighted_mean)}` : ""}
      </div>
      {excludedCount ? (
        <Message
          severity="warn"
          className="w-100 mb-2 justify-content-start"
          text={`${excludedCount} client(s) did not contribute to the pooled results: see their reason in Results by client below.`}
        />
      ) : null}

      <ThresholdSelection selection={selection} />
      {validationExcluded}

      <HoldoutResults holdout={result.pooled} showComparison={false} scrollable={false} />

      <ClientHoldoutResults result={result} />
    </div>
  )
}
