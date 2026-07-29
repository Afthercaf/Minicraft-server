import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redisClient, redisReady } from '../lib/redis.js'

// P1 del MD: rate limiting asimetrico por tipo de endpoint
const base = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Demasiadas solicitudes, intenta mas tarde' })
  },
}

const store = (prefix) => redisReady && redisClient
  ? new RedisStore({
      prefix: `mc-admin:${prefix}:`,
      sendCommand: (...args) => redisClient.sendCommand(args),
    })
  : undefined

// Comandos de consola y acciones de jugadores: lo mas restrictivo
export const actionLimiter = rateLimit({ ...base, store: store('action'), windowMs: 60_000, limit: 10 })

// Escritura de archivos y configuracion
export const writeLimiter = rateLimit({ ...base, store: store('write'), windowMs: 60_000, limit: 20 })

// Lecturas (logs, listados, estado)
export const readLimiter = rateLimit({ ...base, store: store('read'), windowMs: 60_000, limit: 60 })

// Red global de seguridad
export const globalLimiter = rateLimit({ ...base, store: store('global'), windowMs: 15 * 60_000, limit: 300 })
