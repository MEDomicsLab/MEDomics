import React from 'react'
import { useTheme } from './themeContext'

/**
 * Simple test component to verify theme system functionality
 * This can be temporarily added to any page for testing
 */
const ThemeTestComponent = () => {
  const { isDarkMode, toggleTheme } = useTheme()

  return (
    <div style={{ 
      padding: '20px', 
      margin: '10px',
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      color: 'var(--text-primary)'
    }}>
      <h3>Theme Test Component</h3>
      <p>Current theme: <strong>{isDarkMode ? 'Dark' : 'Light'}</strong></p>
      <button 
        onClick={toggleTheme}
        style={{
          backgroundColor: 'var(--button-bg)',
          color: 'var(--button-text)',
          border: '1px solid var(--button-bg)',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Toggle to {isDarkMode ? 'Light' : 'Dark'} Mode
      </button>
      
      <div style={{ marginTop: '15px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>
          This text uses secondary color variable
        </p>
        <div style={{ 
          backgroundColor: 'var(--bg-primary)', 
          padding: '10px', 
          border: '1px solid var(--border-color)',
          borderRadius: '4px'
        }}>
          Background using primary background variable
        </div>
      </div>
    </div>
  )
}

export default ThemeTestComponent
