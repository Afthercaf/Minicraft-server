import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import ConsolePanel from '../components/ConsolePanel'
import PlayersPanel from '../components/PlayersPanel'
import ConfigPanel from '../components/ConfigPanel'
import FilesPanel from '../components/FilesPanel'
import DockerPanel from '../components/DockerPanel'
import UsersPanel from '../components/UsersPanel'
import ServerSettingsPanel, { loadServerSettings, type ServerSettings } from '../components/ServerSettingsPanel'

type Tab = 'overview' | 'console' | 'files' | 'players' | 'config' | 'docker' | 'users'
interface Me { user: { email: string; superadmin: boolean; permissions: string[] } }
interface Status { online: boolean; players: { online: number; max: number; names: string[] } }
const DEFAULT_SETTINGS: ServerSettings = { serverName: 'CraftControl', serverAddress: 'killerexpert10.tail29c8ce.ts.net:25565', serverIp: '100.76.97.8:25565', accentColor: '#10b981', serverIcon: '', maxPlayers: 10 }

const TABS: { id: Tab; label: string; icon: string; permission?: string; superadmin?: boolean }[] = [
  { id: 'overview', label: 'Resumen', icon: '▦', permission: 'status' },
  { id: 'console', label: 'Consola', icon: '>_', permission: 'console' },
  { id: 'files', label: 'Archivos y mods', icon: '▣', permission: 'files' },
  { id: 'players', label: 'Jugadores', icon: '♟', permission: 'players' },
  { id: 'config', label: 'Configuración', icon: '⚙', permission: 'config' },
  { id: 'docker', label: 'Docker', icon: '◈', permission: 'docker' },
  { id: 'users', label: 'Cuentas y permisos', icon: '♜', superadmin: true },
]

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('overview')
  const [me, setMe] = useState<Me['user'] | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<ServerSettings>(DEFAULT_SETTINGS)
  const has = useCallback((permission?: string): boolean => !!me?.superadmin || !permission || !!me?.permissions.includes(permission), [me])

  const loadStatus = useCallback(async () => {
    if (!has('status')) return
    try { setStatus(await api<Status>('/api/console/status')); setError('') }
    catch (err) { setError(err instanceof Error ? err.message : 'Sin conexión') }
  }, [has])

  useEffect(() => {
    let active = true
    api<Me>('/api/me')
      .then((data) => { if (active) setMe(data.user) })
      .catch(async () => {
        // Borra solo la sesión de este navegador. No hace una petición global
        // de logout que pueda fallar cuando el token ya expiró.
        await supabase.auth.signOut({ scope: 'local' })
      })
    return () => { active = false }
  }, [])
  useEffect(() => { if (me) loadServerSettings().then((data) => setSettings(data.settings)).catch(() => {}) }, [me])
  useEffect(() => { loadStatus(); const id = setInterval(loadStatus, 15000); return () => clearInterval(id) }, [loadStatus])

  const visibleTabs = TABS.filter((item) => item.superadmin ? me?.superadmin : has(item.permission))

  return (
    <div className="min-h-screen bg-[#080b10] md:flex">
      <aside className="border-b border-slate-800 bg-[#0d1118] md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 border-b border-slate-800 p-5">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl text-xl" style={{ backgroundColor: `${settings.accentColor}22` }}>{settings.serverIcon ? <img src={settings.serverIcon} alt="" className="h-full w-full object-cover" /> : '⛏'}</div>
          <div className="min-w-0"><h1 className="truncate font-bold">{settings.serverName}</h1><p className="text-xs text-slate-500">Panel del servidor</p></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-3 md:block md:space-y-1">
          {visibleTabs.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition md:w-full ${tab === item.id ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'}`}>
              <span className="w-5 text-center font-mono">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="hidden border-t border-slate-800 p-4 md:absolute md:bottom-0 md:block md:w-full">
          <p className="truncate text-sm text-slate-300">{me?.email}</p>
          <p className="text-xs text-emerald-500">{me?.superadmin ? 'Superadmin' : 'Usuario autorizado'}</p>
          <button onClick={() => supabase.auth.signOut({ scope: 'local' })} className="mt-3 text-xs text-slate-500 hover:text-white">Cerrar sesión</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-800 bg-[#0b0f15]/90 px-5 py-4 backdrop-blur md:px-8">
          <div><h2 className="text-lg font-semibold">{TABS.find((t) => t.id === tab)?.label}</h2><p className="text-xs text-slate-500">Administración visual y segura</p></div>
          <div className={`rounded-full border px-3 py-1.5 text-xs ${status?.online ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400' : 'border-red-900 bg-red-950/50 text-red-400'}`}>
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${status?.online ? 'bg-emerald-400' : 'bg-red-500'}`} />
            {status?.online ? `En línea · ${status.players.online}/${status.players.max}` : 'Fuera de línea'}
          </div>
        </header>
        <div className="p-4 md:p-8">
          {error && <div className="mb-5 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}
          {tab === 'overview' && <Overview status={status} setTab={setTab} has={has} settings={settings} />}
          {tab === 'console' && <ConsolePanel />}
          {tab === 'files' && <FilesPanel />}
          {tab === 'players' && <PlayersPanel />}
          {tab === 'config' && <><ServerSettingsPanel value={settings} onChange={setSettings} /><ConfigPanel /></>}
          {tab === 'docker' && <DockerPanel />}
          {tab === 'users' && me?.superadmin && <UsersPanel />}
        </div>
      </main>
    </div>
  )
}

function Overview({ status, setTab, has, settings }: { status: Status | null; setTab: (tab: Tab) => void; has: (p?: string) => boolean; settings: ServerSettings }) {
  const [copied, setCopied] = useState(false)
  const serverAddress = settings.serverAddress
  async function copyAddress() {
    await navigator.clipboard.writeText(serverAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const cards = [
    { label: 'Estado', value: status?.online ? 'Funcionando' : 'Detenido', detail: 'Servidor Minecraft', color: status?.online ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Jugadores', value: `${status?.players.online ?? 0} / ${status?.players.max || settings.maxPlayers}`, detail: status?.players.names.join(', ') || 'Nadie conectado', color: 'text-sky-400' },
    { label: 'Edición', value: 'Forge', detail: 'Minecraft 1.20.1', color: 'text-violet-400' },
  ]
  return <div className="space-y-6">
    <div className="flex items-center gap-4">{settings.serverIcon && <img src={settings.serverIcon} alt="" className="h-14 w-14 rounded-xl object-cover" />}<div><h3 className="text-2xl font-bold">{settings.serverName}</h3><p className="mt-1 text-sm text-slate-400">Todo lo importante en un solo lugar.</p></div></div>
    <div className="overflow-hidden rounded-2xl border bg-gradient-to-r from-emerald-950/70 to-[#10151d] p-5" style={{ borderColor: `${settings.accentColor}66`, boxShadow: `0 12px 40px ${settings.accentColor}0d` }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: settings.accentColor }}>Dirección para jugar</p>
          <p className="mt-2 break-all font-mono text-lg font-semibold text-white">{serverAddress}</p>
          <p className="mt-1 text-xs text-slate-400">Los jugadores deben estar conectados a la red privada de Tailscale.</p>
        </div>
        <button onClick={copyAddress} className="button-primary min-w-32">
          {copied ? '✓ Copiada' : 'Copiar dirección'}
        </button>
      </div>
      <details className="mt-4 border-t border-emerald-900/50 pt-3 text-xs text-slate-500">
        <summary className="cursor-pointer hover:text-slate-300">Mostrar IP directa</summary>
        <p className="mt-2 font-mono text-slate-300">{settings.serverIp || 'Sin IP alternativa'}</p>
      </details>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">{cards.map((c) => <div key={c.label} className="panel"><p className="text-xs uppercase tracking-wider text-slate-500">{c.label}</p><p className={`mt-3 text-2xl font-bold ${c.color}`}>{c.value}</p><p className="mt-1 truncate text-xs text-slate-500">{c.detail}</p></div>)}</div>
    <div className="panel"><h3 className="font-semibold">Accesos rápidos</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[['console','Abrir consola','Ver logs en vivo y enviar comandos','console'],['files','Explorar archivos','Revisar mods, configs y mundos','files'],['docker','Ver Docker','Estado, memoria, CPU y controles','docker'],['players','Administrar jugadores','Whitelist, OPs y bloqueos','players']].filter((x) => has(x[3])).map((x) =>
        <button key={x[0]} onClick={() => setTab(x[0] as Tab)} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left hover:border-emerald-700"><p className="font-medium">{x[1]}</p><p className="mt-1 text-xs text-slate-500">{x[2]}</p></button>)}
    </div></div>
  </div>
}
