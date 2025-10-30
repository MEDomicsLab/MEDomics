const { contextBridge, ipcRenderer, webFrame } = require('electron')

const isIsolated = process.contextIsolated === true

function buildBackendAPI() {
  return {
    requestExpress: (req) => ipcRenderer.invoke('express-request', req),
    getExpressPort: () => ipcRenderer.invoke('get-express-port')
  }
}

if (isIsolated) {
  contextBridge.exposeInMainWorld('backend', buildBackendAPI())
} else {
  // In non-isolated (dev) mode, attach directly to window
  try { window.backend = buildBackendAPI() } catch (_) {}
}

// Expose a minimal, controlled native require to the page for modules like 'electron'
// used by legacy/imported code paths. Prefer using window.backend via contextBridge
// instead of requiring 'electron' directly in renderer code.
try {
  if (isIsolated) {
    contextBridge.exposeInMainWorld('nativeRequire', (mod) => {
      try { return require(mod) } catch (e) { return undefined }
    })
  } else {
    // In dev non-isolated mode, require is available directly
    window.nativeRequire = (m) => { try { return require(m) } catch { return undefined } }
  }
} catch (_) { /* ignore */ }

// Attempt to set critical shims as early as possible using webFrame,
// which executes in the main world before most scripts run.
try {
  // Skip heavy shims when not isolated (dev mode) since Node globals are available
  if (!isIsolated) { throw new Error('skip-shims') }
  webFrame.executeJavaScript(
    [
      'try{',
      ' if(typeof window.global==="undefined"){ window.global = window; }',
      ' if(typeof window.process==="undefined"){ window.process = { env: {}, browser: true }; }',
      ' if(typeof window.require==="undefined" && typeof window.nativeRequire!=="undefined"){ window.require = function(m){ return window.nativeRequire(m); } }',
      ' if(typeof require==="undefined" && typeof window.require!=="undefined"){ var require = window.require; }',
      ' if(typeof window.Buffer==="undefined" && typeof window.nativeRequire!=="undefined"){ window.Buffer = window.nativeRequire("buffer").Buffer; }',
      ' if(typeof __dirname==="undefined"){ var __dirname = "/"; }',
      ' if(typeof __filename==="undefined"){ var __filename = "/index.js"; }',
      '}catch(e){}'
    ].join(' '),
    true
  )
} catch (_) { /* ignore */ }

// Inject shims into the main world for libraries expecting Node globals
// like `global` (webpack/react-refresh) and sometimes `process` for
// env reads. We inject when DOM is ready to ensure documentElement exists.
function injectMainWorldShims() {
  try {
    const lines = []
    if (typeof window.global === 'undefined') {
      lines.push('window.global = window;')
    }
    if (typeof window.process === 'undefined') {
      // Minimal process shim suitable for client-side checks
      lines.push('window.process = { env: {}, browser: true };')
    }
    // Provide require fallback via nativeRequire if available
    lines.push('if(typeof window.require==="undefined" && typeof window.nativeRequire!=="undefined"){ window.require = function(m){ return window.nativeRequire(m); } }')
    lines.push('if(typeof require==="undefined" && typeof window.require!=="undefined"){ var require = window.require; }')
    // Provide Buffer via native buffer module if available
    lines.push('if(typeof window.Buffer==="undefined" && typeof window.nativeRequire!=="undefined"){ window.Buffer = window.nativeRequire("buffer").Buffer; }')
    // Provide CommonJS dirname/filename fallbacks for dev overlays
    lines.push('if(typeof __dirname==="undefined"){ var __dirname = "/"; }')
    lines.push('if(typeof __filename==="undefined"){ var __filename = "/index.js"; }')
    const code = `(function(){ ${lines.join(' ')} })();`
    const script = document.createElement('script')
    script.textContent = code
    document.documentElement.appendChild(script)
    script.remove()
  } catch (_) {
    // Non-fatal; continue without shims
  }
}

try {
  if (typeof window !== 'undefined' && isIsolated) {
    if (document && (document.readyState === 'interactive' || document.readyState === 'complete')) {
      injectMainWorldShims()
    } else {
      window.addEventListener('DOMContentLoaded', injectMainWorldShims, { once: true })
    }
  }
} catch (_) { /* ignore */ }
