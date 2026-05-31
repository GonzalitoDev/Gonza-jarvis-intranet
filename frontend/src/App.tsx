import { useState, useCallback, useEffect } from 'react'
import Chat from './components/Chat'
import Sidebar from './components/Sidebar'
import SearchBar from './components/SearchBar'
import StatusBar from './components/StatusBar'
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

const BACKEND_URL = 'http://127.0.0.1:8765'

let msgId = 0

function nextId() {
  return `msg-${++msgId}`
}

export default function App() {
  const { connected, loading, pages, crawlProgress, query, executeCommand, crawlUrl, startLegalCrawl, stopLegalCrawl, refreshPages, osintDNS, osintWhois, osintIPGeo, osintPortScan, osintSSL, osintHeaders, osintSubdomains, osintEmail, osintDiscord, osintDiscordInvite } = useBackend(BACKEND_URL)
  const [messages, setMessages] = useState<Message[]>([])
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (connected) refreshPages()
  }, [connected])

  useEffect(() => {
    window.electronAPI?.onUpdateStatus((data) => setUpdateStatus(data))
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
        osintDiscord={osintDiscord} osintDiscordInvite={osintDiscordInvite}
      />
      <main className="main">
        <Chat messages={messages} loading={loading} onMenuToggle={() => setSidebarOpen(s => !s)} />
        <SearchBar onSend={handleSend} disabled={loading} />
      </main>
      <StatusBar
        connected={connected} loading={loading} pageCount={pages.length}
        crawlProgress={crawlProgress} updateStatus={updateStatus}
        onRestart={handleRestart}
      />
    </div>
  )
}
