import { shell } from "electron"
import Image from "next/image"
import { useState } from "react"
import myimage from "../../../../resources/medomics_transparent_bg.png"
import { useTheme } from "../../theme/themeContext"

/**
 * Shared layout shell for module landing pages.
 * Tools render immediately; detailed guidance stays in a collapsible panel.
 */
export default function ModuleLandingShell({
  title,
  description,
  infoContent,
  documentation,
  children,
  footer,
  className = "",
  contentMaxWidth = "960px",
  alignTop = false,
}) {
  const { isDarkMode } = useTheme()
  const [infoExpanded, setInfoExpanded] = useState(false)

  const openDocumentation = () => {
    if (documentation?.url) {
      shell.openExternal(documentation.url)
    }
  }

  return (
    <div
      className={`module-landing-shell h-100 w-100 overflow-auto ${alignTop ? "module-landing-shell--top" : ""} ${className}`}
      data-theme-aware={isDarkMode ? "dark" : "light"}
    >
      <div className="module-landing-inner" style={{ maxWidth: contentMaxWidth }}>
        <header className="module-landing-header">
          <Image src={myimage} alt="MEDomicsLab logo" width={40} height={40} className="module-landing-logo" />
          <h1 className="module-landing-title">{title}</h1>
          {description && <p className="module-landing-tagline">{description}</p>}

          {infoContent && (
            <button
              type="button"
              className="module-landing-info-toggle"
              onClick={() => setInfoExpanded((prev) => !prev)}
              aria-expanded={infoExpanded}
              aria-controls="module-landing-info-panel"
            >
              <i className="pi pi-info-circle" aria-hidden="true" />
              <span>{infoExpanded ? "Hide guide" : "Module guide"}</span>
              <i className={`pi ${infoExpanded ? "pi-chevron-up" : "pi-chevron-down"}`} aria-hidden="true" />
            </button>
          )}
        </header>

        {infoContent && infoExpanded && (
          <section id="module-landing-info-panel" className="module-landing-info-panel" aria-label="Module guide">
            <div className="module-landing-info-body">{infoContent}</div>
            {documentation?.url && (
              <button type="button" className="module-landing-doc-link" onClick={openDocumentation}>
                <i className="pi pi-book" aria-hidden="true" />
                {documentation.label || "Open documentation"}
                <i className="pi pi-external-link" aria-hidden="true" />
              </button>
            )}
          </section>
        )}

        <main className="module-landing-content">{children}</main>
        {footer && <footer className="module-landing-footer">{footer}</footer>}
      </div>
    </div>
  )
}

export function ModuleGuideSteps({ steps }) {
  if (!steps?.length) return null

  return (
    <ol className="module-landing-steps list-unstyled mb-0">
      {steps.map((step) => (
        <li key={step.id ?? step.label} className="module-landing-step">
          <span className="module-landing-step-num" aria-hidden="true">
            {step.id}
          </span>
          <div>
            <div className="module-landing-step-label">{step.label}</div>
            {step.detail && <div className="module-landing-step-detail">{step.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function ModuleGuideText({ children }) {
  return <div className="module-landing-guide-text">{children}</div>
}
