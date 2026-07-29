import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function PlayersPanel() {
  const [whitelist, setWhitelist] = useState<string[]>([])
  const [bannedIps, setBannedIps] = useState<string[]>([])
  const [bannedPlayers, setBannedPlayers] = useState<string[]>([])
  const [newPlayer, setNewPlayer] = useState('')
  const [newIp, setNewIp] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [wl, ips, banned] = await Promise.all([
        api<{ players: string[] }>('/api/players/whitelist'),
        api<{ ips: string[] }>('/api/players/banned-ips'),
        api<{ players: string[] }>('/api/players/banned'),
      ])
      setWhitelist(wl.players)
      setBannedIps(ips.ips)
      setBannedPlayers(banned.players)
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
