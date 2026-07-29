import rateLimit from 'express-rate-limit'

// P1 del MD: rate limiting asimetrico por tipo de endpoint
const base = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Demasiadas solicitudes, intenta mas tarde' })
  },
}

// Comandos de consola y acciones de jugadores: lo mas restrictivo
export const actionLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 10 })

// Escritura de archivos y configuracion
export const writeLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 20 })

// Lecturas (logs, listados, estado)
export const readLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 60 })

// Red global de seguridad
export const globalLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 300 })
