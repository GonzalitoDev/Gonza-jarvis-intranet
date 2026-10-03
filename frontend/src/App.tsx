import { useState, useCallback, useEffect, useRef } from 'react'
import Chat from './components/Chat'
import Sidebar from './components/Sidebar'
import SearchBar from './components/SearchBar'
import StatusBar from './components/StatusBar'
import { useBackend } from './hooks/useBackend'
import { useVoice } from './hooks/useVoice'
import { useWakeWord } from './hooks/useWakeWord'
import type { Message, UpdateStatus } from './types'
import './App.css'
import { consumePairingHash, getBackendUrl } from './connection'

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      apiKey?: string
      webUrl?: string
      onUpdateStatus: (callback: (data: UpdateStatus) => void) => void
      restartAndUpdate: () => void
    }
  }
}

consumePairingHash()

let msgId = 0

function nextId() {
  return `msg-${++msgId}`
}

export default function App() {
  // Cambia al guardar otra conexión; el sufijo fuerza a useBackend a reconectar con la key nueva
  const [conn, setConn] = useState(() => ({ url: getBackendUrl(), v: 0 }))
  const { connected, loading, pages, crawlProgress, query, executeCommand, crawlUrl, scrapeUrl, startLegalCrawl, stopLegalCrawl, refreshPages, osintDNS, osintWhois, osintIPGeo, osintPortScan, osintSSL, osintHeaders, osintSubdomains, osintEmail, osintDiscord, osintDiscordInvite, transcribe, getGreeting, ai } = useBackend(conn.url, conn.v)
  const voice = useVoice(transcribe)
  const greeted = useRef(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (connected) refreshPages()
  }, [connected])

  // Saludo de JARVIS la primera vez que se conecta al backend
  useEffect(() => {
    if (!connected || greeted.current) return
    greeted.current = true
    getGreeting().then(text => {
      if (!text) return
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', text }])
      voice.speak(text)
    })
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
      // Palabras como "lista" o "día" aparecen en preguntas normales: si no era un comando, preguntar
      // En la nube /command no está disponible (403): también se envía como pregunta
      if (response.type === 'unknown' || (response as any).detail) response = await query(text)
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
    voice.speak(response.message)
  }, [query, executeCommand, voice.speak])

  const wake = useWakeWord({
    transcribe,
    paused: voice.speaking || voice.listening || loading,
    onWake: () => voice.speak('¿Sí, señor?'),
    onCommand: text => handleSend(text),
  })

  const handleMic = useCallback(async () => {
    const { text, error } = await voice.listen()
    if (text) handleSend(text)
    else if (error) {
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', text: error }])
      voice.speak(error)
    }
  }, [voice.listen, voice.speak, handleSend])

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
        pages={pages} onCrawl={handleCrawl} onScrape={scrapeUrl} loading={loading}
        crawlProgress={crawlProgress} onStartLegalCrawl={startLegalCrawl} onStopLegalCrawl={stopLegalCrawl}
        osintDNS={osintDNS} osintWhois={osintWhois} osintIPGeo={osintIPGeo}
        osintPortScan={osintPortScan} osintSSL={osintSSL} osintHeaders={osintHeaders}
        osintSubdomains={osintSubdomains} osintEmail={osintEmail}
        osintDiscord={osintDiscord} osintDiscordInvite={osintDiscordInvite}
        ai={ai} connected={connected}
        onConnectionSaved={() => setConn(c => ({ url: getBackendUrl(), v: c.v + 1 }))}
      />
      <main className="main">
        <Chat messages={messages} loading={loading} onMenuToggle={() => setSidebarOpen(s => !s)} />
        <SearchBar
          onSend={handleSend} disabled={loading}
          onMic={handleMic} listening={voice.listening}
          voiceEnabled={voice.enabled} onToggleVoice={voice.toggleEnabled}
          wakeState={wake.state} onToggleWake={wake.toggle}
        />
      </main>
      <StatusBar
        connected={connected} loading={loading} pageCount={pages.length}
        crawlProgress={crawlProgress} updateStatus={updateStatus}
        onRestart={handleRestart}
      />
    </div>
  )
}
