import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'No autorizado' })

    const { data, error } = await supabase.auth.getUser(token)
    // Una caída temporal de Supabase no significa que la sesión haya expirado.
    if (error?.status >= 500) {
      return res.status(503).json({ error: 'Autenticación temporalmente no disponible' })
    }
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Sesión inválida' })
    }

    const superadmin = (data.user.email || '').toLowerCase() === config.superadminEmail
    req.user = {
      id: data.user.id,
      email: data.user.email,
      superadmin,
      permissions: superadmin ? ['*'] : (data.user.app_metadata?.permissions || []),
    }
    next()
  } catch {
    return res.status(503).json({ error: 'Autenticación temporalmente no disponible' })
  }
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (req.user?.superadmin || req.user?.permissions?.includes(permission)) return next()
    return res.status(403).json({ error: 'No tienes permiso para esta sección' })
  }
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.superadmin) return next()
  return res.status(403).json({ error: 'Solo el superadmin puede realizar esta acción' })
}
