import { useState } from 'react'
import { getApiKey, getBackendUrl, saveConnection, isElectron } from '../connection'

// Web: conectar con la app de escritorio. Electron: abrir esta misma interfaz en el navegador.
export default function WebConnect({ connected, onSaved }: { connected: boolean; onSaved: () => void }) {
  const [url, setUrl] = useState(getBackendUrl)
  const [key, setKey] = useState(getApiKey)
  const [copied, setCopied] = useState(false)

  if (isElectron()) {
    const webUrl = window.electronAPI?.webUrl
    if (!webUrl) return null
    const link = `${webUrl}/#key=${encodeURIComponent(getApiKey())}`
    const copy = async () => {
      try { await navigator.clipboard.writeText(getApiKey()); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
    }
    return (
      <div className="sidebar-section">
        <h3>Acceso web</h3>
        <p className="ai-note">Usá JARVIS desde el navegador de esta PC, conectado a esta app.</p>
        <div className="crawl-form">
          <button type="button" onClick={() => window.open(link, '_blank')}>Abrir en la web</button>
          <button type="button" onClick={copy}>{copied ? 'Copiada ✓' : 'Copiar clave'}</button>
        </div>
      </div>
    )
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    saveConnection(url, key)
    onSaved()
  }

  return (
    <div className="sidebar-section">
      <h3>Conexión con la app {connected ? '🟢' : '🔴'}</h3>
      {!connected && (
        <p className="ai-note">
          Abrí JARVIS en tu PC y tocá <b>Acceso web → Abrir en la web</b>, o pegá la clave acá.
          Funciona en Chrome o Edge de la misma PC.
        </p>
      )}
      <form onSubmit={save} className="connect-form">
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://127.0.0.1:8765" />
        <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Clave de la app" autoComplete="off" />
        <button type="submit" disabled={!url.trim() || !key.trim()}>Conectar</button>
      </form>
    </div>
  )
}
