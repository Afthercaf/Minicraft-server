import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

interface Entry { type: 'cmd' | 'res' | 'err'; text: string }
const COMMON_COMMANDS = [
  '/advancement', '/attribute', '/ban', '/ban-ip', '/banlist', '/bossbar', '/clear',
  '/clone', '/data', '/datapack', '/difficulty', '/effect', '/enchant', '/execute',
  '/experience', '/fill', '/forceload', '/function', '/gamemode', '/gamerule', '/give',
  '/help', '/kick', '/kill', '/list', '/locate', '/loot', '/op', '/pardon', '/particle',
  '/playsound', '/recipe', '/reload', '/save-all', '/save-off', '/save-on', '/say',
  '/schedule', '/scoreboard', '/seed', '/setblock', '/setworldspawn', '/spawnpoint',
  '/spreadplayers', '/stop', '/summon', '/tag', '/team', '/teleport', '/tellraw',
  '/time', '/title', '/weather', '/whitelist', '/worldborder', '/xp',
]

export default function ConsolePanel() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [command, setCommand] = useState('')
  const [sending, setSending] = useState(false)
  const [live, setLive] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [helpSearch, setHelpSearch] = useState('')
  const [helpCommands, setHelpCommands] = useState<string[]>(COMMON_COMMANDS)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!live) return
    let cancelled = false
    async function load() {
      try {
        const data = await api<{ lines: string[] }>('/api/system/logs?lines=300')
        if (!cancelled) setLogs(data.lines)
      } catch { /* RCON todavía puede funcionar si Docker no está visible. */ }
    }
    load()
    const id = setInterval(load, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [live])

  async function send() {
    const cmd = command.trim()
    if (!cmd || sending) return
    setSending(true); setEntries((prev) => [...prev, { type: 'cmd', text: cmd }]); setCommand('')
    try {
      const { response } = await api<{ response: string }>('/api/console/send', { method: 'POST', body: { command: cmd } })
      setEntries((prev) => [...prev, { type: 'res', text: response || '(sin respuesta)' }])
    } catch (err) {
      setEntries((prev) => [...prev, { type: 'err', text: err instanceof Error ? err.message : 'Error' }])
    } finally {
      setSending(false); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  async function openHelp() {
    setShowHelp((value) => !value)
    if (!showHelp) {
      api<{ commands: string[] }>('/api/console/help')
        .then((data) => { if (data.commands.length) setHelpCommands(data.commands) })
        .catch(() => setHelpCommands(COMMON_COMMANDS))
    }
  }
  const filteredHelp = helpCommands.filter((item) => item.toLowerCase().includes(helpSearch.toLowerCase()))

  return <div className="space-y-3">
    <div className="flex items-center justify-between"><div><h3 className="font-semibold">Consola en vivo</h3><p className="text-xs text-slate-500">Logs reales del contenedor y comandos RCON</p></div><button onClick={() => setLive(!live)} className={`rounded-full px-3 py-1 text-xs ${live ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>{live ? '● En vivo' : 'Pausada'}</button></div>
    <div className="h-[55vh] overflow-y-auto rounded-xl border border-slate-800 bg-[#030507] p-4 font-mono text-xs leading-5 shadow-inner">
      {logs.length === 0 && entries.length === 0 && <p className="text-slate-600">Esperando logs del servidor…</p>}
      {logs.map((line, i) => <p key={`log-${i}`} className={line.includes('ERROR') ? 'text-red-400' : line.includes('WARN') ? 'text-amber-400' : 'text-slate-400'}>{line}</p>)}
      {entries.length > 0 && <p className="my-2 border-t border-slate-800" />}
      {entries.map((entry, i) => <p key={i} className={entry.type === 'cmd' ? 'text-emerald-400' : entry.type === 'err' ? 'text-red-400' : 'text-sky-300'}>{entry.type === 'cmd' ? `> ${entry.text}` : entry.text}</p>)}
      <div ref={bottomRef} />
    </div>
    <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex gap-2">
      <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Comando: say Hola, list, time set day…" maxLength={500} className="field mt-0 flex-1 font-mono" />
      <button type="submit" disabled={sending || !command.trim()} className="button-primary">Enviar</button>
      <button type="button" onClick={openHelp} className="button-secondary">Ayuda</button>
    </form>
    {showHelp && <section className="panel">
      <div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold">Comandos disponibles</h4><p className="text-xs text-slate-500">Haz clic para colocar un comando en la consola.</p></div><input value={helpSearch} onChange={(e) => setHelpSearch(e.target.value)} placeholder="Buscar comando…" className="field mt-0 max-w-xs"/></div>
      <div className="mt-4 flex max-h-56 flex-wrap gap-2 overflow-y-auto">{filteredHelp.map((item) => <button key={item} onClick={() => { setCommand(item.replace(/^\//, '') + ' '); setShowHelp(false) }} className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-sky-300 hover:border-sky-700">{item}</button>)}</div>
    </section>}
    <p className="text-xs text-slate-500">Los comandos peligrosos están bloqueados. Los logs se actualizan automáticamente cada 3 segundos.</p>
  </div>
}
