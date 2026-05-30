import { useState } from 'react'

interface ServerConfigProps {
  backendUrl: string
  connected: boolean
  onSave: (url: string) => void
  onClose: () => void
}

export default function ServerConfig({ backendUrl, connected, onSave, onClose }: ServerConfigProps) {
  const [url, setUrl] = useState(backendUrl)
  const [testing, setTesting] = useState(false)

  const handleSave = () => {
    const clean = url.replace(/\/+$/, '')
    onSave(clean)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configurar Servidor</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">
            Ingrese la dirección IP de la PC donde corre el backend.
          </p>
          <div className="modal-input-row">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="http://192.168.1.100:8765"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div className="modal-status">
            {connected
              ? <span className="modal-connected">● Conectado</span>
              : <span className="modal-disconnected">● Desconectado</span>
            }
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="modal-btn-primary" onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
