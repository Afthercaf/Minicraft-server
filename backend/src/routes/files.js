import { Router } from 'express'
import path from 'node:path'
import { promises as fs, mkdirSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
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
const hiddenPanelFiles = new Set(['panel-player-snapshots.json', 'panel-deaths.json'])
const recommendedMods = [
  { project: 'automodpack', name: 'AutoModpack', description: 'Sincroniza automáticamente los mods con cada jugador.', requiredOnClient: true },
  { project: 'xaeros-minimap', name: "Xaero's Minimap", description: 'Minimapa, puntos y coordenadas.', requiredOnClient: false },
  { project: 'xaeros-world-map', name: "Xaero's World Map", description: 'Mapa completo del mundo.', requiredOnClient: false },
  { project: 'waystones', name: 'Waystones', description: 'Estructuras y piedras de teletransporte.', requiredOnClient: true },
  { project: 'balm', name: 'Balm', description: 'Dependencia necesaria para Waystones.', requiredOnClient: true },
  { project: 'ct-overhaul-village', name: 'Aldeas mejoradas (CTOV)', description: 'Nuevas aldeas y puestos de saqueadores.', requiredOnClient: false },
  { project: 'biomes-o-plenty', name: "Biomes O' Plenty", description: 'Más de 50 biomas, árboles y plantas.', requiredOnClient: true },
  { project: 'when-dungeons-arise', name: 'When Dungeons Arise', description: 'Grandes estructuras y mazmorras de exploración.', requiredOnClient: true },
  { project: 'yungs-better-dungeons', name: "YUNG's Better Dungeons", description: 'Rediseña las mazmorras sin saturar el mundo.', requiredOnClient: false },
  { project: 'ice-and-fire-dragons', name: 'Ice and Fire: Dragons', description: 'Dragones, criaturas míticas y equipo.', requiredOnClient: true },
  { project: 'l_enders-cataclysm', name: "L_Ender's Cataclysm", description: 'Jefes finales, templos y recompensas avanzadas.', requiredOnClient: true },
  { project: 'simply-swords', name: 'Simply Swords', description: 'Espadas y armas con habilidades únicas.', requiredOnClient: true },
  { project: 'silent-gear', name: 'Silent Gear', description: 'Minerales, materiales y equipo personalizable.', requiredOnClient: true },
  { project: 'timeless-and-classics-zero', name: 'TaCZ', description: 'Pistolas, rifles, munición y accesorios.', requiredOnClient: true },
  { project: 'skinrestorer', name: 'Skin Restorer', description: 'Restaura y permite administrar skins.', requiredOnClient: false },
  { project: 'jei', name: 'Just Enough Items', description: 'Muestra las recetas de todos los objetos nuevos.', requiredOnClient: true },
  { project: 'ferrite-core', name: 'FerriteCore', description: 'Reduce el consumo de memoria del paquete.', requiredOnClient: true },
  { project: 'modernfix', name: 'ModernFix', description: 'Mejora carga, memoria y estabilidad.', requiredOnClient: true },
]
const adventureProjects = [
  'ct-overhaul-village', 'biomes-o-plenty', 'when-dungeons-arise', 'yungs-better-dungeons',
  'ice-and-fire-dragons', 'l_enders-cataclysm', 'simply-swords', 'silent-gear',
  'timeless-and-classics-zero', 'skinrestorer', 'jei', 'ferrite-core', 'modernfix',
]
const modKey = (value) => String(value).replace(/[^a-z0-9]/gi, '').toLowerCase()

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options)
      if (response.ok || response.status < 500) return response
      lastError = new Error(`Respuesta ${response.status}`)
    } catch (err) { lastError = err }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1_500))
  }
  throw lastError
}

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
  if (hiddenPanelFiles.has(path.posix.basename(normalized))) throw Object.assign(new Error(), { status: 403 })
  const resolved = path.resolve(root, normalized)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw Object.assign(new Error(), { status: 403 })
  return { resolved, relative: normalized }
}

