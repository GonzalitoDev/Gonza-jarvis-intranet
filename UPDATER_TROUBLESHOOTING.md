# Auto-Update Troubleshooting Guide

## Problema: "Error al buscar actualización"

Este error ocurre cuando `electron-updater` no puede conectarse a GitHub o no encuentra releases disponibles.

## Causas Comunes

### 1. Sin releases publicados en GitHub
**Síntoma**: Error 404 al buscar actualizaciones
**Solución**: Asegúrate de crear releases en GitHub

```bash
# Ver releases disponibles
curl https://api.github.com/repos/GonzalitoDev/Gonza-jarvis-intranet/releases
```

### 2. Rate limiting de GitHub API
**Síntoma**: Error de límite de solicitudes
**Solución**: Configurar token de GitHub

```bash
# Windows (Cmd)
set GITHUB_TOKEN=your-github-token-here

# Windows (PowerShell)
$env:GITHUB_TOKEN="your-github-token-here"

# Linux/macOS
export GITHUB_TOKEN="your-github-token-here"

npm run dev
```

Cómo obtener un token:
1. Ve a https://github.com/settings/tokens
2. Crea un "Personal access token"
3. Selecciona el scope `public_repo`
4. Copia el token y úsalo arriba

### 3. Sin conexión a internet
**Síntoma**: Error ENOTFOUND o timeout
**Solución**: Comprueba tu conexión y reinicia la app

### 4. Repositorio privado o permisos insuficientes
**Síntoma**: Error 401/403
**Solución**: Usa un token con los permisos correctos

## Desabilitar Auto-Updates en Desarrollo

Si solo quieres desarrollar sin que moleste:

```bash
npm run dev:electron
# El auto-updater solo funciona en versiones compiladas (npm run build)
```

## Verificar Configuración

Para debugging, añade esto a `electron/main.js`:

```javascript
const isDev = !app.isPackaged
console.log('[updater] Modo desarrollo:', isDev)
console.log('[updater] GitHub Token configurado:', !!process.env.GITHUB_TOKEN)
```

## Solución Rápida: Desabilitar actualizaciones

Si no quieres usar auto-updates, comenta esta línea en `electron/main.js`:

```javascript
// setupAutoUpdater()  // Comentar para desabilitar
```

## Crear un Release para Testing

Si quieres probar las actualizaciones:

```bash
# 1. Compila la aplicación
npm run build

# 2. Ve a GitHub y crea un release manualmente
# https://github.com/GonzalitoDev/Gonza-jarvis-intranet/releases/new

# 3. Sube los archivos:
# - dist/JARVIS-Intranet-Assistant-Setup-X.X.X.exe
# - dist/JARVIS-Intranet-Assistant-Setup-X.X.X.exe.blockmap
# - dist/latest.yml

# 4. La próxima vez que corras la app, verá la actualización
```

## Logs de Auto-Update

Para ver logs detallados:

```bash
# Windows
SET ELECTRON_LOG_LEVEL=debug
npm run dev

# Linux/macOS
ELECTRON_LOG_LEVEL=debug npm run dev
```

Los logs se guardan en:
- Windows: `%APPDATA%/jarvis-intranet-assistant/logs/`
- macOS: `~/Library/Logs/jarvis-intranet-assistant/`
- Linux: `~/.config/jarvis-intranet-assistant/logs/`
