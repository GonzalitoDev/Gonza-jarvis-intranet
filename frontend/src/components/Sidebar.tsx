import { useState } from 'react'
import type { Page } from '../types'

interface SidebarProps {
  pages: Page[]
  onCrawl: (url: string) => void
  loading: boolean
}

export default function Sidebar({ pages, onCrawl, loading }: SidebarProps) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim()) {
      onCrawl(url.trim())
      setUrl('')
    }
  }

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
        <h3>Páginas Indexadas ({pages.length})</h3>
        <ul className="pages-list">
          {pages.map(p => (
            <li key={p.url}>
              <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.url}>
                {p.title}
              </a>
            </li>
          ))}
          {pages.length === 0 && <li className="empty">No hay páginas indexadas</li>}
        </ul>
      </div>
    </aside>
  )
}
