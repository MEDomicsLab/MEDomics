import React, { createContext, useContext, useState, useEffect } from 'react'
import { ipcRenderer } from 'electron'
import { loadAllThemes } from '../../utilities/themeUtils'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // Get initial theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    const initialDarkMode = savedTheme ? savedTheme === 'dark' : prefersDark
    setIsDarkMode(initialDarkMode)
    updateTheme(initialDarkMode)

    // Listen for theme toggle from Electron main process
    ipcRenderer.on('toggleDarkMode', () => {
      toggleTheme()
    })

    return () => {
      ipcRenderer.removeAllListeners('toggleDarkMode')
    }
  }, [])

  const updateTheme = (isDark) => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
    
    // Load appropriate themes for all UI libraries
    loadAllThemes(isDark)
    
    // Notify Electron main process about theme change
    if (typeof ipcRenderer !== 'undefined') {
      ipcRenderer.send('themeChanged', { isDarkMode: isDark })
    }
  }

  const toggleTheme = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    updateTheme(newDarkMode)
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, setIsDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}
