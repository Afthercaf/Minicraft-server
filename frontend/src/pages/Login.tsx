import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError('Credenciales incorrectas')
    setLoading(false)
  }
  return <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080b10] p-4">
    <div className="absolute left-1/2 top-[-20rem] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-emerald-600/10 blur-3xl" />
    <div className="relative w-full max-w-sm">
      <div className="mb-7 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-800 bg-emerald-500/10 text-3xl shadow-lg shadow-emerald-950">⛏</div><h1 className="mt-4 text-2xl font-bold">CraftControl</h1><p className="mt-1 text-sm text-slate-500">Panel de administración del servidor</p></div>
      <form onSubmit={submit} className="panel p-7">
        <h2 className="text-lg font-semibold">Iniciar sesión</h2><p className="mt-1 text-xs text-slate-500">Entra con una cuenta autorizada por el superadmin.</p>
        <label className="field-label" htmlFor="email">Correo electrónico</label><input id="email" className="field" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nombre@correo.com"/>
        <label className="field-label" htmlFor="password">Contraseña</label><input id="password" className="field" required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••••"/>
        {error&&<p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-2.5 text-sm text-red-400">{error}</p>}
        <button disabled={loading} className="button-primary mt-5 w-full py-2.5">{loading?'Entrando…':'Entrar al panel'}</button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-700">Acceso protegido · permisos por usuario</p>
    </div>
  </div>
}
