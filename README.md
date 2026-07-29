# CraftControl

Panel visual para administrar el servidor Minecraft Forge.

## Lo que muestra

- Consola y logs del contenedor actualizados cada 3 segundos.
- Explorador seguro de `server-data`, incluyendo mods, configs, logs y mundos.
- Estado de Docker, CPU, memoria, red y salud del contenedor.
- Jugadores, whitelist, operadores, bloqueos y gamerules.
- Cuentas con permisos independientes.

## Seguridad

El correo indicado en `SUPERADMIN_EMAIL` es el único superadmin. Solo esa cuenta puede:

- crear y eliminar cuentas;
- conceder o retirar permisos;
- ver la sección de cuentas.

Los permisos también se validan en el backend. Ocultar una sección en la interfaz no es la única protección.

## Configuración necesaria

Agrega al `.env` del backend:

```env
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPERADMIN_EMAIL=tu-correo@ejemplo.com
SERVER_DATA_PATH=../server-data
DOCKER_CONTAINER=mc-forge
```

`SUPABASE_SERVICE_ROLE_KEY` debe existir únicamente en el backend; nunca se coloca en el frontend.

Para ver Docker y los archivos reales, el backend debe ejecutarse en la misma PC donde corre Docker Desktop. Un backend alojado únicamente en Render no puede ver el Docker ni el disco de esta computadora.

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
