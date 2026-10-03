import { useState, useCallback, useRef, useEffect } from 'react'

const STORAGE_KEY = 'jarvis_voice_enabled'
const SAMPLE_RATE = 16000
const MAX_SECONDS = 15

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

// Texto apto para leer en voz alta: sin URLs ni símbolos
function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/Fuente:\s*/g, '')
    .replace(/[*_#`<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600)
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() || []
  const es = voices.filter(v => v.lang.toLowerCase().startsWith('es'))
  // Preferir voces masculinas conocidas para un tono "JARVIS"
  return es.find(v => /pablo|jorge|diego|raul|alvaro|enrique|male|hombre/i.test(v.name)) || es[0]
}

// Codifica PCM mono de 16 bits como WAV, el formato que acepta el backend
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const write = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE')
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  write(36, 'data'); view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

export function useVoice(transcribe: (audioB64: string) => Promise<{ text?: string; error?: string }>) {
  const [enabled, setEnabled] = useState(loadEnabled)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Las voces se cargan en diferido en Chromium
    window.speechSynthesis?.getVoices()
  }, [])

  const toggleEnabled = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      if (!next) window.speechSynthesis?.cancel()
      return next
    })
  }, [])

  const speak = useCallback((text: string) => {
    if (!enabled || !window.speechSynthesis) return
    const clean = speakable(text)
    if (!clean) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(clean)
    const voice = pickVoice()
    if (voice) u.voice = voice
    u.lang = voice?.lang || 'es-ES'
    u.rate = 1.05
    u.pitch = 0.9
    u.onstart = () => setSpeaking(true)
    u.onend = u.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
  }, [enabled])

  // Graba hasta que se vuelva a llamar (o MAX_SECONDS) y devuelve el texto reconocido
  const listen = useCallback(async (): Promise<{ text?: string; error?: string }> => {
    if (stopRef.current) { stopRef.current(); return {} }
    if (!navigator.mediaDevices?.getUserMedia) return { error: 'Este dispositivo no permite usar el micrófono.' }

    window.speechSynthesis?.cancel()
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return { error: 'No tengo permiso para usar el micrófono.' }
    }

    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    const chunks: Float32Array[] = []
    processor.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    source.connect(processor)
    processor.connect(ctx.destination)
    setListening(true)

    await new Promise<void>(resolve => {
      const timer = setTimeout(() => stopRef.current?.(), MAX_SECONDS * 1000)
      stopRef.current = () => { clearTimeout(timer); resolve() }
    })
    stopRef.current = null
    setListening(false)
    processor.disconnect(); source.disconnect()
    stream.getTracks().forEach(t => t.stop())
    const rate = ctx.sampleRate
    await ctx.close()

    const total = chunks.reduce((n, c) => n + c.length, 0)
    if (total < rate * 0.3) return { error: 'Grabación demasiado corta.' }
    const samples = new Float32Array(total)
    let offset = 0
    for (const c of chunks) { samples.set(c, offset); offset += c.length }
    return transcribe(await blobToBase64(encodeWav(samples, rate)))
  }, [transcribe])

  return { enabled, toggleEnabled, speak, listen, listening, speaking }
}
