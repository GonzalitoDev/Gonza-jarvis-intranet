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

let msgId = 0

function nextId() {
  return `msg-${++msgId}`
}

export default function App() {
  const { connected, loading, pages, query, executeCommand, crawlUrl, refreshPages } = useBackend()
  const [messages, setMessages] = useState<Message[]>([])
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })

  useEffect(() => {
    refreshPages()
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
      <Sidebar pages={pages} onCrawl={handleCrawl} loading={loading} />
      <main className="main">
        <Chat messages={messages} loading={loading} />
        <SearchBar onSend={handleSend} disabled={loading} />
      </main>
      <StatusBar connected={connected} loading={loading} pageCount={pages.length} updateStatus={updateStatus} onRestart={handleRestart} />
    </div>
  )
}
