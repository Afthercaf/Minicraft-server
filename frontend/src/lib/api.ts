import { supabase } from './supabase'

const API_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, '')

interface ApiOptions {
  method?: 'GET' | 'POST'
  body?: unknown
}

// Wrapper fetch: adjunta JWT de Supabase y el header anti-CSRF
// X-Requested-With que el backend exige en toda mutacion (P0 del MD).
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : `Error ${response.status}`)
  }
  return json as T
}
