import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import ConsolePanel from '../components/ConsolePanel'
import PlayersPanel from '../components/PlayersPanel'
import ConfigPanel from '../components/ConfigPanel'

type Tab = 'consola' | 'jugadores' | 'config'

interface Status {
  online: boolean
  players: { online: number; max: number; names: string[] }
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'consola', label: 'Consola' },
  { id: 'jugadores', label: 'Jugadores e IPs' },
  { id: 'config', label: 'Configuración' },
]

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('consola')
  const [status, setStatus] = useState<Status | null>(null)
  const [statusError, setStatusError] = useState('')
  const [restarting, setRestarting] = useState(false)

  async function restartServer() {
    if (!window.confirm('¿Reiniciar el servidor? Los jugadores serán desconectados (1-3 min).')) {
      return
    }
    setRestarting(true)
    try {
      const result = await api<{ note: string }>('/api/power/restart', { method: 'POST', body: {} })
      window.alert(result.note)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setRestarting(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api<Status>('/api/console/status')
        if (!cancelled) {
          setStatus(data)
          setStatusError('')
        }
      } catch (err) {
        if (!cancelled) setStatusError(err instanceof Error ? err.message : 'Error')
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="font-bold">Panel MC Admin</h1>
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status?.online ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              {statusError
                ? 'Error de acceso'
                : status?.online
                  ? `En línea — ${status.players.online}/${status.players.max}`
                  : 'Apagado'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={restartServer}
              disabled={restarting || !status?.online}
              className="rounded-lg border border-amber-700 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-950 disabled:opacity-40"
            >
              {restarting ? 'Reiniciando…' : '↻ Reiniciar'}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === t.id
                  ? 'bg-emerald-600 font-semibold text-white'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {statusError && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-300">
            {statusError}
          </div>
        )}
        {tab === 'consola' && <ConsolePanel />}
        {tab === 'jugadores' && <PlayersPanel />}
        {tab === 'config' && <ConfigPanel />}
      </main>
    </div>
  )
}
