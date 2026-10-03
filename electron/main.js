const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const crypto = require('crypto')
const { autoUpdater } = require('electron-updater')

let mainWindow
let backendProcess
let quitting = false
let backendRestarts = 0

const isDev = !app.isPackaged

// API key compartida entre backend y frontend. Si el usuario definió JARVIS_API_KEY se respeta;
// si no, se genera una aleatoria en cada arranque y solo la conocen este proceso, el backend y la ventana.
const apiKey = process.env.JARVIS_API_KEY || crypto.randomBytes(32).toString('base64url')

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

// Usar token de GitHub si está disponible (evita rate limiting)
const githubToken = process.env.GITHUB_TOKEN || ''
const feedConfig = {
  provider: 'github',
  repo: 'Gonza-jarvis-intranet',
  owner: 'GonzalitoDev',
}
if (githubToken) {
  feedConfig.token = githubToken
}
autoUpdater.setFeedURL(feedConfig)

function getBackendDataDir() {
  const dir = path.join(app.getPath('userData'), 'backend-data')
  fs.mkdirSync(path.join(dir, 'data', 'index'), { recursive: true })
  return dir
}

function startBackend() {
  const env = { ...process.env, JARVIS_API_KEY: apiKey }
  if (isDev) {
    backendProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8765'], {
      cwd: path.join(__dirname, '..', 'backend'),
      env,
      stdio: 'pipe',
    })
  } else {
    const backendPath = path.join(process.resourcesPath, 'jarvis-backend.exe')
    const dataDir = getBackendDataDir()
    backendProcess = spawn(backendPath, [], {
      cwd: dataDir,
      env,
      stdio: 'pipe',
    })
  }

  backendProcess.stdout.on('data', (data) => {
    console.log(`[backend] ${data}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.error(`[backend] ${data}`)
  })

  const startedAt = Date.now()
  backendProcess.on('close', (code) => {
    console.log(`[backend] exited with code ${code}`)
    if (quitting) return
    // Reinicio automático; si sobrevivió más de un minuto se reinicia el contador
    if (Date.now() - startedAt > 60000) backendRestarts = 0
    if (backendRestarts < 5) {
      backendRestarts++
      const delay = 1000 * 2 ** backendRestarts
      console.log(`[backend] reiniciando en ${delay / 1000}s (intento ${backendRestarts})`)
      setTimeout(() => { if (!quitting) startBackend() }, delay)
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'JARVIS Intranet Assistant',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--jarvis-api-key=${apiKey}`],
    },
  })

  // Los enlaces externos (p. ej. openrouter.ai/keys) se abren en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'))
  }
}

function setupAutoUpdater() {
  if (isDev) return

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Buscando actualizaciones...')
    mainWindow?.webContents.send('update-status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Actualización disponible:', info.version)
    mainWindow?.webContents.send('update-status', { status: 'available', info })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] No hay actualizaciones disponibles')
    mainWindow?.webContents.send('update-status', { status: 'not-available' })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error al buscar actualizaciones:', err.message)
    // No mostrar errores de red como error crítico - es opcional
    if (err.message && err.message.includes('404')) {
      console.log('[updater] No se encontraron releases en GitHub')
      mainWindow?.webContents.send('update-status', { status: 'not-available' })
    } else if (err.message && err.message.includes('ENOTFOUND')) {
      console.log('[updater] Sin conexión a internet')
      mainWindow?.webContents.send('update-status', { status: 'not-available' })
    } else {
      console.error('[updater] Error de actualización:', err.message)
      mainWindow?.webContents.send('update-status', { 
        status: 'error', 
        message: `Error: ${err.message}`
      })
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[updater] Descargando: ${Math.round(progress.percent)}%`)
    mainWindow?.webContents.send('update-status', { status: 'downloading', progress })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Actualización descargada:', info.version)
    mainWindow?.webContents.send('update-status', { status: 'downloaded', info })
  })

  const check = () => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] Error iniciando búsqueda de actualizaciones:', err.message)
    })
  }
  check()
  // Volver a buscar cada 4 horas para sesiones largas
  setInterval(check, 4 * 60 * 60 * 1000)
}

ipcMain.handle('restart-and-update', () => {
  autoUpdater.quitAndInstall()
})

app.whenReady().then(() => {
  startBackend()
  createWindow()
  setupAutoUpdater()
})

app.on('window-all-closed', () => {
  quitting = true
  if (backendProcess) {
    backendProcess.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  quitting = true
  if (backendProcess) {
    backendProcess.kill()
  }
})
