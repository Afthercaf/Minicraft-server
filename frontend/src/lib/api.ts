import { supabase } from './supabase'

const API_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, '')

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let refreshPromise: ReturnType<typeof supabase.auth.refreshSession> | null = null

async function validToken(forceRefresh = false) {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) return null
  const expiresSoon = (session.expires_at || 0) * 1000 < Date.now() + 60_000
  if (!forceRefresh && !expiresSoon) return session.access_token
  if (!refreshPromise) {
    refreshPromise = supabase.auth.refreshSession().finally(() => { refreshPromise = null })
  }
  const { data: refreshed, error } = await refreshPromise
  if (error || !refreshed.session) return null
  return refreshed.session.access_token
}

async function request(path: string, options: ApiOptions, token: string | null) {
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
  return { response, json }
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  let token = await validToken()
  let result = await request(path, options, token)
  if (result.response.status === 401 && token) {
    token = await validToken(true)
    if (token) result = await request(path, options, token)
  }
  if (!result.response.ok) {
    throw new ApiError(
      typeof result.json.error === 'string' ? result.json.error : `Error ${result.response.status}`,
      result.response.status,
    )
  }
  return result.json as T
}
