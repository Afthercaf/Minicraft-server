import { Router } from 'express'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { config } from '../config.js'
import { requirePermission } from '../middleware/auth.js'
import { readLimiter } from '../middleware/rateLimit.js'

export const filesRouter = Router()
const root = path.resolve(config.serverDataPath)
const textExtensions = new Set(['.txt', '.log', '.json', '.properties', '.toml', '.conf', '.yml', '.yaml', '.cfg'])

function safePath(input = '') {
  const normalized = String(input).replaceAll('\\', '/').replace(/^\/+/, '')
  const resolved = path.resolve(root, normalized)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw Object.assign(new Error(), { status: 403 })
  return { resolved, relative: normalized }
}

filesRouter.get('/', requirePermission('files'), readLimiter, async (req, res, next) => {
  try {
    const { resolved, relative } = safePath(req.query.path)
    const entries = await fs.readdir(resolved, { withFileTypes: true })
    const data = await Promise.all(entries.filter((e) => !e.name.startsWith('.')).map(async (entry) => {
      const full = path.join(resolved, entry.name)
      const stat = await fs.stat(full)
      return { name: entry.name, path: path.posix.join(relative, entry.name), type: entry.isDirectory() ? 'folder' : 'file', size: stat.size, modified: stat.mtime }
    }))
    data.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1)
    res.json({ path: relative, entries: data })
  } catch (err) { next(err) }
})

filesRouter.get('/read', requirePermission('files'), readLimiter, async (req, res, next) => {
  try {
    const { resolved, relative } = safePath(req.query.path)
    if (!textExtensions.has(path.extname(resolved).toLowerCase())) return res.status(415).json({ error: 'Este archivo no se puede previsualizar' })
    const stat = await fs.stat(resolved)
    if (stat.size > 1024 * 1024) return res.status(413).json({ error: 'Archivo demasiado grande' })
    res.json({ path: relative, content: await fs.readFile(resolved, 'utf8') })
  } catch (err) { next(err) }
})
