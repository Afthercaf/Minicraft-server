import path from 'node:path'
import { promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { config } from '../config.js'
import { rconCommand } from './rcon.js'

const exec = promisify(execFile)
const root = path.resolve(config.serverDataPath)
const backupRoot = path.join(root, 'backups')
let runningBackup = null

export async function createWorldBackup(reason = 'scheduled') {
  if (runningBackup) return runningBackup
  runningBackup = (async () => {
    await fs.mkdir(backupRoot, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `world-${stamp}-${String(reason).replace(/[^a-z0-9_-]/gi, '')}.zip`
    const destination = path.join(backupRoot, filename)
    let savesPaused = false
    try {
      await rconCommand('save-off', 5000)
      savesPaused = true
      await rconCommand('save-all flush', 15000)
    } catch { /* El servidor puede estar detenido; los archivos siguen copiándose. */ }
    try {
      const includes = ['world', 'server.properties', 'whitelist.json', 'ops.json']
      await exec('tar', ['-a', '-c', '-f', destination, '-C', root, ...includes], {
        timeout: 15 * 60_000,
        windowsHide: true,
      })
    } finally {
      if (savesPaused) await rconCommand('save-on', 5000).catch(() => {})
    }
    const stat = await fs.stat(destination)
    const files = (await fs.readdir(backupRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.zip'))
    const dated = await Promise.all(files.map(async (entry) => ({ name: entry.name, stat: await fs.stat(path.join(backupRoot, entry.name)) })))
    dated.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    await Promise.all(dated.slice(24).map((entry) => fs.unlink(path.join(backupRoot, entry.name))))
    return { filename, size: stat.size, createdAt: stat.mtime }
  })().finally(() => { runningBackup = null })
  return runningBackup
}

export async function listWorldBackups() {
  await fs.mkdir(backupRoot, { recursive: true })
  const files = (await fs.readdir(backupRoot, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith('.zip'))
  const result = await Promise.all(files.map(async (entry) => {
    const stat = await fs.stat(path.join(backupRoot, entry.name))
    return { name: entry.name, size: stat.size, createdAt: stat.mtime }
  }))
  return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

setInterval(() => createWorldBackup('2h').catch((err) => console.error(`Backup automático falló: ${err.message}`)), 2 * 60 * 60_000).unref()
