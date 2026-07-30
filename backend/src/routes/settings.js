import { Router } from 'express'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { config } from '../config.js'
import { requireSuperAdmin } from '../middleware/auth.js'
import { actionLimiter, readLimiter } from '../middleware/rateLimit.js'

export const settingsRouter = Router()
const dataRoot = path.resolve(config.serverDataPath)
const settingsFile = path.join(dataRoot, 'panel-settings.json')
const propertiesFile = path.join(dataRoot, 'server.properties')
const autoModpackFile = path.join(dataRoot, 'automodpack', 'automodpack-server.json')
const serverIconFile = path.join(dataRoot, 'server-icon.png')
const defaults = {
  serverName: 'CraftControl',
  serverAddress: 'killerexpert10.tail29c8ce.ts.net:25565',
  serverIp: '100.76.97.8:25565',
  accentColor: '#10b981',
  serverIcon: '',
  maxPlayers: 10,
  onlineMode: true,
}

async function readSettings() {
  try {
    return { ...defaults, ...JSON.parse(await fs.readFile(settingsFile, 'utf8')) }
  } catch {
    return defaults
  }
}

function cleanText(value, max) {
  return String(value || '').trim().replace(/[<>"'`]/g, '').slice(0, max)
}

async function updateServerProperties(values) {
  let content = await fs.readFile(propertiesFile, 'utf8')
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm')
    if (pattern.test(content)) content = content.replace(pattern, `${key}=${value}`)
    else content += `\n${key}=${value}\n`
  }
  await fs.writeFile(propertiesFile, content, 'utf8')
}

async function updateAutoModpack(serverName) {
  try {
    const autoModpack = JSON.parse(await fs.readFile(autoModpackFile, 'utf8'))
    autoModpack.modpackName = cleanText(serverName, 50)
    autoModpack.modpackHost = true
    autoModpack.generateModpackOnStart = true
    autoModpack.requireAutoModpackOnClient = true
    autoModpack.nagUnModdedClients = true
    autoModpack.nagMessage = 'Este servidor instala y actualiza sus mods con AutoModpack.'
    autoModpack.nagClickableMessage = 'Descargar AutoModpack'
    autoModpack.nagClickableLink = 'https://modrinth.com/mod/automodpack'
    autoModpack.disableInternalTLS = false
    autoModpack.validateSecrets = true
    autoModpack.acceptedLoaders = ['forge']
    await fs.writeFile(autoModpackFile, JSON.stringify(autoModpack, null, 2), 'utf8')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

async function updateServerIcon(dataUrl) {
  if (!dataUrl) {
    await fs.unlink(serverIconFile).catch((err) => { if (err.code !== 'ENOENT') throw err })
    return
  }
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw Object.assign(new Error('El icono debe guardarse como PNG'), { status: 400 })
  const bytes = Buffer.from(match[1], 'base64')
  if (bytes.length > 250_000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw Object.assign(new Error('El icono PNG no es válido'), { status: 400 })
  }
  await fs.writeFile(serverIconFile, bytes)
}

settingsRouter.get('/', readLimiter, async (req, res, next) => {
  try { res.json({ settings: await readSettings(), superadmin: req.user.superadmin }) }
  catch (err) { next(err) }
})

settingsRouter.put('/', requireSuperAdmin, actionLimiter, async (req, res, next) => {
  try {
    const current = await readSettings()
    const maxPlayers = Math.min(Math.max(parseInt(req.body?.maxPlayers, 10) || current.maxPlayers, 1), 500)
    const accentColor = /^#[0-9a-f]{6}$/i.test(req.body?.accentColor) ? req.body.accentColor : current.accentColor
    const icon = String(req.body?.serverIcon || '')
    const onlineMode = req.body?.onlineMode === undefined ? current.onlineMode : req.body.onlineMode === true
    if (icon && (!/^data:image\/(png|jpeg|webp);base64,/i.test(icon) || icon.length > 250_000)) {
      return res.status(400).json({ error: 'La imagen no es válida o es demasiado grande' })
    }
    const settings = {
      serverName: cleanText(req.body?.serverName, 50) || current.serverName,
      serverAddress: cleanText(req.body?.serverAddress, 150) || current.serverAddress,
      serverIp: cleanText(req.body?.serverIp, 80),
      accentColor,
      serverIcon: icon,
      maxPlayers,
      onlineMode,
    }
    await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf8')
    await updateAutoModpack(settings.serverName)
    await updateServerIcon(settings.serverIcon)
    const restartRequired = maxPlayers !== current.maxPlayers || onlineMode !== current.onlineMode
    const identityChanged = settings.serverName !== current.serverName || settings.serverIcon !== current.serverIcon
    if (restartRequired || identityChanged) {
      await updateServerProperties({ 'max-players': maxPlayers, 'online-mode': onlineMode, motd: settings.serverName })
    }
    res.json({ settings, restartRequired: restartRequired || identityChanged })
  } catch (err) { next(err) }
})
