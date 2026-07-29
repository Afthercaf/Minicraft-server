import helmet from 'helmet'
import cors from 'cors'
import { config } from '../config.js'

// Headers completos replicando la infraestructura del MD auditado (92/100)
export const securityHeaders = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    xssFilter: true,
  }),
  (req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
    )
    res.setHeader('Cache-Control', 'no-store')
    next()
  },
]

// CORS estricto: solo el origen exacto del frontend (MD: "Origen no permitido")
export const strictCors = cors({
  origin: (origin, callback) => {
    if (!origin || config.frontendUrls.includes(origin.replace(/\/+$/, ''))) {
      return callback(null, true)
    }
    return callback(Object.assign(new Error('Origen no permitido'), { status: 403 }))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
})

// P0 del MD: CSRF - exigir X-Requested-With en toda peticion que muta estado
export function csrfProtection(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      return res.status(403).json({ error: 'Solicitud rechazada' })
    }
  }
  next()
}

// Content-Type restringido a JSON (MD: "Solo se acepta application/json")
export function jsonContentTypeOnly(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = String(req.headers['content-type'] || '').toLowerCase()
    const uploadPath = (req.originalUrl || req.url || '').split('?', 1)[0]
    if (
      req.method === 'POST' &&
      uploadPath === '/api/files/mods' &&
      contentType.startsWith('multipart/form-data;')
    ) {
      return next()
    }
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Solo se acepta application/json' })
    }
  }
  next()
}
