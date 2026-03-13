import { screen, BrowserWindow, app } from "electron"
import Store from "electron-store"
import path from "path"
import fs from "fs"

export default function createWindow(windowName, options) {
  const key = "window-state"
  const name = `window-state-${windowName}`
  const store = new Store({ name })
  const defaultSize = {
    width: options.width,
    height: options.height
  }
  let state = {}
  let win

  const restore = () => store.get(key, defaultSize)

  const getCurrentPosition = () => {
    const position = win.getPosition()
    const size = win.getSize()
    return {
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1]
    }
  }

  const windowWithinBounds = (windowState, bounds) => {
    return windowState.x >= bounds.x && windowState.y >= bounds.y && windowState.x + windowState.width <= bounds.x + bounds.width && windowState.y + windowState.height <= bounds.y + bounds.height
  }

  const resetToDefaults = () => {
    const bounds = screen.getPrimaryDisplay().bounds
    return Object.assign({}, defaultSize, {
      x: (bounds.width - defaultSize.width) / 2,
      y: (bounds.height - defaultSize.height) / 2
    })
  }

  const ensureVisibleOnSomeDisplay = (windowState) => {
    const visible = screen.getAllDisplays().some((display) => {
      return windowWithinBounds(windowState, display.bounds)
    })
    if (!visible) {
      // Window is partially or fully not visible now.
      // Reset it to safe defaults.
      return resetToDefaults()
    }
    return windowState
  }

  const saveState = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      Object.assign(state, getCurrentPosition())
    }
    store.set(key, state)
  }

  state = ensureVisibleOnSomeDisplay(restore())

  // Resolve a robust preload path that works in dev and in the bundled app
  // Possible layouts:
  //  - Dev: __dirname === <repo>/main/helpers -> ../preload.js
  //  - Bundled: __dirname may resolve under <repo>/app or asar; try multiple candidates
  const preloadCandidates = [
    path.join(__dirname, '../preload.js'),
    path.join(__dirname, '../../main/preload.js'),
    path.join(__dirname, './preload.js'),
    path.join(process.resourcesPath || __dirname, 'preload.js'),
    path.join(process.resourcesPath || __dirname, 'app', 'preload.js')
  ]
  const resolvedPreload = preloadCandidates.find(p => {
    try { return fs.existsSync(p) } catch { return false }
  }) || path.join(__dirname, '../preload.js')

  const isProd = (process.env.NODE_ENV === 'production') || app.isPackaged

  win = new BrowserWindow({
    icon: path.join(__dirname, "../resources/MEDomicsLabWithShadowNoText100.png"),
    ...state,
    ...options,
    webPreferences: {
      // Preload to expose a minimal API to renderer (kept alongside current settings)
      preload: resolvedPreload,
      nodeIntegration: true,
      // Use contextIsolation in production; relax in dev to avoid brittle shims
      contextIsolation: isProd,
      ...options.webPreferences
    },
    show: false
  })

  win.showMessage = (message) => {
    win.webContents.send("logging", message)
    console.log("[DEBUG] Message sent to renderer, message: " + message)
  }

  win.on("close", saveState)

  return win
}
