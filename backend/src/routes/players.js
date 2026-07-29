import { Router } from 'express'
import { rconCommand } from '../lib/rcon.js'
import { actionLimiter, readLimiter } from '../middleware/rateLimit.js'

export const playersRouter = Router()

const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/

function getUsername(req, res) {
  const username = String(req.body?.username || '')
  if (!USERNAME_RE.test(username)) {
    res.status(400).json({ error: 'Nombre de jugador inválido' })
    return null
  }
  return username
}

function getIp(req, res) {
  const ip = String(req.body?.ip || '')
  const valid = IPV4_RE.test(ip) && ip.split('.').every((octet) => Number(octet) <= 255)
  if (!valid) {
    res.status(400).json({ error: 'IP inválida' })
    return null
  }
  return ip
}

const getReason = (req) =>
  String(req.body?.reason || '').replace(/[^\w\sáéíóúñ.,!¡?¿-]/gi, '').slice(0, 100)

playersRouter.get('/whitelist', readLimiter, async (req, res, next) => {
  try {
    const raw = await rconCommand('whitelist list')
    // "There are N whitelisted players: a, b, c" | "There are no whitelisted players"
    const match = raw.match(/whitelisted players?:?(.*)/i)
    const players = match
      ? match[1].split(',').map((n) => n.trim()).filter(Boolean)
      : []
    res.json({ players })
  } catch (err) {
    next(err)
  }
})

playersRouter.get('/banned-ips', readLimiter, async (req, res, next) => {
  try {
    const raw = await rconCommand('banlist ips')
    const ips = [...new Set(raw.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [])]
    res.json({ ips })
  } catch (err) {
    next(err)
  }
})

playersRouter.get('/banned', readLimiter, async (req, res, next) => {
  try {
    const raw = await rconCommand('banlist players')
    const players = [...raw.matchAll(/^(\S+) was banned/gm)].map((m) => m[1])
    res.json({ players })
  } catch (err) {
    next(err)
  }
})

playersRouter.post('/whitelist/add', actionLimiter, async (req, res, next) => {
  const username = getUsername(req, res)
  if (!username) return
  try {
    res.json({ response: await rconCommand(`whitelist add ${username}`) })
  } catch (err) {
    next(err)
  }
})

playersRouter.post('/whitelist/remove', actionLimiter, async (req, res, next) => {
  const username = getUsername(req, res)
  if (!username) return
  try {
    res.json({ response: await rconCommand(`whitelist remove ${username}`) })
  } catch (err) {
    next(err)
  }
})

playersRouter.post('/kick', actionLimiter, async (req, res, next) => {
  const username = getUsername(req, res)
  if (!username) return
  try {
    const reason = getReason(req)
    res.json({ response: await rconCommand(`kick ${username}${reason ? ` ${reason}` : ''}`) })
  } catch (err) {
    next(err)
  }
})

playersRouter.post('/ban', actionLimiter, async (req, res, next) => {
  const username = getUsername(req, res)
  if (!username) return
  try {
    const reason = getReason(req)
    res.json({ response: await rconCommand(`ban ${username}${reason ? ` ${reason}` : ''}`) })
  } catch (err) {
    next(err)
  }
})

playersRouter.post('/pardon', actionLimiter, async (req, res, next) => {
  const username = getUsername(req, res)
  if (!username) return
  try {
    res.json({ response: await rconCommand(`pardon ${username}`) })
  } catch (err) {
    next(err)
  }
})

playersRouter.post('/ban-ip', actionLimiter, async (req, res, next) => {
  const ip = getIp(req, res)
  if (!ip) return
  try {
    const reason = getReason(req)
    res.json({ response: await rconCommand(`ban-ip ${ip}${reason ? ` ${reason}` : ''}`) })
  } catch (err) {
    next(err)
  }
})

playersRouter.post('/pardon-ip', actionLimiter, async (req, res, next) => {
  const ip = getIp(req, res)
  if (!ip) return
  try {
    res.json({ response: await rconCommand(`pardon-ip ${ip}`) })
  } catch (err) {
    next(err)
  }
})
