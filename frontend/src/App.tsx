import { useState, useCallback, useEffect } from 'react'
import Chat from './components/Chat'
import Sidebar from './components/Sidebar'
import SearchBar from './components/SearchBar'
import StatusBar from './components/StatusBar'
import ServerConfig from './components/ServerConfig'
import { useBackend } from './hooks/useBackend'
import type { Message, UpdateStatus } from './types'
import './App.css'

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      onUpdateStatus: (callback: (data: UpdateStatus) => void) => void
      restartAndUpdate: () => void
    }
  }
}

const STORAGE_KEY = 'jarvis_backend_url'

function getSavedUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

let msgId = 0

function nextId() {
  return `msg-${++msgId}`
}

export default function App() {
  const [backendUrl, setBackendUrl] = useState(getSavedUrl)
  const { connected, loading, pages, crawlProgress, query, executeCommand, crawlUrl, startLegalCrawl, stopLegalCrawl, refreshPages, osintDNS, osintWhois, osintIPGeo, osintPortScan, osintSSL, osintHeaders, osintSubdomains, osintEmail } = useBackend(backendUrl)
  const [messages, setMessages] = useState<Message[]>([])
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(!backendUrl)

  useEffect(() => {
    if (connected) refreshPages()
  }, [connected])

  useEffect(() => {
    window.electronAPI?.onUpdateStatus((data) => setUpdateStatus(data))
  }, [])

  const handleSaveUrl = useCallback((url: string) => {
    setBackendUrl(url)
    try { localStorage.setItem(STORAGE_KEY, url) } catch {}
  }, [])

  const handleSend = useCallback(async (text: string) => {
    const userMsg: Message = { id: nextId(), role: 'user', text }
    setMessages(prev => [...prev, userMsg])

    let response: { type: string; message: string; results?: any }

    const commandKeywords = [
      'abrí', 'abri', 'abrir',
      'ram', 'memoria', 'cpu', 'disco', 'rendimiento', 'rendimientp',
      'hora', 'fecha', 'día', 'dia',
      'tomá nota', 'toma nota', 'guardá', 'guarda',
      'listá', 'lista', 'listar',
      'notas',
    ]

    const isCommand = commandKeywords.some(kw => text.toLowerCase().includes(kw))

    if (isCommand) {
      response = await executeCommand(text)
    } else {
      response = await query(text)
    }

    const assistantMsg: Message = {
      id: nextId(),
      role: 'assistant',
      text: response.message,
      results: response.results || undefined,
    }
    setMessages(prev => [...prev, assistantMsg])
  }, [query, executeCommand])

  const handleCrawl = useCallback(async (url: string) => {
    const result = await crawlUrl(url)
    const msg: Message = {
      id: nextId(),
      role: 'assistant',
      text: result.message || `Indexada: ${url}`,
    }
    setMessages(prev => [...prev, msg])
  }, [crawlUrl])

  const handleRestart = useCallback(() => {
    window.electronAPI?.restartAndUpdate()
  }, [])

  if (!backendUrl) {
    return (
      <div className="app">
        <div className="setup-screen">
          <div className="setup-card">
            <div className="setup-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <h1 className="setup-title">JARVIS Intranet</h1>
            <p className="setup-desc">Ingrese la dirección del servidor backend para comenzar.</p>
            <div className="setup-input-row">
              <input
                type="text"
                className="setup-input"
                value={backendUrl}
                onChange={e => setBackendUrl(e.target.value)}
                placeholder="http://192.168.1.100:8765"
                onKeyDown={e => { if (e.key === 'Enter' && backendUrl) handleSaveUrl(backendUrl) }}
                autoFocus
              />
              <button className="setup-btn" disabled={!backendUrl} onClick={() => handleSaveUrl(backendUrl)}>
                Conectar
              </button>
            </div>
            <p className="setup-hint">
              El backend debe estar corriendo en <code>python backend/main.py</code>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(s => !s)}
        pages={pages} onCrawl={handleCrawl} loading={loading}
        crawlProgress={crawlProgress} onStartLegalCrawl={startLegalCrawl} onStopLegalCrawl={stopLegalCrawl}
        osintDNS={osintDNS} osintWhois={osintWhois} osintIPGeo={osintIPGeo}
        osintPortScan={osintPortScan} osintSSL={osintSSL} osintHeaders={osintHeaders}
        osintSubdomains={osintSubdomains} osintEmail={osintEmail}
      />
      <main className="main">
        <Chat messages={messages} loading={loading} onMenuToggle={() => setSidebarOpen(s => !s)} />
        <SearchBar onSend={handleSend} disabled={loading} />
      </main>
      <StatusBar
        connected={connected} loading={loading} pageCount={pages.length}
        crawlProgress={crawlProgress} updateStatus={updateStatus}
        onRestart={handleRestart} onOpenConfig={() => setConfigOpen(true)}
      />
      {configOpen && (
        <ServerConfig
          backendUrl={backendUrl}
          connected={connected}
          onSave={handleSaveUrl}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  )
}
