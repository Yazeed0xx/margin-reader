import { spawn } from 'node:child_process'

const env = {
  ...process.env,
  ELECTRON_RENDERER_URL: 'http://localhost:5174',
}

delete env.GSETTINGS_SCHEMA_DIR

const args = ['.']
if (process.platform === 'linux' && process.env.ELECTRON_LINUX_COMPAT === '1') {
  args.unshift('--no-sandbox', '--disable-gpu', '--ozone-platform=x11')
}

const electron = spawn('electron', args, {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => electron.kill(signal))
}

electron.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})

electron.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exitCode = code ?? 1
})
