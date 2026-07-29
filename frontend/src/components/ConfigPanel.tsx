import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

const DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard'] as const

// Gamerules booleanas que se muestran como interruptores
const BOOLEAN_RULES = new Set([
  'keepInventory',
  'mobGriefing',
  'doDaylightCycle',
  'doWeatherCycle',
  'doMobSpawning',
  'doFireTick',
  'pvp',
  'announceAdvancements',
  'naturalRegeneration',
  'showDeathMessages',
  'fallDamage',
  'fireDamage',
  'drowningDamage',
])

export default function ConfigPanel() {
  const [rules, setRules] = useState<Record<string, string>>({})
  const [difficulty, setDifficulty] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [rulesData, diffData] = await Promise.all([
        api<{ rules: Record<string, string> }>('/api/config/gamerules'),
        api<{ difficulty: string }>('/api/config/difficulty'),
      ])
      setRules(rulesData.rules)
      setDifficulty(diffData.difficulty)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function setGamerule(rule: string, value: string) {
    setMessage('')
    setError('')
    try {
      await api('/api/config/gamerules', { method: 'POST', body: { rule, value } })
      setRules((prev) => ({ ...prev, [rule]: value }))
      setMessage(`${rule} = ${value}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function applyDifficulty(value: string) {
    setMessage('')
    setError('')
    try {
      await api('/api/config/difficulty', { method: 'POST', body: { difficulty: value } })
      setDifficulty(value)
      setMessage(`Dificultad: ${value}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  const sortedRules = Object.entries(rules).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-2 text-sm text-emerald-300">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-semibold">Dificultad</h2>
        <div className="mt-3 flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => applyDifficulty(d)}
              className={`rounded-lg px-4 py-2 text-sm capitalize ${
                difficulty === d
                  ? 'bg-emerald-600 font-semibold'
                  : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-semibold">Gamerules</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {sortedRules.length === 0 && (
            <p className="text-sm text-zinc-500">
              No se pudieron cargar (¿el servidor está encendido?)
            </p>
          )}
          {sortedRules.map(([rule, value]) => (
            <div
              key={rule}
              className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm"
            >
              <span className="font-mono text-zinc-300">{rule}</span>
              {BOOLEAN_RULES.has(rule) ? (
                <button
                  onClick={() => setGamerule(rule, value === 'true' ? 'false' : 'true')}
                  className={`rounded px-3 py-1 text-xs font-semibold ${
                    value === 'true'
                      ? 'bg-emerald-700 text-emerald-100'
                      : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {value}
                </button>
              ) : (
                <span className="text-xs text-zinc-500">{value}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-semibold">Configuración avanzada (solo admin local)</h2>
        <p className="mt-2 text-sm text-zinc-400">
          El máximo de jugadores, el MOTD, la memoria y demás opciones de{' '}
          <code>server.properties</code>, así como los mods y archivos del servidor, solo los puede
          cambiar el admin directamente en esta PC:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-400">
          <li>
            Jugadores máximos y opciones base: edita <code>.env</code> (MAX_PLAYERS, MOTD…) y
            reinicia con <code>docker compose up -d</code>
          </li>
          <li>
            <strong>Poner mods:</strong> copia los <code>.jar</code> a <code>server-data\mods\</code>{' '}
            y luego pulsa <strong>↻ Reiniciar</strong> arriba a la derecha del panel — el servidor
            carga los mods nuevos al arrancar
          </li>
          <li>
            Quitar mods: borra el <code>.jar</code> de <code>server-data\mods\</code> y reinicia
          </li>
          <li>
            Apagar/encender del todo (sin auto-arranque): <code>docker compose stop</code> /{' '}
            <code>docker compose start</code> — solo desde esta PC
          </li>
          <li>
            Configs de Forge/mods: <code>server-data\config\</code> y{' '}
            <code>server-data\server.properties</code>
          </li>
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          No hay gestor de archivos web a propósito: menos superficie de ataque.
        </p>
      </section>
    </div>
  )
}
