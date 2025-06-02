# Dynamic Theme System

This document explains how the dynamic dark/light theme switching is implemented in the MEDomicsLab application.

## Overview

The theme system uses React Context to manage theme state and CSS custom properties (variables) to dynamically switch between light and dark modes. The system supports multiple UI libraries including Bootstrap, PrimeReact, FlexLayout, and Blueprint.js.

## Architecture

### 1. Theme Context (`/renderer/components/theme/themeContext.js`)

The `ThemeProvider` component manages the global theme state and provides:
- `isDarkMode`: Boolean indicating current theme
- `toggleTheme()`: Function to switch between themes
- `setIsDarkMode()`: Function to programmatically set theme

### 2. CSS Variables (`/renderer/styles/theme.css`)

Uses CSS custom properties for consistent theming:
```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #212529;
  /* ...other light theme variables */
}

[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --text-primary: #ffffff;
  /* ...other dark theme variables */
}
```

### 3. Theme Utilities (`/renderer/utilities/themeUtils.js`)

Handles dynamic loading of different UI library themes:
- `loadPrimeTheme()`: Switches PrimeReact theme
- `loadFlexLayoutTheme()`: Switches FlexLayout theme
- `updateBootstrapTheme()`: Updates Bootstrap variables
- `loadAllThemes()`: Loads all themes at once

### 4. Integration Points

#### Electron Main Process
- Communicates with `nativeTheme` for system theme detection
- Handles IPC messages for theme changes

#### Sidebar Toggle Button
- Located in `iconSidebar.jsx`
- Uses `useTheme()` hook to toggle theme
- Shows sun/moon icon based on current theme

## Usage

### Using Theme in Components

```jsx
import { useTheme } from '../theme/themeContext'

const MyComponent = () => {
  const { isDarkMode, toggleTheme } = useTheme()
  
  return (
    <div className={isDarkMode ? 'dark-component' : 'light-component'}>
      <button onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  )
}
```

### Adding New Theme Variables

1. Add the variable to both `:root` and `[data-theme="dark"]` in `theme.css`
2. Use the variable in your CSS: `color: var(--your-variable)`

### Supporting New UI Libraries

1. Add a new loader function in `themeUtils.js`
2. Call it from `loadAllThemes()`
3. Handle any library-specific theme switching logic

## Features

- **Automatic System Theme Detection**: Detects user's system preference
- **Persistent Theme Choice**: Saves preference to localStorage
- **Smooth Transitions**: CSS transitions for seamless theme switching
- **Multi-Library Support**: Handles multiple UI frameworks
- **IPC Communication**: Syncs with Electron main process

## File Structure

```
renderer/
├── components/
│   └── theme/
│       └── themeContext.js          # Theme context provider
├── styles/
│   └── theme.css                    # CSS variables and theme styles
├── utilities/
│   └── themeUtils.js               # Theme utility functions
└── pages/
    └── _app.js                     # App root with ThemeProvider
```

## Testing

To test the theme system:

1. Click the sun/moon icon in the sidebar
2. Verify all UI elements change color appropriately
3. Check that theme preference persists after restart
4. Test with system dark/light mode changes

## Troubleshooting

### Theme Not Applying
- Ensure `ThemeProvider` wraps your app in `_app.js`
- Check that CSS variables are properly defined
- Verify `data-theme` attribute is set on `document.documentElement`

### Library Theme Not Loading
- Check browser network tab for theme CSS load errors
- Verify CDN URLs in `themeUtils.js` are accessible
- Ensure theme IDs are unique to prevent conflicts

### Performance Issues
- Theme switching should be nearly instantaneous
- If slow, check for CSS transition conflicts
- Consider reducing transition duration for better UX
