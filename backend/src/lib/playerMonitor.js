import path from 'node:path'
import { promises as fs } from 'node:fs'
import nbt from 'prismarine-nbt'
import { config } from '../config.js'

const root = path.resolve(config.serverDataPath)
const playerDataRoot = path.join(root, 'world', 'playerdata')
const cacheFile = path.join(root, 'panel-player-snapshots.json')
const deathsFile = path.join(root, 'panel-deaths.json')
let snapshots = {}
let deaths = []
let refreshing = null

async function loadPersisted() {
  try { snapshots = JSON.parse(await fs.readFile(cacheFile, 'utf8')) } catch {}
  try { deaths = JSON.parse(await fs.readFile(deathsFile, 'utf8')) } catch {}
}
await loadPersisted()

const cleanItem = (item) => ({
  slot: Number(item.Slot ?? -1),
  id: String(item.id || 'minecraft:air'),
  count: Number(item.Count ?? 0),
})

function cleanLocation(value) {
  if (!value) return null
  const pos = value.pos || value.Pos
  return {
    dimension: String(value.dimension || value.Dimension || 'minecraft:overworld'),
    x: Number(pos?.[0] ?? 0),
    y: Number(pos?.[1] ?? 0),
    z: Number(pos?.[2] ?? 0),
  }
}

async function readPlayer(uuid, name) {
  const buffer = await fs.readFile(path.join(playerDataRoot, `${uuid}.dat`))
  const parsed = await nbt.parse(buffer)
  const data = nbt.simplify(parsed.parsed)
  const position = Array.isArray(data.Pos) ? { x: Number(data.Pos[0]), y: Number(data.Pos[1]), z: Number(data.Pos[2]), dimension: String(data.Dimension || 'minecraft:overworld') } : null
  return {
    uuid,
    name,
    position,
    lastDeath: cleanLocation(data.LastDeathLocation),
    health: Number(data.Health ?? 0),
    level: Number(data.XpLevel ?? 0),
    gameMode: Number(data.playerGameType ?? 0),
    inventory: Array.isArray(data.Inventory) ? data.Inventory.map(cleanItem).filter((item) => item.count > 0) : [],
    updatedAt: new Date().toISOString(),
  }
}

export async function refreshPlayerSnapshots() {
  if (refreshing) return refreshing
  refreshing = (async () => {
    let users = []
    try { users = JSON.parse(await fs.readFile(path.join(root, 'usercache.json'), 'utf8')) } catch {}
    const next = {}
    for (const user of users) {
      try {
        const player = await readPlayer(user.uuid, user.name)
        const previous = snapshots[user.uuid]
        const oldDeath = JSON.stringify(previous?.lastDeath || null)
        const newDeath = JSON.stringify(player.lastDeath || null)
        if (previous && player.lastDeath && oldDeath !== newDeath) {
          deaths.unshift({
            id: `${user.uuid}-${Date.now()}`,
            player: user.name,
            uuid: user.uuid,
            diedAt: new Date().toISOString(),
            location: player.lastDeath,
            inventoryBeforeDeath: previous.inventory || [],
          })
          deaths = deaths.slice(0, 200)
        }
        next[user.uuid] = player
      } catch { /* Ignora datos de jugador incompletos mientras Minecraft guarda. */ }
    }
    snapshots = { ...snapshots, ...next }
    await Promise.all([
      fs.writeFile(cacheFile, JSON.stringify(snapshots, null, 2), 'utf8'),
      fs.writeFile(deathsFile, JSON.stringify(deaths, null, 2), 'utf8'),
    ])
    return Object.values(snapshots)
  })().finally(() => { refreshing = null })
  return refreshing
}

export const getDeathHistory = () => deaths
setTimeout(() => refreshPlayerSnapshots().catch(() => {}), 5000).unref()
setInterval(() => refreshPlayerSnapshots().catch(() => {}), 30_000).unref()
