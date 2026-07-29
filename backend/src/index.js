import express from 'express'
import { config } from './config.js'
import { securityHeaders, strictCors, csrfProtection, jsonContentTypeOnly } from './middleware/security.js'
import { globalLimiter } from './middleware/rateLimit.js'
import { requireAuth } from './middleware/auth.js'
import { consoleRouter } from './routes/console.js'
import { configRouter } from './routes/config.js'
import { playersRouter } from './routes/players.js'
import { powerRouter } from './routes/power.js'
import { filesRouter } from './routes/files.js'
import { systemRouter } from './routes/system.js'
import { usersRouter } from './routes/users.js'
import { redisReady } from './lib/redis.js'
import { settingsRouter } from './routes/settings.js'

const app = express()

app.set('trust proxy', 1) // Render va detras de proxy
app.disable('x-powered-by')

// ---- Capas de seguridad (orden importa) ----
app.use(securityHeaders)
app.use(strictCors)
app.use(globalLimiter)
app.use(csrfProtection)
app.use(jsonContentTypeOnly)
app.use(express.json({ limit: '300kb' }))

// ---- Unico endpoint publico: health check de Render ----
app.get('/healthz', (req, res) => res.json({ ok: true, cache: redisReady ? 'redis' : 'memory' }))

// ---- Todo lo demas exige JWT de Supabase + email superadmin ----
app.use('/api', requireAuth)
app.get('/api/me', (req, res) => res.json({ user: req.user }))
app.use('/api/console', consoleRouter)
app.use('/api/config', configRouter)
app.use('/api/players', playersRouter)
app.use('/api/power', powerRouter)
app.use('/api/files', filesRouter)
app.use('/api/system', systemRouter)
app.use('/api/users', usersRouter)
app.use('/api/settings', settingsRouter)

// 404 - sin filtrar rutas existentes (MD: paths admin ocultos)
app.use((req, res) => res.status(404).json({ error: 'No encontrado' }))

// Manejador de errores: mensajes genericos, sin stack traces (MD: errores 422 genericos)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500
  const safeMessages = {
    400: 'Solicitud inválida',
    403: err.message === 'Origen no permitido' ? 'Origen no permitido' : 'Acceso denegado',
    404: 'No encontrado',
    413: 'Solicitud demasiado grande',
    415: 'Solo se acepta application/json',
    429: 'Demasiadas solicitudes, intenta mas tarde',
    502: 'No se pudo conectar con el servidor de Minecraft',
    504: 'El servidor no respondio a tiempo',
  }
  res.status(status).json({ error: safeMessages[status] || 'Error interno' })
})

app.listen(config.port, () => {
  console.log(`Backend escuchando en puerto ${config.port}`)
})
