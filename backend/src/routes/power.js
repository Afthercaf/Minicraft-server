import { Router } from 'express'
import { rconCommand } from '../lib/rcon.js'
import { actionLimiter } from '../middleware/rateLimit.js'

export const powerRouter = Router()

// Reinicio: RCON stop apaga el proceso de Minecraft y la politica
// restart=unless-stopped del contenedor lo levanta de nuevo = reinicio completo.
// (El stop real sin auto-arranque solo se hace localmente con: docker compose stop)
powerRouter.post('/restart', actionLimiter, async (req, res, next) => {
  try {
    // El servidor cierra la conexion al apagarse: ignoramos el error esperado
    await rconCommand('stop', 5000).catch(() => {})
    res.json({
      ok: true,
      note: 'Servidor reiniciando… vuelve en 1-3 minutos. Los jugadores fueron desconectados.',
    })
  } catch (err) {
    next(err)
  }
})
