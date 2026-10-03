const { contextBridge, ipcRenderer } = require('electron')

const keyArg = process.argv.find((a) => a.startsWith('--jarvis-api-key='))
const apiKey = keyArg ? keyArg.slice('--jarvis-api-key='.length) : ''
const webArg = process.argv.find((a) => a.startsWith('--jarvis-web-url='))
const webUrl = webArg ? webArg.slice('--jarvis-web-url='.length) : ''

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  apiKey,
  webUrl,
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data))
  },
  restartAndUpdate: () => {
    ipcRenderer.invoke('restart-and-update')
  },
})
