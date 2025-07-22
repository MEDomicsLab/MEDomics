import React, { useState } from 'react'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { Card } from 'primereact/card'
import { PrimeReact } from 'primereact/api'

/**
 * Advanced theme switcher component demonstrating PrimeReact.changeTheme usage
 * This shows how to switch between multiple themes dynamically
 */
const PrimeReactThemeSwitcher = () => {
  const [currentTheme, setCurrentTheme] = useState('lara-light-indigo')
  
  // Available themes (add more as needed)
  const availableThemes = [
    { label: 'Lara Light Indigo', value: 'lara-light-indigo' },
    { label: 'Lara Dark Indigo', value: 'lara-dark-indigo' },
    // Add more themes once copied to public folder
    // { label: 'Bootstrap Light Blue', value: 'bootstrap4-light-blue' },
    // { label: 'Bootstrap Dark Blue', value: 'bootstrap4-dark-blue' },
  ]

  const switchTheme = (newTheme) => {
    if (newTheme === currentTheme) return

    const newThemePath = `/primereact-themes/${newTheme}/theme.css`
    
    // Get or create theme link
    let themeLink = document.getElementById('primereact-theme')
    if (!themeLink) {
      themeLink = document.createElement('link')
      themeLink.id = 'primereact-theme'
      themeLink.rel = 'stylesheet'
      document.head.appendChild(themeLink)
    }
    
    const currentThemePath = themeLink.href

    // Try to use PrimeReact.changeTheme if available
    if (typeof PrimeReact !== 'undefined' && PrimeReact.changeTheme) {
      try {
        PrimeReact.changeTheme(
          currentThemePath,
          newThemePath,
          'primereact-theme',
          () => {
            setCurrentTheme(newTheme)
            console.log(`Theme successfully changed to: ${newTheme}`)
          }
        )
      } catch (error) {
        console.warn('PrimeReact.changeTheme failed, falling back to direct link update:', error)
        themeLink.href = newThemePath
        setCurrentTheme(newTheme)
        console.log(`Theme successfully changed to: ${newTheme} (fallback method)`)
      }
    } else {
      // Fallback: direct link manipulation
      themeLink.href = newThemePath
      setCurrentTheme(newTheme)
      console.log(`Theme successfully changed to: ${newTheme} (fallback method)`)
    }
  }

  const handleThemeChange = (e) => {
    switchTheme(e.value)
  }

  return (
    <Card 
      title="PrimeReact Theme Switcher" 
      style={{ margin: '1rem', maxWidth: '400px' }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <p>Current theme: <strong>{currentTheme}</strong></p>
        
        <Dropdown
          value={currentTheme}
          options={availableThemes}
          onChange={handleThemeChange}
          placeholder="Select a theme"
          style={{ width: '100%', marginBottom: '1rem' }}
        />
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            label="Light Theme"
            onClick={() => switchTheme('lara-light-indigo')}
            className={currentTheme === 'lara-light-indigo' ? 'p-button-success' : 'p-button-secondary'}
            size="small"
          />
          <Button
            label="Dark Theme"
            onClick={() => switchTheme('lara-dark-indigo')}
            className={currentTheme === 'lara-dark-indigo' ? 'p-button-success' : 'p-button-secondary'}
            size="small"
          />
        </div>
      </div>
      
      <div style={{ 
        padding: '1rem', 
        border: '1px solid var(--surface-border, #ddd)', 
        borderRadius: '6px',
        backgroundColor: 'var(--surface-ground, #f8f9fa)'
      }}>
        <h6>Theme Preview</h6>
        <p>This area shows how the theme affects component styling.</p>
        <Button label="Sample Button" icon="pi pi-star" />
      </div>
    </Card>
  )
}

export default PrimeReactThemeSwitcher
