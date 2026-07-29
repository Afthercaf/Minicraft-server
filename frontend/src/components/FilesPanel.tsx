import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

interface FileEntry { name: string; path: string; type: 'folder' | 'file'; size: number; modified: string }
const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`

export default function FilesPanel() {
  const [path, setPath] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async (next = path) => {
    try { const data = await api<{ path: string; entries: FileEntry[] }>(`/api/files?path=${encodeURIComponent(next)}`); setPath(data.path); setEntries(data.entries); setPreview(null); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir') }
  }, [path])
  useEffect(() => { load('') }, [])
  async function open(entry: FileEntry) {
    if (entry.type === 'folder') return load(entry.path)
    try { setPreview(await api(`/api/files/read?path=${encodeURIComponent(entry.path)}`)) } catch (e) { setError(e instanceof Error ? e.message : 'Sin vista previa') }
  }
  const crumbs = path ? path.split('/') : []
  return <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
    <section className="panel min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Explorador del servidor</h3><p className="text-xs text-slate-500">Mods, configuraciones, logs y mundos</p></div>
        <button onClick={() => load(path)} className="button-secondary">Actualizar</button></div>
      <div className="mt-5 flex items-center gap-1 overflow-x-auto rounded-lg bg-black/30 p-2 text-sm">
        <button onClick={() => load('')} className="text-emerald-400">server-data</button>
        {crumbs.map((crumb, i) => <span key={i} className="flex items-center gap-1"><span className="text-slate-600">/</span><button onClick={() => load(crumbs.slice(0, i + 1).join('/'))} className="text-slate-300 hover:text-white">{crumb}</button></span>)}
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
        {path && <button onClick={() => load(path.split('/').slice(0,-1).join('/'))} className="file-row w-full"><span>↰</span><span className="flex-1 text-left">Subir un nivel</span></button>}
        {entries.map((entry) => <button key={entry.path} onClick={() => open(entry)} className="file-row w-full">
          <span className="text-lg">{entry.type === 'folder' ? (entry.name === 'mods' ? '🧩' : '📁') : entry.name.endsWith('.jar') ? '🧩' : '📄'}</span>
          <span className="min-w-0 flex-1 truncate text-left"><span className="block text-sm text-slate-200">{entry.name}</span><span className="text-xs text-slate-600">{entry.type === 'folder' ? 'Carpeta' : formatSize(entry.size)}</span></span>
          <span className="hidden text-xs text-slate-600 sm:block">{new Date(entry.modified).toLocaleString()}</span><span className="text-slate-600">›</span>
        </button>)}
      </div>
      <p className="mt-4 text-xs text-slate-500">Vista segura de solo lectura. Los archivos sensibles ocultos no aparecen.</p>
    </section>
    <aside className="panel min-h-80"><h3 className="font-semibold">Vista previa</h3>
      {preview ? <><p className="mt-1 truncate text-xs text-emerald-500">{preview.path}</p><pre className="mt-4 max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-xl bg-black p-4 text-xs text-slate-300">{preview.content}</pre></> :
      <div className="grid h-64 place-items-center text-center text-sm text-slate-600"><p>Selecciona un archivo de texto<br/>para ver su contenido.</p></div>}
    </aside>
  </div>
}
