import type { UpdateStatus as UpdateStatusType } from '../types'

interface StatusBarProps {
  connected: boolean
  loading: boolean
  pageCount: number
  updateStatus: UpdateStatusType
  onRestart: () => void
}

export default function StatusBar({ connected, loading, pageCount, updateStatus, onRestart }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
      <span>{connected ? 'Backend conectado' : 'Backend desconectado'}</span>
      <span className="status-spacer">|</span>
      <span>{pageCount} páginas indexadas</span>
      {loading && (
        <>
          <span className="status-spacer">|</span>
          <span className="status-loading">Procesando...</span>
        </>
      )}
      <div className="status-update">
        {updateStatus.status === 'checking' && <span className="update-info">Buscando actualizaciones...</span>}
        {updateStatus.status === 'available' && <span className="update-available">Actualizacion {updateStatus.info.version} disponible, descargando...</span>}
        {updateStatus.status === 'downloading' && (
          <span className="update-downloading">
            Descargando actualizacion... {Math.round(updateStatus.progress.percent)}%
          </span>
        )}
        {updateStatus.status === 'downloaded' && (
          <button className="update-btn" onClick={onRestart}>
            Reiniciar e instalar {updateStatus.info.version}
          </button>
        )}
        {updateStatus.status === 'error' && <span className="update-error">Error al buscar actualizacion</span>}
      </div>
    </footer>
  )
}
