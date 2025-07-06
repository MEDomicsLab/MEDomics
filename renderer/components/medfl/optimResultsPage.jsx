import React, { useEffect, useState } from "react"
import { JsonView, allExpanded } from "react-json-view-lite"
import { loadFileFromPathSync } from "../../utilities/fileManagementUtils"

export default function OptimResultsPage({ url }) {
  const [results, setResults] = useState({})
  const [saveDate, setDate] = useState(null)

  useEffect(() => {
    loadFileFromPathSync(url).then((data) => {
      setResults(data)

      setDate(new Date(data["date"]))
    })
  }, [url])

  if (!results["data"]) return <div>Loading ...</div>
  return (
    <div style={{ maxHeight: "100%", overflowY: "scroll", padding: 10 }}>
      <div className="d-flex justify-content-between w-100 ">
        <div className="gap-3 results-header">
          <div className="flex align-items-center pb-4">
            <h5>Optimisation results results</h5>
          </div>
        </div>
        Date: {saveDate?.toLocaleDateString()}
      </div>

      <div>
        {/* Display all the options available for the node */}

        {results["data"] ? (
          <>
            <div className="h4">
              Metric : <span className="text-danger">{results["data"]["Metric"]}</span>
            </div>
            <div className="h4">
              Best Score : <span className="text-danger">{results["data"]["Best Score"]}</span>
            </div>
            <div className="h4">
              Best HyperParameters : <span></span>
            </div>
            <JsonView data={results["data"]["Best Parameters"]} shouldExpandNode={allExpanded} />

            <img src={`data:image/png;base64,${results["data"]["opt_history"]}`} alt="Optimization History" />
            <img src={`data:image/png;base64,${results["data"]["parallel_coordinates"]}`} alt="parallel_coordinates" />
            <img src={`data:image/png;base64,${results["data"]["param_importance"]}`} alt="param_importance" />
          </>
        ) : (
          "Loading"
        )}
      </div>
    </div>
  )
}
