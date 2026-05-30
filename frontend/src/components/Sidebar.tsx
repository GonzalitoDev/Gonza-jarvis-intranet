import { useState } from 'react'
import type { Page, CrawlProgress } from '../types'
import OsintPanel from './OsintPanel'

interface SidebarProps {
  pages: Page[]
  onCrawl: (url: string) => void
  loading: boolean
  crawlProgress: CrawlProgress | null
  onStartLegalCrawl: () => void
  onStopLegalCrawl: () => void
  osintDNS: (domain: string, type?: string) => Promise<any>
  osintWhois: (domain: string) => Promise<any>
  osintIPGeo: (ip: string) => Promise<any>
  osintPortScan: (target: string, ports?: number[]) => Promise<any>
  osintSSL: (hostname: string, port?: number) => Promise<any>
  osintHeaders: (url: string) => Promise<any>
  osintSubdomains: (domain: string) => Promise<any>
  osintEmail: (email: string) => Promise<any>
}

const LEGAL_SOURCES = [
  { name: 'Infoleg', url: 'https://www.infoleg.gob.ar' },
  { name: 'Boletin Oficial', url: 'https://www.boletinoficial.gob.ar' },
  { name: 'SAIJ', url: 'https://www.saij.gob.ar' },
  { name: 'Normativa Argentina', url: 'https://www.argentina.gob.ar/normativa' },
  { name: 'CSJN', url: 'https://www.csjn.gov.ar' },
  { name: 'Legislacion Diputados', url: 'https://www.diputados.gob.ar/legislacion' },
  { name: 'Legislacion Senado', url: 'https://www.senado.gob.ar/legislacion' },
]

export default function Sidebar({ pages, onCrawl, loading, crawlProgress, onStartLegalCrawl, onStopLegalCrawl, osintDNS, osintWhois, osintIPGeo, osintPortScan, osintSSL, osintHeaders, osintSubdomains, osintEmail }: SidebarProps) {
  const [url, setUrl] = useState('')
  const [showSources, setShowSources] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim()) {
      onCrawl(url.trim())
      setUrl('')
    }
  }

  const progress = crawlProgress
  const isRunning = progress?.running ?? false

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3>Agregar URL</h3>
        <form onSubmit={handleSubmit} className="crawl-form">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://intranet/..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !url.trim()}>
            Indexar
          </button>
        </form>
      </div>

      <div className="sidebar-section">
        <h3 style={{ cursor: 'pointer' }} onClick={() => setShowSources(!showSources)}>
          Fuentes Legales {showSources ? '▾' : '▸'}
        </h3>
        {showSources && (
          <>
            <ul className="pages-list sources-list">
              {LEGAL_SOURCES.map(s => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.url}>
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
            <div className="crawl-actions">
              {!isRunning ? (
                <button className="btn-crawl-start" onClick={onStartLegalCrawl}>
                  Indexar fuentes legales
                </button>
              ) : (
                <>
                  <button className="btn-crawl-stop" onClick={onStopLegalCrawl}>
                    Detener
                  </button>
                  <div className="crawl-progress">
                    <div className="crawl-progress-bar">
                      <div
                        className="crawl-progress-fill"
                        style={{
                          width: progress?.total_sources
                            ? `${(progress.sources_completed / progress.total_sources) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                    <div className="crawl-progress-text">
                      {progress?.status_text}
                      <br />
                      Paginas: {progress?.pages_indexed ?? 0} indexadas / {progress?.pages_found ?? 0} encontradas
                      {progress?.errors ? ` / ${progress.errors} errores` : ''}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <OsintPanel
        osintDNS={osintDNS}
        osintWhois={osintWhois}
        osintIPGeo={osintIPGeo}
        osintPortScan={osintPortScan}
        osintSSL={osintSSL}
        osintHeaders={osintHeaders}
        osintSubdomains={osintSubdomains}
        osintEmail={osintEmail}
      />

      <div className="sidebar-section">
        <h3>Paginas Indexadas ({pages.length})</h3>
        <ul className="pages-list">
          {pages.map(p => (
            <li key={p.url}>
              <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.url}>
                {p.title}
              </a>
            </li>
          ))}
          {pages.length === 0 && <li className="empty">No hay paginas indexadas</li>}
        </ul>
      </div>
    </aside>
  )
}