async function ensureSophisticatedCore(modName) {
  if (!modName.toLowerCase().startsWith('sophisticatedbackpacks-')) return null
  const installed = await fs.readdir(modsRoot).catch(() => [])
  if (installed.some((name) => name.toLowerCase().startsWith('sophisticatedcore-') && name.toLowerCase().endsWith('.jar'))) {
    return null
  }

  const endpoint = 'https://api.modrinth.com/v2/project/sophisticated-core/version?loaders=%5B%22forge%22%5D&game_versions=%5B%221.20.1%22%5D'
  const versionsResponse = await fetch(endpoint, {
    headers: { 'User-Agent': 'CraftControl/1.0 (private Minecraft server)' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!versionsResponse.ok) throw new Error('No se pudo consultar Sophisticated Core en Modrinth')
  const versions = await versionsResponse.json()
  const release = versions.find((version) => version.version_type === 'release')
  const file = release?.files?.find((candidate) => candidate.primary) || release?.files?.[0]
  if (!file?.url || !file?.hashes?.sha512 || !/^sophisticatedcore-[A-Za-z0-9._+-]+\.jar$/i.test(file.filename)) {
    throw new Error('Modrinth no devolvió una dependencia válida')
  }

  const download = await fetch(file.url, { signal: AbortSignal.timeout(60_000) })
  if (!download.ok) throw new Error('No se pudo descargar Sophisticated Core')
  const declaredSize = Number(download.headers.get('content-length') || 0)
  if (declaredSize > 50 * 1024 * 1024) throw new Error('La dependencia supera el límite permitido')
  const bytes = Buffer.from(await download.arrayBuffer())
  if (bytes.length > 50 * 1024 * 1024) throw new Error('La dependencia supera el límite permitido')
  const actualHash = createHash('sha512').update(bytes).digest('hex')
  if (actualHash !== file.hashes.sha512.toLowerCase()) throw new Error('La verificación de Sophisticated Core falló')

  const temporary = path.join(uploadRoot, `${randomUUID()}.dependency`)
  const destination = path.join(modsRoot, file.filename)
  await fs.writeFile(temporary, bytes)
  await fs.rename(temporary, destination)
  return file.filename
}

export async function downloadModrinthProject(project, visited = new Set()) {
  if (visited.has(project)) return []
  visited.add(project)
  const headers = { 'User-Agent': 'CraftControl/1.0 (private Minecraft server)' }
  const endpoint = `https://api.modrinth.com/v2/project/${encodeURIComponent(project)}/version?loaders=%5B%22forge%22%5D&game_versions=%5B%221.20.1%22%5D`
  const response = await fetchWithRetry(endpoint, { headers, signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`No se pudo consultar ${project} en Modrinth`)
  const versions = await response.json()
  const version = versions.find((item) => item.version_type === 'release') || versions[0]
  const file = version?.files?.find((item) => item.primary) || version?.files?.[0]
  const safeFilename = file?.filename && path.basename(file.filename) === file.filename &&
    file.filename.length <= 180 && file.filename.toLowerCase().endsWith('.jar')
  if (!file?.url || !file?.hashes?.sha512 || !safeFilename) {
    throw new Error(`${project} no tiene un archivo Forge válido para 1.20.1`)
  }
  const results = []
  for (const dependency of version.dependencies || []) {
    if (dependency.dependency_type !== 'required') continue
    let dependencyProject = dependency.project_id
    if (!dependencyProject && dependency.version_id) {
      const dependencyVersion = await fetchWithRetry(`https://api.modrinth.com/v2/version/${dependency.version_id}`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      })
      if (dependencyVersion.ok) dependencyProject = (await dependencyVersion.json()).project_id
    }
    if (dependencyProject) results.push(...await downloadModrinthProject(dependencyProject, visited))
  }
  const infoResponse = await fetchWithRetry(`https://api.modrinth.com/v2/project/${encodeURIComponent(project)}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  })
  const info = infoResponse.ok ? await infoResponse.json() : null
  const files = await fs.readdir(modsRoot).catch(() => [])
  const normalizedSlug = modKey(info?.slug || project)
  const oldFiles = files.filter((name) => modKey(name).startsWith(normalizedSlug))
  if (files.some((name) => name.toLowerCase() === file.filename.toLowerCase())) {
    return [...results, { project, filename: file.filename, status: 'already-installed' }]
  }
  const download = await fetchWithRetry(file.url, { signal: AbortSignal.timeout(120_000) })
  if (!download.ok) throw new Error(`No se pudo descargar ${project}`)
  const bytes = Buffer.from(await download.arrayBuffer())
  if (bytes.length > 256 * 1024 * 1024) throw new Error(`${project} supera 256 MB`)
  const hash = createHash('sha512').update(bytes).digest('hex')
  if (hash !== file.hashes.sha512.toLowerCase()) throw new Error(`La firma de ${project} no coincide`)
  await fs.mkdir(modsRoot, { recursive: true })
  await fs.mkdir(uploadRoot, { recursive: true })
  const temporary = path.join(uploadRoot, `${randomUUID()}.dependency`)
  await fs.writeFile(temporary, bytes)
  await fs.rename(temporary, path.join(modsRoot, file.filename))
  for (const old of oldFiles) await fs.unlink(path.join(modsRoot, old)).catch(() => {})
  return [...results, { project, filename: file.filename, status: 'installed' }]
}

// Repara también mods que ya estaban en la carpeta antes de usar el panel.
fs.readdir(modsRoot)
  .then((names) => names.find((name) => name.toLowerCase().startsWith('sophisticatedbackpacks-')))
  .then(async (backpack) => {
    if (!backpack) return
    const dependency = await ensureSophisticatedCore(backpack)
    if (dependency) console.log(`Dependencia instalada automáticamente: ${dependency}`)
  })
  .catch((err) => console.error(`Dependencia automática pendiente: ${err.message}`))

filesRouter.get('/', requirePermission('files'), readLimiter, async (req, res, next) => {
  try {
    const { resolved, relative } = safePath(req.query.path)
    const cacheKey = `mc-admin:files:${relative || 'root'}`
    const cached = await getCachedJson(cacheKey)
    if (cached) return res.json({ ...cached, cached: true })
    const entries = await fs.readdir(resolved, { withFileTypes: true })
    const data = await Promise.all(entries.filter((e) => !e.name.startsWith('.') && !hiddenPanelFiles.has(e.name)).map(async (entry) => {
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

filesRouter.get('/recommended-mods', requirePermission('mods'), readLimiter, async (req, res, next) => {
  try {
    const files = await fs.readdir(modsRoot).catch(() => [])
    res.json({
      mods: recommendedMods.map((mod) => ({
        ...mod,
        installed: files.some((name) => modKey(name).startsWith(modKey(mod.project))),
      })),
    })
  } catch (err) { next(err) }
})

filesRouter.post('/recommended-mods/install', requirePermission('mods'), actionLimiter, async (req, res, next) => {
  try {
    const requested = String(req.body?.project || '')
    const projects = requested === 'recommended-pack'
      ? recommendedMods.map((mod) => mod.project)
      : requested === 'adventure-pack'
        ? adventureProjects
      : recommendedMods.some((mod) => mod.project === requested) ? [requested] : []
    if (!projects.length) return res.status(400).json({ error: 'Mod recomendado no válido' })
    const results = []
    const visited = new Set()
    for (const project of projects) results.push(...await downloadModrinthProject(project, visited))
    await deleteCached(['mc-admin:files:root', 'mc-admin:files:mods'])
    res.status(201).json({ results, restartRequired: true })
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
    let dependency = null
    let dependencyWarning = null
    try { dependency = await ensureSophisticatedCore(original) }
    catch (err) { dependencyWarning = err.message }
    await deleteCached(['mc-admin:files:root', 'mc-admin:files:mods'])
    const stat = await fs.stat(destination)
    res.status(201).json({
      ok: true,
      mod: { name: original, size: stat.size },
      dependency,
      dependencyWarning,
      restartRequired: true,
    })
  } catch (err) {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {})
    next(err)
  }
})
