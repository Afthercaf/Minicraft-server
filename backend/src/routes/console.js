import { Router } from 'express'
import { rconCommand } from '../lib/rcon.js'
import { actionLimiter, readLimiter } from '../middleware/rateLimit.js'

export const consoleRouter = Router()

// Comandos que no se permiten desde el panel web
const FORBIDDEN = new Set(['stop', 'reload'])

function parsePlayerList(raw) {
  // "There are 2 of a max of 10 players online: Steve, Alex"
  const match = raw.match(/There are (\d+) of a max of (\d+) players online:?(.*)/i)
  if (!match) return { online: 0, max: 0, names: [] }
  return {
    online: parseInt(match[1], 10),
    max: parseInt(match[2], 10),
    names: match[3].split(',').map((n) => n.trim()).filter(Boolean),
  }
}

consoleRouter.get('/status', readLimiter, async (req, res, next) => {
  try {
    const raw = await rconCommand('list', 8000)
    res.json({ online: true, players: parsePlayerList(raw) })
  } catch (err) {
    if (err.status === 502 || err.status === 504) {
      return res.json({ online: false, players: { online: 0, max: 0, names: [] } })
    }
    next(err)
  }
})

consoleRouter.post('/send', actionLimiter, async (req, res, next) => {
  try {
    const command = String(req.body?.command || '').trim().replace(/^\//, '')
    if (!command || command.length > 500) {
      return res.status(400).json({ error: 'Comando inválido' })
    }
    const first = command.split(' ', 1)[0].toLowerCase()
    if (FORBIDDEN.has(first)) {
      return res.status(403).json({ error: 'Comando no permitido desde el panel' })
    }
    const response = await rconCommand(command)
    res.json({ response })
  } catch (err) {
    next(err)
  }
})
