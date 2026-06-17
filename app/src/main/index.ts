import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { existsSync, appendFileSync, mkdirSync } from 'fs'

let mainWindow: BrowserWindow | null = null
let pythonProcess: ChildProcess | null = null

// --- Debug logging -------------------------------------------------------
let logPath = ''
function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  process.stdout.write(line)
  try {
    if (!logPath) {
      const dir = app.getPath('userData')
      mkdirSync(dir, { recursive: true })
      logPath = join(dir, 'app.log')
    }
    appendFileSync(logPath, line)
  } catch { /* ignore write errors */ }
}
// -------------------------------------------------------------------------

function startPythonSidecar(): void {
  let child: ChildProcess | undefined

  if (app.isPackaged) {
    const exePath = join(process.resourcesPath, 'sidecar', 'FocusTimerSidecar.exe')
    log(`[sidecar] looking for exe at: ${exePath}`)
    if (existsSync(exePath)) {
      child = spawn(exePath, [], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
      log(`[sidecar] started exe PID ${child.pid}`)
    } else {
      log('[sidecar] FocusTimerSidecar.exe not found — focus shield disabled')
      return
    }
  } else {
    const candidates = [
      join(app.getAppPath(), '..', 'FocusTimerSidecar.py'),
      join(__dirname, '..', '..', '..', '..', 'FocusTimerSidecar.py')
    ]
    const pyScript = candidates.find(existsSync)
    if (!pyScript) {
      log('[sidecar] FocusTimerSidecar.py not found — focus shield disabled')
      return
    }
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
    child = spawn(pythonCmd, [pyScript], {
      cwd: join(pyScript, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    log(`[sidecar] started PID ${child.pid} → ${pyScript}`)
  }

  pythonProcess = child
  pythonProcess.stdout?.on('data', (d) => log(`[sidecar stdout] ${d}`))
  pythonProcess.stderr?.on('data', (d) => log(`[sidecar stderr] ${d}`))
  pythonProcess.on('exit', (code) => log(`[sidecar] exited with code ${code}`))
}

function createWindow(): void {
  log('[main] creating BrowserWindow')
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 600,
    backgroundColor: '#2a1f15',
    titleBarStyle: 'hiddenInset',
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('closed', () => {
    log('[main] window closed')
    mainWindow = null
  })

  mainWindow.webContents.on('did-finish-load', () => log('[renderer] did-finish-load'))
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) =>
    log(`[renderer] did-fail-load code=${code} desc=${desc} url=${url}`)
  )
  mainWindow.webContents.on('render-process-gone', (_e, details) =>
    log(`[renderer] render-process-gone reason=${details.reason} exitCode=${details.exitCode}`)
  )
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) =>
    log(`[renderer console lv${level}] ${message} (${sourceId}:${line})`)
  )

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL']
    log(`[main] loading renderer URL: ${url}`)
    mainWindow.loadURL(url)
  } else {
    const htmlPath = join(__dirname, '../renderer/index.html')
    log(`[main] loading renderer file: ${htmlPath}`)
    mainWindow.loadFile(htmlPath)
  }
}

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:close', () => mainWindow?.close())

app.whenReady().then(() => {
  log('[main] app ready')
  if (process.platform === 'win32') app.setAppUserModelId('com.focustimer.app')
  startPythonSidecar()
  createWindow()
  app.on('activate', () => { if (!mainWindow) createWindow() })
})

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
})
