import { Router } from 'express'
import { rconCommand } from '../lib/rcon.js'
import { actionLimiter, readLimiter } from '../middleware/rateLimit.js'
import { requirePermission } from '../middleware/auth.js'

export const configRouter = Router()
configRouter.use(requirePermission('config'))

// Configuracion en vivo via RCON.
// NOTA: server.properties, mods y archivos SOLO los edita el admin
// localmente en server-data\ (no hay gestor de archivos web - MD: menos superficie).

const RULE_RE = /^[A-Za-z]{2,50}$/
const VALUE_RE = /^[A-Za-z0-9_\-]{1,50}$/
const DIFFICULTIES = new Set(['peaceful', 'easy', 'normal', 'hard'])

configRouter.get('/gamerules', readLimiter, async (req, res, next) => {
  try {
    const raw = await rconCommand('gamerule')
    const rules = {}
    for (const match of raw.matchAll(/([A-Za-z]+) = ([^,\n]+)/g)) {
      rules[match[1]] = match[2].trim()
    }
    res.json({ rules })
  } catch (err) {
    next(err)
  }
})

configRouter.post('/gamerules', actionLimiter, async (req, res, next) => {
  try {
    const rule = String(req.body?.rule || '')
    const value = String(req.body?.value || '')
    if (!RULE_RE.test(rule) || !VALUE_RE.test(value)) {
      return res.status(400).json({ error: 'Regla o valor inválido' })
    }
    res.json({ response: await rconCommand(`gamerule ${rule} ${value}`) })
  } catch (err) {
    next(err)
  }
})

configRouter.get('/difficulty', readLimiter, async (req, res, next) => {
  try {
    const raw = await rconCommand('difficulty')
    const match = raw.match(/difficulty is (\w+)/i)
    res.json({ difficulty: match ? match[1].toLowerCase() : '' })
  } catch (err) {
    next(err)
  }
})

configRouter.post('/difficulty', actionLimiter, async (req, res, next) => {
  try {
    const difficulty = String(req.body?.difficulty || '').toLowerCase()
    if (!DIFFICULTIES.has(difficulty)) {
      return res.status(400).json({ error: 'Dificultad inválida' })
    }
    res.json({ response: await rconCommand(`difficulty ${difficulty}`) })
  } catch (err) {
    next(err)
  }
})
