param(
    [string]$ProjectRoot = 'D:\Server de Minecraft',
    [switch]$Install
)

$ErrorActionPreference = 'Continue'
$BackendRoot = Join-Path $ProjectRoot 'backend'
$RuntimeRoot = Join-Path $ProjectRoot 'runtime-logs'
$LogFile = Join-Path $RuntimeRoot 'autostart.log'
$ComposeFile = Join-Path $ProjectRoot 'docker-compose.yml'

New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null

function Write-RuntimeLog {
    param([string]$Message)
    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -LiteralPath $LogFile -Value $line
}

function Test-ListeningPort {
    param([int]$Port)
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

if ($Install) {
    # Esto se ejecuta solamente en la laptop que será el servidor.
    powercfg /change standby-timeout-ac 0
    powercfg /change standby-timeout-dc 0
    powercfg /change hibernate-timeout-ac 0
    powercfg /change hibernate-timeout-dc 0

    $taskUser = "$env:USERDOMAIN\$env:USERNAME"
    $taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" -ProjectRoot `"$ProjectRoot`""
    $taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $taskUser
    $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
    Register-ScheduledTask -TaskName 'CraftControl-Autostart' -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Description 'Inicia Docker, Minecraft, Redis, backend y Tailscale.' -Force | Out-Null
    Write-Host 'Instalado. CraftControl iniciará al entrar a Windows y la laptop no se suspenderá.'
}

Write-RuntimeLog 'Iniciando servicios de CraftControl.'

# Docker Desktop debe estar abierto para levantar Minecraft y Redis.
if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
    $dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (Test-Path -LiteralPath $dockerDesktop) {
        Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
        Write-RuntimeLog 'Docker Desktop iniciado.'
    }
}

$dockerReady = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) {
        $dockerReady = $true
        break
    }
    Start-Sleep -Seconds 2
}

if ($dockerReady) {
    docker compose -f $ComposeFile --project-directory $ProjectRoot up -d *> $null
    Write-RuntimeLog 'Minecraft y Redis activos.'
} else {
    Write-RuntimeLog 'Docker no estuvo listo después de 120 segundos.'
}

# Backend local del disco D.
if (-not (Test-ListeningPort -Port 3001)) {
    Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev') -WorkingDirectory $BackendRoot -WindowStyle Hidden
    Write-RuntimeLog 'Backend iniciado en el puerto 3001.'
}

# Restaura las rutas persistentes de Tailscale.
tailscale funnel --bg --yes --set-path=/redis http://127.0.0.1:3001 *> $null
tailscale serve --bg --yes --tcp=25565 tcp://127.0.0.1:25565 *> $null
Write-RuntimeLog 'Tailscale Funnel y acceso privado de Minecraft activos.'

Write-RuntimeLog 'Inicio automático completado.'
