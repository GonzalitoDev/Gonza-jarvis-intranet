import type { UpdateStatus as UpdateStatusType, CrawlProgress } from '../types'

interface StatusBarProps {
  connected: boolean
  loading: boolean
  pageCount: number
  crawlProgress: CrawlProgress | null
  updateStatus: UpdateStatusType
  onRestart: () => void
  onOpenConfig?: () => void
}

export default function StatusBar({ connected, loading, pageCount, crawlProgress, updateStatus, onRestart, onOpenConfig }: StatusBarProps) {
  const isCrawling = crawlProgress?.running ?? false

  return (
    <footer className="status-bar">
      <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
      <span>{connected ? 'Backend conectado' : 'Backend desconectado'}</span>
      <span className="status-spacer">|</span>
      <span>{pageCount} pags indexadas</span>
      {isCrawling && crawlProgress && (
        <>
          <span className="status-spacer">|</span>
          <span className="status-crawling">
            Indexando: {crawlProgress.pages_indexed}/{crawlProgress.pages_found} ({crawlProgress.current_source})
          </span>
        </>
      )}
      {loading && !isCrawling && (
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
      {onOpenConfig && (
        <button className="status-config-btn" onClick={onOpenConfig} title="Configurar servidor">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      )}
    </footer>
  )
}
