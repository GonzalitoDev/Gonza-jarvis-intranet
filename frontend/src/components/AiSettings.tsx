import { useEffect, useState } from 'react'

export interface AiApi {
  status: () => Promise<{ configured?: boolean; model?: string; error?: string }>
  setKey: (key: string) => Promise<{ configured?: boolean; message?: string; detail?: string; error?: string }>
  clearKey: () => Promise<{ configured?: boolean; message?: string }>
}

export default function AiSettings({ api, connected }: { api: AiApi; connected: boolean }) {
  const [configured, setConfigured] = useState(false)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (connected) api.status().then(d => setConfigured(!!d.configured))
  }, [connected])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg('Probando la key…')
    const d = await api.setKey(key.trim())
    setBusy(false)
    if (d.configured) { setConfigured(true); setKey(''); setMsg(d.message || 'Listo') }
    else setMsg(d.detail || d.error || 'No se pudo guardar la key')
  }

  const clear = async () => {
    const d = await api.clearKey()
    setConfigured(!!d.configured); setMsg(d.message || '')
  }

  return (
    <div className="sidebar-section">
      <h3>Inteligencia artificial {configured ? '🟢' : '⚪'}</h3>
      {configured ? (
        <>
          <p className="ai-note">JARVIS responde con IA gratis de OpenRouter.</p>
          <button type="button" onClick={clear}>Quitar API key</button>
        </>
      ) : (
        <>
          <p className="ai-note">
            Creá una key gratis en{' '}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">openrouter.ai/keys</a>{' '}
            y pegala acá. Se guarda cifrada en esta PC.
          </p>
          <form onSubmit={save} className="crawl-form">
            <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-or-..." disabled={busy} autoComplete="off" />
            <button type="submit" disabled={busy || !key.trim()}>Guardar</button>
          </form>
        </>
      )}
      {msg && <p className="ai-note">{msg}</p>}
      <p className="ai-note ai-warn">Con IA activa, tus preguntas y fragmentos de las páginas indexadas se envían a OpenRouter.</p>
    </div>
  )
}
