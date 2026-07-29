import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
interface DockerInfo { available: boolean; container: string; image?: string; status: string; running?: boolean; startedAt?: string; health?: string; restartPolicy?: string; cpu?: string; memory?: string; network?: string; cache?: string }
export default function DockerPanel() {
  const [info, setInfo] = useState<DockerInfo | null>(null); const [busy, setBusy] = useState(''); const [error, setError] = useState('')
  const load = useCallback(async () => { try { setInfo(await api('/api/system/docker')); setError('') } catch(e) { setError(e instanceof Error ? e.message : 'Error') } }, [])
  useEffect(() => { load(); const id=setInterval(load,5000); return()=>clearInterval(id) }, [load])
  async function action(value:string) { if ((value==='stop'||value==='restart') && !confirm(`¿Seguro que deseas ${value==='stop'?'detener':'reiniciar'} el servidor?`)) return; setBusy(value); try { await api('/api/system/action',{method:'POST',body:{action:value}}); setTimeout(load,1000) } catch(e){setError(e instanceof Error?e.message:'Error')} finally{setBusy('')} }
  return <div className="space-y-5">
    <div className="panel flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-500/15 text-3xl">◈</div><div><h3 className="text-lg font-semibold">{info?.container || 'mc-forge'}</h3><p className="text-sm text-slate-500">{info?.image || 'Contenedor de Minecraft'}</p></div></div>
      <span className={`rounded-full px-3 py-1 text-sm ${info?.running?'bg-emerald-500/15 text-emerald-400':'bg-red-500/15 text-red-400'}`}>{info?.available ? info.status : 'Docker no disponible'}</span></div>
    {error && <p className="text-sm text-red-400">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[['CPU',info?.cpu],['Memoria',info?.memory],['Red',info?.network],['Salud',info?.health||'Sin healthcheck'],['Caché',info?.cache||'Memoria local']].map(([a,b])=><div className="panel" key={a}><p className="text-xs uppercase tracking-wider text-slate-500">{a}</p><p className="mt-3 text-lg font-semibold text-sky-400">{b||'—'}</p></div>)}</div>
    <div className="panel"><h3 className="font-semibold">Controles del contenedor</h3><p className="mt-1 text-sm text-slate-500">Solo usuarios con permiso de energía pueden utilizar estas acciones.</p><div className="mt-5 flex flex-wrap gap-3">
      <button disabled={!!busy||info?.running} onClick={()=>action('start')} className="button-primary">▶ Iniciar</button>
      <button disabled={!!busy||!info?.running} onClick={()=>action('restart')} className="button-secondary">↻ Reiniciar</button>
      <button disabled={!!busy||!info?.running} onClick={()=>action('stop')} className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40">■ Detener</button>
    </div></div>
  </div>
}
