const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const { autoUpdater } = require('electron-updater')

let mainWindow
let backendProcess

const isDev = !app.isPackaged

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
  if (isDev) {
    backendProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8765'], {
      cwd: path.join(__dirname, '..', 'backend'),
      stdio: 'pipe',
    })
  } else {
    const backendPath = path.join(process.resourcesPath, 'jarvis-backend.exe')
    const dataDir = getBackendDataDir()
    backendProcess = spawn(backendPath, [], {
      cwd: dataDir,
      stdio: 'pipe',
    })
  }

  backendProcess.stdout.on('data', (data) => {
    console.log(`[backend] ${data}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.error(`[backend] ${data}`)
  })

  backendProcess.on('close', (code) => {
    console.log(`[backend] exited with code ${code}`)
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
    },
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
      mainWindow?.webContents.send('update-status', { 
        status: 'error', 
        message: 'No hay releases disponibles. Comprueba que existan releases en GitHub.'
      })
    } else if (err.message && err.message.includes('ENOTFOUND')) {
      console.log('[updater] Sin conexión a internet')
      mainWindow?.webContents.send('update-status', { 
        status: 'offline', 
        message: 'Sin conexión a internet. Las actualizaciones se comprobarán más tarde.'
      })
    } else {
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

  try {
    autoUpdater.checkForUpdates()
  } catch (err) {
    console.error('[updater] Error iniciando búsqueda de actualizaciones:', err.message)
  }
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
  if (backendProcess) {
    backendProcess.kill()
  }
})
