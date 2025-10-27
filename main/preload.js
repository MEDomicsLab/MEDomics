const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('backend', {
  requestExpress: (req) => ipcRenderer.invoke('backend-request', req),
  getExpressPort: () => ipcRenderer.invoke('get-express-port')
})
