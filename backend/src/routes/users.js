import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'
import { requireSuperAdmin } from '../middleware/auth.js'
import { actionLimiter, readLimiter } from '../middleware/rateLimit.js'

export const usersRouter = Router()
usersRouter.use(requireSuperAdmin)
const admin = config.supabaseServiceRoleKey
  ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false } })
  : null
const allowed = new Set(['status', 'console', 'players', 'config', 'files', 'mods', 'docker', 'power'])
const cleanPermissions = (value) => Array.isArray(value) ? [...new Set(value.filter((p) => allowed.has(p)))] : []

function requireAdminClient(res) {
  if (admin) return true
  res.status(503).json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY' })
  return false
}

usersRouter.get('/', readLimiter, async (req, res) => {
  if (!requireAdminClient(res)) return
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) return res.status(502).json({ error: 'No se pudieron cargar las cuentas' })
  res.json({ users: data.users.map((u) => ({ id: u.id, email: u.email, createdAt: u.created_at, permissions: u.app_metadata?.permissions || [], superadmin: (u.email || '').toLowerCase() === config.superadminEmail })) })
})

usersRouter.post('/', actionLimiter, async (req, res) => {
  if (!requireAdminClient(res)) return
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!email.includes('@') || password.length < 10) return res.status(400).json({ error: 'Email inválido o contraseña menor a 10 caracteres' })
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { permissions: cleanPermissions(req.body?.permissions) } })
  if (error) return res.status(400).json({ error: 'No se pudo crear la cuenta' })
  res.status(201).json({ id: data.user.id })
})

usersRouter.put('/:id', actionLimiter, async (req, res) => {
  if (!requireAdminClient(res)) return
  const { data: target } = await admin.auth.admin.getUserById(req.params.id)
  if ((target?.user?.email || '').toLowerCase() === config.superadminEmail) return res.status(403).json({ error: 'La cuenta superadmin no se puede modificar' })
  const { error } = await admin.auth.admin.updateUserById(req.params.id, { app_metadata: { permissions: cleanPermissions(req.body?.permissions) } })
  if (error) return res.status(400).json({ error: 'No se pudieron guardar los permisos' })
  res.json({ ok: true })
})

usersRouter.delete('/:id', actionLimiter, async (req, res) => {
  if (!requireAdminClient(res)) return
  const { data: target } = await admin.auth.admin.getUserById(req.params.id)
  if ((target?.user?.email || '').toLowerCase() === config.superadminEmail) return res.status(403).json({ error: 'La cuenta superadmin no se puede eliminar' })
  const { error } = await admin.auth.admin.deleteUser(req.params.id)
  if (error) return res.status(400).json({ error: 'No se pudo eliminar la cuenta' })
  res.json({ ok: true })
})
