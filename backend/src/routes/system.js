import { Router } from 'express'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { config } from '../config.js'
import { requirePermission } from '../middleware/auth.js'
import { actionLimiter, readLimiter } from '../middleware/rateLimit.js'
import { getCachedJson, redisReady, setCachedJson } from '../lib/redis.js'
import { createWorldBackup, listWorldBackups } from '../lib/backups.js'

const exec = promisify(execFile)
export const systemRouter = Router()
async function docker(args) {
  const { stdout, stderr } = await exec('docker', args, { timeout: 10000, windowsHide: true })
  return `${stdout}${stderr}`.trim()
}

systemRouter.get('/docker', requirePermission('docker'), readLimiter, async (req, res) => {
  try {
    const cached = await getCachedJson('mc-admin:docker-status')
    if (cached) return res.json({ ...cached, cached: true, cache: 'Redis activo' })
    const raw = await docker(['inspect', config.dockerContainer, '--format', '{{json .State}}|{{json .HostConfig}}|{{json .Config.Image}}'])
    const [stateRaw, hostRaw, imageRaw] = raw.split('|')
    const state = JSON.parse(stateRaw), host = JSON.parse(hostRaw)
    const stats = JSON.parse(state.Running ? await docker(['stats', config.dockerContainer, '--no-stream', '--format', '{{json .}}']) : '{}')
    const result = { available: true, container: config.dockerContainer, image: JSON.parse(imageRaw), status: state.Status, running: state.Running, startedAt: state.StartedAt, health: state.Health?.Status || null, restartPolicy: host.RestartPolicy?.Name, cpu: stats.CPUPerc || '0%', memory: stats.MemUsage || '—', network: stats.NetIO || '—' }
    await setCachedJson('mc-admin:docker-status', result, 3)
    res.json({ ...result, cached: false, cache: redisReady ? 'Redis activo' : 'Memoria local' })
  } catch { res.json({ available: false, container: config.dockerContainer, status: 'no disponible' }) }
})

systemRouter.get('/logs', requirePermission('console'), readLimiter, async (req, res) => {
  try {
    const lines = Math.min(Math.max(parseInt(req.query.lines || '250', 10), 20), 1000)
    const cacheKey = `mc-admin:console-logs:${lines}`
    const cached = await getCachedJson(cacheKey)
    if (cached) return res.json({ lines: cached, cached: true })
    const output = await docker(['logs', '--tail', String(lines), '--timestamps', config.dockerContainer])
    const logLines = output.split(/\r?\n/).filter(Boolean)
    await setCachedJson(cacheKey, logLines, 2)
    res.json({ lines: logLines, cached: false })
  } catch { res.status(502).json({ error: 'No se pudieron leer los logs de Docker' }) }
})

systemRouter.post('/action', requirePermission('power'), actionLimiter, async (req, res) => {
  const action = String(req.body?.action || '')
  if (!['start', 'stop', 'restart'].includes(action)) return res.status(400).json({ error: 'Acción inválida' })
  try {
    const backup = ['stop', 'restart'].includes(action) ? await createWorldBackup(`before-${action}`) : null
    await docker([action, config.dockerContainer])
    res.json({ ok: true, action, backup })
  } catch { res.status(502).json({ error: 'Docker no pudo completar la acción o respaldo' }) }
})

systemRouter.get('/backups', requirePermission('files'), readLimiter, async (req, res, next) => {
  try { res.json({ backups: await listWorldBackups() }) } catch (err) { next(err) }
})

systemRouter.post('/backup', requirePermission('power'), actionLimiter, async (req, res, next) => {
  try { res.status(201).json({ backup: await createWorldBackup('manual') }) } catch (err) { next(err) }
})
