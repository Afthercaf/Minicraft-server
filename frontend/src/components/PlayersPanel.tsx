import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Item { slot: number; id: string; count: number }
interface PlayerDetail { uuid: string; name: string; position: { x: number; y: number; z: number; dimension: string } | null; lastDeath: { x: number; y: number; z: number; dimension: string } | null; health: number; level: number; inventory: Item[]; updatedAt: string }
interface DeathRecord { id: string; player: string; diedAt: string; location: { x: number; y: number; z: number; dimension: string }; inventoryBeforeDeath: Item[] }

export default function PlayersPanel() {
  const [whitelist, setWhitelist] = useState<string[]>([])
  const [bannedIps, setBannedIps] = useState<string[]>([])
  const [bannedPlayers, setBannedPlayers] = useState<string[]>([])
  const [newPlayer, setNewPlayer] = useState('')
  const [newIp, setNewIp] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [details, setDetails] = useState<PlayerDetail[]>([])
  const [deaths, setDeaths] = useState<DeathRecord[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [wl, ips, banned, playerData, deathData] = await Promise.all([
        api<{ players: string[] }>('/api/players/whitelist'),
        api<{ ips: string[] }>('/api/players/banned-ips'),
        api<{ players: string[] }>('/api/players/banned'),
        api<{ players: PlayerDetail[] }>('/api/players/details'),
        api<{ deaths: DeathRecord[] }>('/api/players/deaths'),
      ])
      setWhitelist(wl.players)
      setBannedIps(ips.ips)
      setBannedPlayers(banned.players)
      setDetails(playerData.players)
      setDeaths(deathData.deaths)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function action(path: string, body: unknown, okMessage: string) {
    setMessage('')
    setError('')
    try {
      const { response } = await api<{ response: string }>(path, { method: 'POST', body })
      setMessage(response || okMessage)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-2 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <section className="panel">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold">Jugadores e inventarios</h2><p className="text-xs text-slate-500">Datos guardados del mundo, actualizados cada 30 segundos.</p></div><button onClick={load} className="button-secondary">Actualizar</button></div>
        {details.length === 0 ? <p className="mt-4 text-sm text-slate-500">Todavía no hay datos de jugadores guardados.</p> :
        <div className="mt-4 grid gap-3 lg:grid-cols-2">{details.map((player) => <div key={player.uuid} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <button onClick={() => setSelectedPlayer(selectedPlayer === player.uuid ? null : player.uuid)} className="w-full text-left"><div className="flex items-center justify-between"><div><p className="font-semibold text-sky-300">{player.name}</p><p className="text-xs text-slate-500">Nivel {player.level} · Vida {Math.round(player.health)}/20</p></div><span className="text-xs text-slate-500">{player.inventory.length} objetos</span></div>
          {player.position && <p className="mt-2 font-mono text-xs text-slate-400">Posición: {Math.round(player.position.x)}, {Math.round(player.position.y)}, {Math.round(player.position.z)} · {player.position.dimension.replace('minecraft:','')}</p>}
          {player.lastDeath && <p className="mt-1 font-mono text-xs text-red-400">Última muerte: {player.lastDeath.x}, {player.lastDeath.y}, {player.lastDeath.z} · {player.lastDeath.dimension.replace('minecraft:','')}</p>}</button>
          {selectedPlayer === player.uuid && <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 sm:grid-cols-3">{player.inventory.map((item, i) => <div key={`${item.slot}-${i}`} className="rounded-lg bg-slate-900 p-2 text-xs"><p className="truncate text-slate-300">{item.id.replace('minecraft:','')}</p><p className="text-slate-600">x{item.count} · slot {item.slot}</p></div>)}</div>}
        </div>)}</div>}
      </section>

      <section className="panel">
        <h2 className="font-semibold">Historial de muertes</h2><p className="mt-1 text-xs text-slate-500">Conserva coordenadas y la última instantánea del inventario anterior a la muerte.</p>
        {deaths.length === 0 ? <p className="mt-4 text-sm text-slate-500">No se han detectado muertes desde que se activó el monitor.</p> :
        <div className="mt-4 space-y-3">{deaths.map((death) => <details key={death.id} className="rounded-xl border border-red-950 bg-red-950/20 p-3"><summary className="cursor-pointer text-sm"><span className="font-semibold text-red-300">{death.player}</span> · {new Date(death.diedAt).toLocaleString()} · <span className="font-mono">{death.location.x}, {death.location.y}, {death.location.z}</span></summary><div className="mt-3 flex flex-wrap gap-2">{death.inventoryBeforeDeath.map((item, i) => <span key={i} className="rounded bg-slate-900 px-2 py-1 text-xs text-slate-300">{item.id.replace('minecraft:','')} ×{item.count}</span>)}</div></details>)}</div>}
      </section>
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Whitelist: quien PUEDE entrar */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-semibold">Whitelist — quiénes pueden entrar</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newPlayer.trim()) {
              action('/api/players/whitelist/add', { username: newPlayer.trim() }, 'Agregado')
              setNewPlayer('')
            }
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            placeholder="Nombre de jugador"
            maxLength={16}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
          >
            Permitir
          </button>
        </form>
        <ul className="mt-3 space-y-1">
          {whitelist.length === 0 && <li className="text-sm text-zinc-500">Whitelist vacía</li>}
          {whitelist.map((player) => (
            <li
              key={player}
              className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm"
            >
              <span>{player}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => action('/api/players/kick', { username: player, reason }, 'Expulsado')}
                  className="rounded border border-amber-700 px-2 py-1 text-xs text-amber-400 hover:bg-amber-950"
                >
                  Kick
                </button>
                <button
                  onClick={() => action('/api/players/ban', { username: player, reason }, 'Baneado')}
                  className="rounded border border-red-700 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
                >
                  Ban
                </button>
                <button
                  onClick={() =>
                    action('/api/players/whitelist/remove', { username: player }, 'Quitado de la whitelist')
                  }
                  className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* IPs bloqueadas: quien NO puede entrar */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-semibold">IPs bloqueadas — quiénes NO pueden entrar</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newIp.trim()) {
              action('/api/players/ban-ip', { ip: newIp.trim(), reason }, 'IP bloqueada')
              setNewIp('')
              setReason('')
            }
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="IP a bloquear (ej: 203.0.113.50)"
            maxLength={15}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-red-500"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Razón (opcional)"
            maxLength={100}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-red-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
          >
            Bloquear IP
          </button>
        </form>
        <ul className="mt-3 space-y-1">
          {bannedIps.length === 0 && <li className="text-sm text-zinc-500">No hay IPs bloqueadas</li>}
          {bannedIps.map((ip) => (
            <li
              key={ip}
              className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm"
            >
              <span className="font-mono">{ip}</span>
              <button
                onClick={() => action('/api/players/pardon-ip', { ip }, 'IP desbloqueada')}
                className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700"
              >
                Desbloquear
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Jugadores baneados */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-semibold">Jugadores baneados</h2>
        <ul className="mt-3 space-y-1">
          {bannedPlayers.length === 0 && (
            <li className="text-sm text-zinc-500">No hay jugadores baneados</li>
          )}
          {bannedPlayers.map((player) => (
            <li
              key={player}
              className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm"
            >
              <span>{player}</span>
              <button
                onClick={() => action('/api/players/pardon', { username: player }, 'Perdonado')}
                className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700"
              >
                Perdonar
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
