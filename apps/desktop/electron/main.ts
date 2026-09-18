import { join } from 'node:path'

import { app, BrowserWindow } from 'electron'

function createWindow() {
  const window = new BrowserWindow({
    height: 720,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    width: 1024,
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(import.meta.dirname, '../dist/index.html'))
  }

  if (process.env.POC_ELECTRON_SMOKE === '1') {
    window.webContents.on('did-finish-load', async () => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const isReady = await window.webContents.executeJavaScript(
          'document.querySelector(\'[data-api-status="success"]\') !== null',
        )
        if (isReady === true) {
          process.stdout.write('electron renderer smoke passed\n')
          app.exit(0)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      process.stderr.write('electron renderer smoke timed out\n')
      app.exit(1)
    })
  }
}

void app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
