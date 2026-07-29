import { useRef, useState } from 'react'
import { api } from '../lib/api'

interface Entry {
  type: 'cmd' | 'res' | 'err'
  text: string
}

export default function ConsolePanel() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [command, setCommand] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function send() {
    const cmd = command.trim()
    if (!cmd || sending) return
    setSending(true)
    setEntries((prev) => [...prev, { type: 'cmd', text: cmd }])
    setCommand('')
    try {
      const { response } = await api<{ response: string }>('/api/console/send', {
        method: 'POST',
        body: { command: cmd },
      })
      setEntries((prev) => [...prev, { type: 'res', text: response || '(sin respuesta)' }])
    } catch (err) {
      setEntries((prev) => [
        ...prev,
        { type: 'err', text: err instanceof Error ? err.message : 'Error' },
      ])
    } finally {
      setSending(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  return (
    <div className="space-y-3">
      <div className="h-96 overflow-y-auto rounded-xl border border-zinc-800 bg-black p-4 font-mono text-sm">
        {entries.length === 0 && (
          <p className="text-zinc-600">
            Escribe un comando de Minecraft abajo (ej: list, say Hola, time set day).
          </p>
        )}
        {entries.map((entry, i) => (
          <p
            key={i}
            className={
              entry.type === 'cmd'
                ? 'text-emerald-400'
                : entry.type === 'err'
                  ? 'text-red-400'
                  : 'text-zinc-300'
            }
          >
            {entry.type === 'cmd' ? `> ${entry.text}` : entry.text}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="flex gap-2"
      >
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Comando RCON…"
          maxLength={500}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={sending || !command.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
      <p className="text-xs text-zinc-500">
        Los comandos <code>stop</code> y <code>reload</code> están bloqueados desde el panel por
        seguridad. Los logs completos están en el archivo local{' '}
        <code>server-data\logs\latest.log</code>.
      </p>
    </div>
  )
}
