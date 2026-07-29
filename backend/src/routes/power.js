import { Router } from 'express'
import { rconCommand } from '../lib/rcon.js'
import { createWorldBackup } from '../lib/backups.js'
import { actionLimiter } from '../middleware/rateLimit.js'
import { requirePermission } from '../middleware/auth.js'

export const powerRouter = Router()

powerRouter.post('/restart', requirePermission('power'), actionLimiter, async (req, res, next) => {
  try {
    const backup = await createWorldBackup('before-restart')
    await rconCommand('stop', 5000).catch(() => {})
    res.json({
      ok: true,
      backup,
      note: 'Respaldo completado. El servidor está reiniciando y volverá en 1-3 minutos.',
    })
  } catch (err) { next(err) }
})
