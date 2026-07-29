import net from 'node:net'
import tls from 'node:tls'
import { config } from '../config.js'

// Cliente RCON (protocolo Source RCON) con soporte TLS.
// TLS porque Tailscale Funnel expone el puerto con --tls-terminated-tcp,
// asi la contrasena RCON nunca viaja en texto plano por internet.

const TYPE_RESPONSE = 0
const TYPE_COMMAND = 2
const TYPE_AUTH = 3

function encodePacket(id, type, body) {
  const bodyBuf = Buffer.concat([Buffer.from(body, 'utf8'), Buffer.from([0, 0])])
  const header = Buffer.alloc(8)
  header.writeInt32LE(id, 0)
  header.writeInt32LE(type, 4)
  const length = Buffer.alloc(4)
  length.writeInt32LE(header.length + bodyBuf.length, 0)
  return Buffer.concat([length, header, bodyBuf])
}

export function rconCommand(command, timeoutMs = 10000) {
  const { rconHost: host, rconPort: port, rconPassword: password, rconTls } = config

  return new Promise((resolve, reject) => {
    const AUTH_ID = 1
    const CMD_ID = 2
    let buffer = Buffer.alloc(0)
    let settled = false

    const socket = rconTls
      ? tls.connect({ host, port, servername: host, rejectUnauthorized: true })
      : net.connect({ host, port })

    const finish = (err, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      if (err) reject(err)
      else resolve(value)
    }

    const timer = setTimeout(() => {
      const err = new Error('El servidor no respondio a tiempo')
      err.status = 504
      finish(err)
    }, timeoutMs)

    socket.on('error', () => {
      const err = new Error('No se pudo conectar con el servidor de Minecraft')
      err.status = 502
      finish(err)
    })

    const onConnect = () => socket.write(encodePacket(AUTH_ID, TYPE_AUTH, password))
    if (rconTls) socket.once('secureConnect', onConnect)
    else socket.once('connect', onConnect)

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 4) {
        const length = buffer.readInt32LE(0)
        if (length < 10 || length > 1024 * 1024) {
          const err = new Error('Respuesta RCON invalida')
          err.status = 502
          return finish(err)
        }
        if (buffer.length < 4 + length) break

        const id = buffer.readInt32LE(4)
        const type = buffer.readInt32LE(8)
        const body = buffer.toString('utf8', 12, 4 + length - 2)
        buffer = buffer.subarray(4 + length)

        if (id === -1) {
          const err = new Error('Error de autenticacion con el servidor')
          err.status = 502
          return finish(err)
        }
        if (id === AUTH_ID && type === TYPE_COMMAND) {
          // Autenticado: enviar el comando
          socket.write(encodePacket(CMD_ID, TYPE_COMMAND, command))
        } else if (id === CMD_ID && type === TYPE_RESPONSE) {
          return finish(null, body)
        }
      }
    })
  })
}
