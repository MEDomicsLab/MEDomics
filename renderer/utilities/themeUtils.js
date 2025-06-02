/**
 * Utility functions for loading different UI library themes dynamically
 */

/**
 * Load appropriate PrimeReact theme based on dark/light mode
 * @param {boolean} isDark - Whether dark mode is enabled
 */
export const loadPrimeTheme = (isDark) => {
  // Remove existing PrimeReact theme
  const existingTheme = document.getElementById("primereact-theme")
  if (existingTheme) {
    existingTheme.remove()
  }

  // Load new theme
  const link = document.createElement("link")
  link.id = "primereact-theme"
  link.rel = "stylesheet"
  link.href = isDark
    ? "https://cdn.jsdelivr.net/npm/primereact@10.8.3/resources/themes/lara-dark-indigo/theme.css"
    : "https://cdn.jsdelivr.net/npm/primereact@10.8.3/resources/themes/lara-light-indigo/theme.css"

  document.head.appendChild(link)
}

/**
 * Load appropriate FlexLayout theme based on dark/light mode
 * @param {boolean} isDark - Whether dark mode is enabled
 */
export const loadFlexLayoutTheme = (isDark) => {
  // Remove existing FlexLayout theme
  const existingTheme = document.getElementById("flexlayout-theme")
  if (existingTheme) {
    existingTheme.remove()
  }

  // Load new theme
  const link = document.createElement("link")
  link.id = "flexlayout-theme"
  link.rel = "stylesheet"
  link.href = isDark ? "https://cdn.jsdelivr.net/npm/flexlayout-react@0.7.15/style/dark.css" : "https://cdn.jsdelivr.net/npm/flexlayout-react@0.7.15/style/light.css"

  document.head.appendChild(link)
}

/**
 * Update Bootstrap theme by switching CSS variables
 * @param {boolean} isDark - Whether dark mode is enabled
 */
export const updateBootstrapTheme = (isDark) => {
  const root = document.documentElement

  if (isDark) {
    // Override Bootstrap variables for dark mode
    root.style.setProperty("--bs-body-bg", "var(--bg-primary)")
    root.style.setProperty("--bs-body-color", "var(--text-primary)")
    root.style.setProperty("--bs-border-color", "var(--border-color)")
    root.style.setProperty("--bs-secondary-bg", "var(--bg-secondary)")
  } else {
    // Reset to default Bootstrap values
    root.style.removeProperty("--bs-body-bg")
    root.style.removeProperty("--bs-body-color")
    root.style.removeProperty("--bs-border-color")
    root.style.removeProperty("--bs-secondary-bg")
  }
}

/**
 * Load all themes for the given mode
 * @param {boolean} isDark - Whether dark mode is enabled
 */
export const loadAllThemes = (isDark) => {
  loadPrimeTheme(isDark)
  loadFlexLayoutTheme(isDark)
  updateBootstrapTheme(isDark)
}
