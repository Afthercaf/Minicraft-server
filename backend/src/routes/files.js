import { Router } from 'express'
import path from 'node:path'
import { promises as fs, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { config } from '../config.js'
import { requirePermission } from '../middleware/auth.js'
import { actionLimiter, readLimiter } from '../middleware/rateLimit.js'
import { deleteCached, getCachedJson, setCachedJson } from '../lib/redis.js'

export const filesRouter = Router()
const root = path.resolve(config.serverDataPath)
const modsRoot = path.join(root, 'mods')
const uploadRoot = path.join(root, '.uploads')
const textExtensions = new Set(['.txt', '.log', '.json', '.properties', '.toml', '.conf', '.yml', '.yaml', '.cfg'])

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      try { mkdirSync(uploadRoot, { recursive: true }); callback(null, uploadRoot) }
      catch (err) { callback(err) }
    },
    filename: (req, file, callback) => callback(null, `${randomUUID()}.upload`),
  }),
  limits: { fileSize: 256 * 1024 * 1024, files: 1 },
})

function safePath(input = '') {
  const normalized = String(input).replaceAll('\\', '/').replace(/^\/+/, '')
  const resolved = path.resolve(root, normalized)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw Object.assign(new Error(), { status: 403 })
  return { resolved, relative: normalized }
}

filesRouter.get('/', requirePermission('files'), readLimiter, async (req, res, next) => {
  try {
    const { resolved, relative } = safePath(req.query.path)
    const cacheKey = `mc-admin:files:${relative || 'root'}`
    const cached = await getCachedJson(cacheKey)
    if (cached) return res.json({ ...cached, cached: true })
    const entries = await fs.readdir(resolved, { withFileTypes: true })
    const data = await Promise.all(entries.filter((e) => !e.name.startsWith('.')).map(async (entry) => {
      const full = path.join(resolved, entry.name)
      const stat = await fs.stat(full)
      return { name: entry.name, path: path.posix.join(relative, entry.name), type: entry.isDirectory() ? 'folder' : 'file', size: stat.size, modified: stat.mtime }
    }))
    data.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1)
    const result = { path: relative, entries: data }
    await setCachedJson(cacheKey, result, 5)
    res.json({ ...result, cached: false })
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

filesRouter.post('/mods', requirePermission('mods'), actionLimiter, upload.single('mod'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Selecciona un archivo .jar' })
    const original = path.basename(req.file.originalname).replace(/[^A-Za-z0-9._+() -]/g, '_').slice(0, 180)
    if (!original.toLowerCase().endsWith('.jar')) {
      await fs.unlink(req.file.path).catch(() => {})
      return res.status(415).json({ error: 'Solo se permiten mods en formato .jar' })
    }
    await fs.mkdir(modsRoot, { recursive: true })
    const destination = path.join(modsRoot, original)
    try { await fs.access(destination); await fs.unlink(req.file.path); return res.status(409).json({ error: 'Ya existe un mod con ese nombre' }) }
    catch (err) { if (err.code !== 'ENOENT') throw err }
    await fs.rename(req.file.path, destination)
    await deleteCached(['mc-admin:files:root', 'mc-admin:files:mods'])
    const stat = await fs.stat(destination)
    res.status(201).json({ ok: true, mod: { name: original, size: stat.size }, restartRequired: true })
  } catch (err) {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {})
    next(err)
  }
})
