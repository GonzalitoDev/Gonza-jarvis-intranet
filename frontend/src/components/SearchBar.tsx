import { useState } from 'react'

interface SearchBarProps {
  onSend: (text: string) => void
  disabled: boolean
  onMic?: () => void
  listening?: boolean
  voiceEnabled?: boolean
  onToggleVoice?: () => void
}

export default function SearchBar({ onSend, disabled, onMic, listening, voiceEnabled, onToggleVoice }: SearchBarProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      onSend(input.trim())
      setInput('')
    }
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      {onToggleVoice && (
        <button
          type="button" className="icon-btn" onClick={onToggleVoice}
          title={voiceEnabled ? 'Silenciar la voz de JARVIS' : 'Activar la voz de JARVIS'}
          aria-pressed={voiceEnabled}
        >
          {voiceEnabled ? '🔊' : '🔇'}
        </button>
      )}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={listening ? 'Escuchando… tocá el micrófono para terminar' : 'Preguntale algo a JARVIS o dale un comando...'}
        disabled={disabled || listening}
      />
      {onMic && (
        <button
          type="button" className={`icon-btn mic-btn ${listening ? 'listening' : ''}`}
          onClick={onMic} disabled={disabled && !listening}
          title={listening ? 'Terminar de hablar' : 'Hablarle a JARVIS'}
        >
          🎙️
        </button>
      )}
      <button type="submit" disabled={disabled || listening || !input.trim()}>
        Enviar
      </button>
    </form>
  )
}
