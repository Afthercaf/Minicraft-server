import 'dotenv/config'

export const config = {
  port: process.env.PORT || 3001,
  frontendUrl: (process.env.FRONTEND_URL || '').replace(/\/+$/, ''),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  superadminEmail: (process.env.SUPERADMIN_EMAIL || 'afthercaft10@gmail.com').toLowerCase(),
  // RCON del servidor local, expuesto via Tailscale Funnel (TLS terminado)
  rconHost: process.env.RCON_HOST || '',
  rconPort: parseInt(process.env.RCON_PORT || '8443', 10),
  rconPassword: process.env.RCON_PASSWORD || '',
  rconTls: (process.env.RCON_TLS || 'true').toLowerCase() === 'true',
}

const required = ['frontendUrl', 'supabaseUrl', 'supabaseAnonKey', 'rconHost', 'rconPassword']
const missing = required.filter((key) => !config[key])
if (missing.length > 0) {
  console.error(`Faltan variables de entorno: ${missing.join(', ')}`)
  process.exit(1)
}
