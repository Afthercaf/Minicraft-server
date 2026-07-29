# CraftControl

Panel visual para administrar el servidor Minecraft Forge.

## Lo que muestra

- Consola y logs del contenedor actualizados cada 3 segundos.
- Explorador seguro de `server-data`, incluyendo mods, configs, logs y mundos.
- Subida protegida de mods `.jar` de hasta 256 MB con permiso independiente.
- Estado de Docker, CPU, memoria, red y salud del contenedor.
- Jugadores, whitelist, operadores, bloqueos y gamerules.
- Cuentas con permisos independientes.
- Identidad editable: nombre, icono, color, dirección e IP del servidor.
- Máximo de jugadores editable por el superadmin.
- Ayuda dinámica de comandos de Minecraft dentro de la consola.
- Inventarios, posición y última coordenada de muerte por jugador.
- Historial de muertes con la instantánea anterior del inventario.
- Respaldo ZIP del mundo cada 2 horas y antes de detener o reiniciar desde el panel.

## Seguridad

El correo indicado en `SUPERADMIN_EMAIL` es el único superadmin. Solo esa cuenta puede:

- crear y eliminar cuentas;
- conceder o retirar permisos;
- ver la sección de cuentas.

Los permisos también se validan en el backend. Ocultar una sección en la interfaz no es la única protección.

La identidad visual se guarda en `server-data/panel-settings.json`. Cambiar el
máximo de jugadores también actualiza `server-data/server.properties`; ese
cambio requiere reiniciar Minecraft para aplicarse.

Los datos de jugadores se leen desde los NBT en `world/playerdata`. El monitor
toma una instantánea cada 30 segundos y conserva hasta 200 muertes. Por ello, el
“inventario antes de morir” es la última instantánea disponible y puede tener
hasta 30 segundos de diferencia.

Los respaldos se guardan en `server-data/backups`. Se conservan las 24 copias
más recientes para limitar el uso del disco.

## Configuración necesaria

Agrega al `.env` del backend:

```env
FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173,https://minicraft-server-z7uz.onrender.com
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPERADMIN_EMAIL=tu-correo@ejemplo.com
SERVER_DATA_PATH=../server-data
DOCKER_CONTAINER=mc-forge
```

`SUPABASE_SERVICE_ROLE_KEY` debe existir únicamente en el backend; nunca se coloca en el frontend.

Para ver Docker y los archivos reales, el backend debe ejecutarse en la misma PC donde corre Docker Desktop. Un backend alojado únicamente en Render no puede ver el Docker ni el disco de esta computadora.

## Conexión directa desde Render por Tailscale

El frontend publicado usa:

```text
https://killerexpert10.tail29c8ce.ts.net/redis
```

La ruta `/redis` es únicamente un nombre para el proxy HTTPS; no publica un
servidor Redis. Tailscale Funnel dirige esa ruta al backend local en
`127.0.0.1:3001`. Las rutas administrativas siguen protegidas por:

- HTTPS de Tailscale;
- JWT de Supabase;
- permisos por cuenta;
- superadmin;
- CORS limitado al frontend;
- protección CSRF y límites de solicitudes.

Para comprobar o restaurar el túnel:

```powershell
tailscale funnel --bg --yes --set-path=/redis http://127.0.0.1:3001
tailscale funnel status
```

Los chunks del mundo no se guardan en Redis. Minecraft los conserva en
`server-data/world`; Redis es almacenamiento volátil y no sustituye los archivos
de región del mundo.

## Redis para consola y seguridad

El contenedor `mc-redis` se utiliza exclusivamente para:

- cachear los logs de consola durante 2 segundos;
- cachear las métricas de Docker durante 3 segundos;
- compartir los contadores de rate limiting de lecturas y acciones.
- cachear los listados de archivos durante 5 segundos.

Redis escucha solamente en `127.0.0.1:6379`, requiere contraseña, tiene un
límite de 128 MB y elimina automáticamente las entradas menos usadas mediante
LRU. No guarda sesiones, contraseñas, archivos del mundo ni permisos.

Comprobación:

```powershell
docker compose ps redis
```

## Ejecutar

En una terminal:

```powershell
cd backend
npm install
npm run dev
```

En otra:

```powershell
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`.
