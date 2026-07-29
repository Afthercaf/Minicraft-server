import { createClient } from 'redis'
import { config } from '../config.js'

export let redisReady = false
export let redisClient = null

if (config.redisUrl) {
  redisClient = createClient({
    url: config.redisUrl,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: false,
    },
  })
  redisClient.on('error', (error) => {
    redisReady = false
    console.error(`Redis no disponible: ${error.message}`)
  })
  redisClient.on('ready', () => { redisReady = true })
  redisClient.on('end', () => { redisReady = false })
  await redisClient.connect().catch(() => {
    redisReady = false
    redisClient = null
  })
}

export async function getCachedJson(key) {
  if (!redisReady || !redisClient) return null
  try {
    const value = await redisClient.get(key)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export async function setCachedJson(key, value, ttlSeconds) {
  if (!redisReady || !redisClient) return
  await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds }).catch(() => {})
}
