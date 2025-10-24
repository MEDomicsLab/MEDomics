const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('backend', {
  request: (req) => ipcRenderer.invoke('backend-request', req),
  getExpressPort: () => ipcRenderer.invoke('get-express-port')
})
