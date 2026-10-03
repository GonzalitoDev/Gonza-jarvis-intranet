import { useState, useCallback, useRef, useEffect } from 'react'
import { encodeWav, blobToBase64 } from './useVoice'

const STORAGE_KEY = 'jarvis_wake_enabled'
const WAKE_RE = /\b(jarvis|yarvis|charvis|jarvi|yarvi|jarbis)\b[\s,.:!¡¿?]*/i
const SPEECH_RMS = 0.02          // umbral de volumen para considerar que alguien habla
const SILENCE_MS = 800           // silencio que cierra una frase
const MIN_SPEECH_MS = 400
const MAX_SPEECH_MS = 7000
const PREROLL_MS = 300           // audio previo para no cortar el inicio de "Jarvis"
const COMMAND_WINDOW_MS = 8000   // tras "Jarvis" solo, la próxima frase es la orden

interface Options {
  transcribe: (audioB64: string) => Promise<{ text?: string; error?: string }>
  onCommand: (text: string) => void
  onWake: () => void
  paused: boolean                // true mientras JARVIS habla o procesa, para no escucharse a sí mismo
}

function loadEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

export function useWakeWord({ transcribe, onCommand, onWake, paused }: Options) {
  const [enabled, setEnabled] = useState(loadEnabled)
  const [state, setState] = useState<'off' | 'idle' | 'awake' | 'error'>('off')
  const pausedRef = useRef(paused)
  const cbRef = useRef({ transcribe, onCommand, onWake })
  pausedRef.current = paused
  cbRef.current = { transcribe, onCommand, onWake }

  const toggle = useCallback(() => {
    setEnabled(prev => {
      try { localStorage.setItem(STORAGE_KEY, String(!prev)) } catch {}
      return !prev
    })
  }, [])

  useEffect(() => {
    if (!enabled) { setState('off'); return }
    let cancelled = false
    let cleanup = () => {}

    ;(async () => {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      } catch {
        setState('error'); return
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

      const ctx = new AudioContext({ sampleRate: 16000 })
      const rate = ctx.sampleRate
      const source = ctx.createMediaStreamSource(stream)
      const proc = ctx.createScriptProcessor(2048, 1, 1)
      const chunkMs = (2048 / rate) * 1000

      let preroll: Float32Array[] = []
      let segment: Float32Array[] | null = null
      let silenceMs = 0
      let speechMs = 0
      let awakeUntil = 0
      let busy = false

      const finish = async (chunks: Float32Array[]) => {
        const total = chunks.reduce((n, c) => n + c.length, 0)
        const samples = new Float32Array(total)
        let off = 0
        for (const c of chunks) { samples.set(c, off); off += c.length }
        busy = true
        try {
          const { text } = await cbRef.current.transcribe(await blobToBase64(encodeWav(samples, rate)))
          if (!text || cancelled) return
          const awake = Date.now() < awakeUntil
          const m = text.match(WAKE_RE)
          if (m) {
            const rest = text.slice((m.index ?? 0) + m[0].length).trim()
            if (rest) { awakeUntil = 0; setState('idle'); cbRef.current.onCommand(rest) }
            else { awakeUntil = Date.now() + COMMAND_WINDOW_MS; setState('awake'); cbRef.current.onWake() }
          } else if (awake) {
            awakeUntil = 0; setState('idle'); cbRef.current.onCommand(text)
          }
        } finally {
          busy = false
          if (Date.now() >= awakeUntil) setState(s => (s === 'awake' ? 'idle' : s))
        }
      }

      proc.onaudioprocess = e => {
        if (pausedRef.current || busy) { segment = null; preroll = []; return }
        const data = new Float32Array(e.inputBuffer.getChannelData(0))
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
        const loud = Math.sqrt(sum / data.length) > SPEECH_RMS

        if (!segment) {
          preroll.push(data)
          if (preroll.length * chunkMs > PREROLL_MS) preroll.shift()
          if (loud) { segment = [...preroll]; preroll = []; silenceMs = 0; speechMs = 0 }
          return
        }
        segment.push(data)
        speechMs += chunkMs
        silenceMs = loud ? 0 : silenceMs + chunkMs
        if (silenceMs >= SILENCE_MS || speechMs >= MAX_SPEECH_MS) {
          const done = segment
          segment = null
          if (speechMs - silenceMs >= MIN_SPEECH_MS) finish(done)
        }
      }
      source.connect(proc)
      proc.connect(ctx.destination)
      setState('idle')

      cleanup = () => {
        proc.disconnect(); source.disconnect()
        stream.getTracks().forEach(t => t.stop())
        ctx.close()
      }
    })()

    return () => { cancelled = true; cleanup() }
  }, [enabled])

  return { enabled, toggle, state }
}
