import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Verifica el JWT de Supabase y exige que sea el superadmin.
// Cualquier otro usuario autenticado recibe 403 en TODO.
export async function requireSuperAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'No autorizado' })
    }

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Sesión inválida' })
    }

    if ((data.user.email || '').toLowerCase() !== config.superadminEmail) {
      return res.status(403).json({ error: 'Acceso denegado' })
    }

    req.user = { id: data.user.id, email: data.user.email }
    next()
  } catch {
    return res.status(401).json({ error: 'Sesión inválida' })
  }
}
