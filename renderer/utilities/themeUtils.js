/**
 * Utility functions for loading different UI library themes dynamically
 */

import { PrimeReact } from 'primereact/api'

/**
 * Load appropriate PrimeReact theme based on dark/light mode
 * Uses PrimeReact.changeTheme for smooth theme transitions when available,
 * falls back to direct link manipulation
 * @param {boolean} isDark - Whether dark mode is enabled
 */
export const loadPrimeTheme = (isDark) => {
  // Define theme paths (using local themes for better performance)
  const lightTheme = '/primereact-themes/lara-light-indigo/theme.css'
  const darkTheme = '/primereact-themes/lara-dark-indigo/theme.css'
  
  const newTheme = isDark ? darkTheme : lightTheme
  
  // Check if theme link exists, if not create it
  let themeLink = document.getElementById('primereact-theme')
  if (!themeLink) {
    themeLink = document.createElement('link')
    themeLink.id = 'primereact-theme'
    themeLink.rel = 'stylesheet'
    themeLink.href = newTheme
    document.head.appendChild(themeLink)
    console.log(`PrimeReact theme initialized with ${isDark ? 'dark' : 'light'} mode`)
    return
  }
  
  // Get current theme from the link element
  const currentTheme = themeLink.href
  
  // Try to use PrimeReact.changeTheme if available
  if (typeof PrimeReact !== 'undefined' && PrimeReact.changeTheme) {
    try {
      PrimeReact.changeTheme(
        currentTheme,
        newTheme,
        'primereact-theme',
        () => {
          console.log(`PrimeReact theme switched to ${isDark ? 'dark' : 'light'} mode`)
        }
      )
    } catch (error) {
      console.warn('PrimeReact.changeTheme failed, falling back to direct link update:', error)
      fallbackThemeChange(themeLink, newTheme, isDark)
    }
  } else {
    // Fallback: direct link manipulation
    fallbackThemeChange(themeLink, newTheme, isDark)
  }
}

/**
 * Fallback theme switching method when PrimeReact.changeTheme is not available
 * @param {HTMLLinkElement} themeLink - The theme link element
 * @param {string} newTheme - The new theme path
 * @param {boolean} isDark - Whether dark mode is enabled
 */
const fallbackThemeChange = (themeLink, newTheme, isDark) => {
  themeLink.href = newTheme
  console.log(`PrimeReact theme switched to ${isDark ? 'dark' : 'light'} mode (fallback method)`)
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
