import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export interface ServerSettings {
  serverName: string
  serverAddress: string
  serverIp: string
  accentColor: string
  serverIcon: string
  maxPlayers: number
  onlineMode: boolean
}

const DEFAULTS: ServerSettings = {
  serverName: 'CraftControl',
  serverAddress: 'killerexpert10.tail29c8ce.ts.net:25565',
  serverIp: '100.76.97.8:25565',
  accentColor: '#10b981',
  serverIcon: '',
  maxPlayers: 10,
  onlineMode: true,
}

export async function loadServerSettings() {
  return api<{ settings: ServerSettings; superadmin: boolean }>('/api/settings')
}

export default function ServerSettingsPanel({ value, onChange }: { value: ServerSettings; onChange: (settings: ServerSettings) => void }) {
  const [form, setForm] = useState(value || DEFAULTS)
  const [superadmin, setSuperadmin] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { setForm(value) }, [value])
  useEffect(() => { loadServerSettings().then((data) => setSuperadmin(data.superadmin)).catch(() => {}) }, [])

  async function imageSelected(file?: File) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return setError('Selecciona una imagen menor a 2 MB')
    const source = await createImageBitmap(file)
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scale = Math.max(64 / source.width, 64 / source.height)
    const width = source.width * scale, height = source.height * scale
    ctx.drawImage(source, (64 - width) / 2, (64 - height) / 2, width, height)
    setForm((prev) => ({ ...prev, serverIcon: canvas.toDataURL('image/png', 0.9) }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setMessage(''); setError('')
    try {
      const result = await api<{ settings: ServerSettings; restartRequired: boolean }>('/api/settings', { method: 'PUT', body: form })
      onChange(result.settings)
      setMessage(result.restartRequired ? 'Guardado. Reinicia Minecraft para aplicar los cambios.' : 'Configuración guardada.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar') }
  }

  if (!superadmin) return null
  return <form onSubmit={save} className="panel mb-6">
    <div className="flex flex-wrap items-center gap-4">
      <label className="group relative grid h-20 w-20 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 hover:border-emerald-600">
        {form.serverIcon ? <img src={form.serverIcon} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl">⛏</span>}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => imageSelected(e.target.files?.[0])} />
        <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-[10px] opacity-0 group-hover:opacity-100">Cambiar</span>
      </label>
      <div><h3 className="text-lg font-semibold">Identidad y conexión</h3><p className="text-sm text-slate-500">Solo el superadmin puede modificar estos datos.</p></div>
    </div>
    {message && <p className="mt-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-400">{message}</p>}
    {error && <p className="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-400">{error}</p>}
    <div className="mt-5 grid gap-x-4 sm:grid-cols-2">
      <div><label className="field-label">Nombre del servidor</label><input className="field" maxLength={50} value={form.serverName} onChange={(e) => setForm({ ...form, serverName: e.target.value })} /></div>
      <div><label className="field-label">Máximo de jugadores</label><input className="field" type="number" min={1} max={500} value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })} /></div>
      <div><label className="field-label">Dirección Tailscale / dominio</label><input className="field font-mono" value={form.serverAddress} onChange={(e) => setForm({ ...form, serverAddress: e.target.value })} placeholder="otra-pc.tailnet.ts.net:25565" /></div>
      <div><label className="field-label">IP alternativa</label><input className="field font-mono" value={form.serverIp} onChange={(e) => setForm({ ...form, serverIp: e.target.value })} placeholder="100.x.x.x:25565" /></div>
      <div><label className="field-label">Color principal</label><div className="flex gap-2"><input className="h-11 w-14 cursor-pointer rounded-lg border border-slate-700 bg-slate-900 p-1" type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })}/><input className="field mt-0 font-mono" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })}/></div></div>
      <div className="sm:col-span-2">
        <label className="field-label">Tipo de acceso</label>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/30 p-1">
          <button type="button" onClick={() => setForm({ ...form, onlineMode: true })} className={`rounded-lg px-4 py-3 text-sm ${form.onlineMode ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>✓ Cuenta oficial</button>
          <button type="button" onClick={() => setForm({ ...form, onlineMode: false })} className={`rounded-lg px-4 py-3 text-sm ${!form.onlineMode ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>Permitir no premium</button>
        </div>
        {!form.onlineMode && <p className="mt-2 rounded-lg bg-amber-950/60 p-3 text-xs text-amber-300">Advertencia: Minecraft no verificará la identidad de los jugadores. Usa whitelist y nunca concedas OP por nombre sin comprobar quién entró.</p>}
      </div>
    </div>
    <button className="button-primary mt-6">Guardar apariencia y servidor</button>
  </form>
}
