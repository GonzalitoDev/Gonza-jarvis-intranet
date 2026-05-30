import React from 'react'
import type { Message, SearchResult } from '../types'

interface ChatProps {
  messages: Message[]
  loading: boolean
  onMenuToggle?: () => void
}

function formatMessage(text: string): string {
  return text.replace(/\n/g, '<br>')
}

export default function Chat({ messages, loading, onMenuToggle }: ChatProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="chat-container">
      {onMenuToggle && <button className="chat-menu-btn" onClick={onMenuToggle}>☰</button>}
      {messages.length === 0 && (
        <div className="chat-empty">
          <h2>JARVIS Intranet Assistant</h2>
          <p>Agregá URLs de intranet para indexar, o escribí un comando.</p>
        </div>
      )}
      {messages.map(msg => (
        <div key={msg.id} className={`message message-${msg.role}`}>
          <div className="message-avatar">{msg.role === 'user' ? 'U' : 'J'}</div>
          <div className="message-content">
            <div className="message-text" dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
            {msg.results && msg.results.length > 0 && (
              <div className="message-results">
                {msg.results.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="result-link">
                    {r.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {loading && (
        <div className="message message-assistant">
          <div className="message-avatar">J</div>
          <div className="message-content">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
