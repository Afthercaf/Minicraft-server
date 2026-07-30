import path from 'node:path'
import { promises as fs } from 'node:fs'
import { config } from '../config.js'

const dataRoot = path.resolve(config.serverDataPath)

const replacements = new Map([
  ['"Generate Dragon Cave Chance"', '450'],
  ['"Generate Dragon Roost Chance"', '700'],
  ['"Dangerous World Gen Dist From Spawn"', '1500'],
  ['"Dangerous World Gen Dist Seperation"', '700'],
  ['"Dragon Griefing"', '1'],
  ['"Tamed Dragon Griefing"', 'false'],
  ['"Dragon Health"', '350.0'],
  ['"Dragon Attack Damage"', '10'],
  ['"Dragon Attack Damage(Fire breath)"', '1.25'],
  ['"Dragon Attack Damage(Ice breath)"', '1.5'],
  ['"Dragon Attack Damage(Lightning breath)"', '2.0'],
  ['"Dragon Target Search Length"', '64'],
])

export async function applyAdventureBalance() {
  const filename = path.join(dataRoot, 'config', 'iceandfire-common.toml')
  let content
  try { content = await fs.readFile(filename, 'utf8') }
  catch (err) {
    if (err.code === 'ENOENT') return false
    throw err
  }
  for (const [key, value] of replacements) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    content = content.replace(new RegExp(`(${escaped}\\s*=\\s*)[^\\r\\n]+`), `$1${value}`)
  }
  await fs.writeFile(filename, content, 'utf8')
  return true
}
