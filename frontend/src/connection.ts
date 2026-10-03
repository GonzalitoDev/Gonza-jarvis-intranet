// Configuración de conexión con el backend local de JARVIS.
// En Electron la key viene del proceso principal; en la web se guarda en localStorage.
export const LOCAL_BACKEND_URL = 'http://127.0.0.1:8765'

// Publicada en Vercel, la web usa el backend del mismo proyecto (servicio "backend" en /api).
// En Electron, en el dev server o abierta como archivo, usa el backend local de la PC.
function isHostedWeb(): boolean {
  return location.protocol === 'https:' && !window.electronAPI
}
export const DEFAULT_BACKEND_URL = isHostedWeb() ? `${location.origin}/api` : LOCAL_BACKEND_URL
const URL_KEY = 'jarvis_backend_url'
const API_KEY = 'jarvis_api_key'

function read(k: string): string {
  try { return localStorage.getItem(k) || '' } catch { return '' }
}
function write(k: string, v: string) {
  try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch {}
}

export const isElectron = () => !!window.electronAPI

export function getBackendUrl(): string {
  return (!isElectron() && read(URL_KEY)) || DEFAULT_BACKEND_URL
}

export function getApiKey(): string {
  return window.electronAPI?.apiKey || read(API_KEY)
}

export function saveConnection(url: string, key: string) {
  write(URL_KEY, url.trim().replace(/\/+$/, '') === DEFAULT_BACKEND_URL ? '' : url.trim().replace(/\/+$/, ''))
  write(API_KEY, key.trim())
}

// El botón "Abrir en la web" de la app abre la página con #key=... ; el fragmento nunca viaja al servidor
export function consumePairingHash() {
  if (isElectron() || !location.hash.includes('key=')) return
  const params = new URLSearchParams(location.hash.slice(1))
  const key = params.get('key')
  if (key) saveConnection(params.get('url') || getBackendUrl(), key)
  history.replaceState(null, '', location.pathname + location.search)
}
