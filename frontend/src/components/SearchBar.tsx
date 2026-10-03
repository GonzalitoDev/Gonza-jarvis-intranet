import { useState } from 'react'

interface SearchBarProps {
  onSend: (text: string) => void
  disabled: boolean
  onMic?: () => void
  listening?: boolean
  voiceEnabled?: boolean
  onToggleVoice?: () => void
  wakeState?: 'off' | 'idle' | 'awake' | 'error'
  onToggleWake?: () => void
}

export default function SearchBar({ onSend, disabled, onMic, listening, voiceEnabled, onToggleVoice, wakeState = 'off', onToggleWake }: SearchBarProps) {
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
      {onToggleWake && (
        <button
          type="button" className={`icon-btn wake-btn wake-${wakeState}`} onClick={onToggleWake}
          title={{
            off: 'Activar "Hey Jarvis": escucha siempre y responde al oír su nombre',
            idle: 'Escuchando "Jarvis"… (tocá para desactivar)',
            awake: 'Te escucho, decí la orden',
            error: 'No pude usar el micrófono',
          }[wakeState]}
          aria-pressed={wakeState !== 'off'}
        >
          {wakeState === 'off' ? '💤' : wakeState === 'error' ? '⚠️' : '👂'}
        </button>
      )}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={listening ? 'Escuchando… tocá el micrófono para terminar' : wakeState === 'awake' ? 'Te escucho…' : wakeState === 'idle' ? 'Decí "Jarvis" o escribí…' : 'Preguntale algo a JARVIS o dale un comando...'}
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
