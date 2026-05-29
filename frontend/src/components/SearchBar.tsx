import { useState } from 'react'

interface SearchBarProps {
  onSend: (text: string) => void
  disabled: boolean
}

export default function SearchBar({ onSend, disabled }: SearchBarProps) {
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
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Preguntale algo a JARVIS o dale un comando..."
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !input.trim()}>
        Enviar
      </button>
    </form>
  )
}
