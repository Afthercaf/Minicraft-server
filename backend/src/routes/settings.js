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
const defaults = {
  serverName: 'CraftControl',
  serverAddress: 'killerexpert10.tail29c8ce.ts.net:25565',
  serverIp: '100.76.97.8:25565',
  accentColor: '#10b981',
  serverIcon: '',
  maxPlayers: 10,
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

async function updateMaxPlayers(maxPlayers) {
  let content = await fs.readFile(propertiesFile, 'utf8')
  if (/^max-players=.*$/m.test(content)) content = content.replace(/^max-players=.*$/m, `max-players=${maxPlayers}`)
  else content += `\nmax-players=${maxPlayers}\n`
  await fs.writeFile(propertiesFile, content, 'utf8')
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
    }
    await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf8')
    if (maxPlayers !== current.maxPlayers) await updateMaxPlayers(maxPlayers)
    res.json({ settings, restartRequired: maxPlayers !== current.maxPlayers })
  } catch (err) { next(err) }
})
