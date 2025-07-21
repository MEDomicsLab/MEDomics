import React from "react"
import ModulePage from "./moduleBasics/modulePage"
import EvaluationPageContent from "../evaluation/evaluationPageContent"
import { shell } from 'electron'

const EvaluationPage = ({ pageId = "evaluation-456" }) => {
  return (
    <>
      <ModulePage pageId={pageId} shadow className="EvaluationPage">

        {/* Titre à gauche avec espace en bas */}
        <h2 style={{ textAlign: "left", marginBottom: "18px" }}>🧪 Model Evaluation</h2>

        {/* Description centrée */}
        <div style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
          <p>
            This module allows you to evaluate the performance of your trained models by generating detailed reports, visualizing key metrics, and analyzing predictions.
          </p>

          <p style={{ marginTop: "10px" }}>
            Learn more about this process in our{' '}
            <u
              onClick={() => shell.openExternal("https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/development/evaluation-module")}
              style={{ color: "#0056b3", textDecoration: "none", cursor: "pointer" }}
            >
              documentation. 🔗
            </u>
          </p>
        </div>

        {/* Espace ajouté avant le formulaire */}
        <div style={{ marginTop: "40px" }}>
          <EvaluationPageContent />
        </div>

      </ModulePage>
    </>
  )
}

export default EvaluationPage
