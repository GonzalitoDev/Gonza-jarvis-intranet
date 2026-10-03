import { useState, useCallback, useEffect, useMemo } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { BackendResponse, Page, CrawlProgress } from '../types'
import { getApiKey } from '../connection'

interface OSINTNative {
  dnsLookup: (opts: { domain: string; type?: string }) => Promise<any>
  whoisLookup: (opts: { domain: string }) => Promise<any>
  ipGeoLookup: (opts: { ip: string }) => Promise<any>
  portScan: (opts: { target: string; ports?: number[] }) => Promise<any>
  sslCheck: (opts: { hostname: string; port?: number }) => Promise<any>
  httpHeaders: (opts: { url: string }) => Promise<any>
  subdomainEnum: (opts: { domain: string }) => Promise<any>
  emailBreach: (opts: { email: string }) => Promise<any>
}

const platform = Capacitor.getPlatform()
const IS_ANDROID = platform === 'android'

let nativePlugin: OSINTNative | null = null
if (IS_ANDROID) {
  try {
    nativePlugin = registerPlugin<OSINTNative>('OSINT')
  } catch {}
}

async function safeJson(res: Response): Promise<any> {
  // Leer el body una sola vez: tras res.json() fallido, res.text() lanza "body already used"
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { error: text || `HTTP ${res.status}` }
  }
}

async function apiFetch(url: string, init?: RequestInit): Promise<any> {
  try {
    const headers = new Headers(init?.headers)
    const key = getApiKey()
    if (key && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${key}`)
    const res = await fetch(url, { ...init, headers })
    return safeJson(res)
  } catch (e: any) {
    return { error: e.message || 'Error de conexión' }
  }
}

export function useBackend(backendUrl: string, connVersion = 0) {
  const [connected, setConnected] = useState(IS_ANDROID)
  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState<Page[]>([])
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null)

  const url = (path: string) => `${backendUrl}${path}`

  useEffect(() => {
    if (IS_ANDROID) { setConnected(true); return }
    if (!backendUrl) { setConnected(false); return }
    // Reintenta solo: el backend puede tardar en arrancar o reiniciarse
    // Endpoint con autenticación: así una clave incorrecta no aparece como "conectado"
    const check = () => apiFetch(url('/setup/api-key-status'))
      .then((d: any) => setConnected(typeof d.configured === 'boolean'))
      .catch(() => setConnected(false))
    check()
    const interval = setInterval(check, 3000)
    return () => clearInterval(interval)
  }, [backendUrl, connVersion])

  useEffect(() => {
    if (!connected || !backendUrl || IS_ANDROID) return
    const interval = setInterval(async () => {
      const d = await apiFetch(url('/crawl/legal/status'))
      if (!d.error) setCrawlProgress(d)
      // Mientras la indexación corre, mantener la lista de páginas al día
      if (d.running) {
        const p = await apiFetch(url('/pages'))
        if (Array.isArray(p)) setPages(p)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [connected, backendUrl])

  const query = useCallback(async (q: string): Promise<BackendResponse> => {
    if (nativePlugin) {
      return { type: 'response', message: `'${q}' no disponible sin backend externo`, results: [] }
    }
    setLoading(true)
    try {
      return await apiFetch(url('/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
    } finally {
      setLoading(false)
    }
  }, [backendUrl])

  const executeCommand = useCallback(async (cmd: string): Promise<BackendResponse> => {
    if (nativePlugin) {
      return { type: 'response', message: `Comando '${cmd}' no disponible en Android`, results: [] }
    }
    setLoading(true)
    try {
      return await apiFetch(url('/command'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      })
    } finally {
      setLoading(false)
    }
  }, [backendUrl])

  const crawlUrl = useCallback(async (_urlToCrawl: string): Promise<BackendResponse> => {
    if (nativePlugin) {
      return { type: 'response', message: 'Indexación no disponible en Android', results: [] }
    }
    setLoading(true)
    try {
      const data = await apiFetch(url('/crawl'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: _urlToCrawl }),
      })
      await refreshPages()
      return data
    } finally {
      setLoading(false)
    }
  }, [backendUrl])

  const scrapeUrl = useCallback(async (urlToScrape: string): Promise<any> => {
    if (nativePlugin) return { type: 'response', message: 'Scraping no disponible en Android', results: [] }
    setLoading(true)
    try {
      return await apiFetch(url('/scrape'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToScrape }),
      })
    } finally {
      setLoading(false)
    }
  }, [backendUrl])

  const transcribe = useCallback(async (audio: string): Promise<{ text?: string; error?: string }> => {
    if (nativePlugin) return { error: 'La voz necesita el backend de escritorio' }
    const d = await apiFetch(url('/voice/transcribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio }),
    })
    return d.text ? { text: d.text } : { error: d.error || d.detail || 'No se pudo reconocer la voz' }
  }, [backendUrl])

  const getGreeting = useCallback(async (): Promise<string> => {
    if (nativePlugin) return ''
    const d = await apiFetch(url('/greeting'))
    return d.message || ''
  }, [backendUrl])

  const ai = useMemo(() => ({
    status: () => apiFetch(url('/setup/openrouter')),
    setKey: (api_key: string) => apiFetch(url('/setup/openrouter'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key }),
    }),
    clearKey: () => apiFetch(url('/setup/openrouter/clear'), { method: 'POST' }),
  }), [backendUrl])

  const startLegalCrawl = useCallback(async () => {
    if (nativePlugin) return
    // Pulsar "iniciar" es el consentimiento explícito del usuario; sin él el backend responde 403
    await apiFetch(url('/crawl/legal/consent'), { method: 'POST' })
    await apiFetch(url('/crawl/legal/start'), { method: 'POST' })
  }, [backendUrl])

  const stopLegalCrawl = useCallback(async () => {
    if (nativePlugin) return
    await apiFetch(url('/crawl/legal/stop'), { method: 'POST' })
  }, [backendUrl])

  const refreshPages = useCallback(async () => {
    if (nativePlugin) return
    const data = await apiFetch(url('/pages'))
    if (!data.error) setPages(data)
  }, [backendUrl])

  const osintDNS = useCallback(async (domain: string, type: string = 'A') => {
    if (nativePlugin) return nativePlugin.dnsLookup({ domain, type })
    return apiFetch(url('/osint/dns'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, type }),
    })
  }, [backendUrl])

  const osintWhois = useCallback(async (domain: string) => {
    if (nativePlugin) return nativePlugin.whoisLookup({ domain })
    return apiFetch(url('/osint/whois'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    })
  }, [backendUrl])

  const osintIPGeo = useCallback(async (ip: string) => {
    if (nativePlugin) return nativePlugin.ipGeoLookup({ ip })
    return apiFetch(url('/osint/ipgeo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    })
  }, [backendUrl])

  const osintPortScan = useCallback(async (target: string, ports?: number[]) => {
    if (nativePlugin) return nativePlugin.portScan({ target, ports })
    return apiFetch(url('/osint/portscan'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, ports }),
    })
  }, [backendUrl])

  const osintSSL = useCallback(async (hostname: string, port: number = 443) => {
    if (nativePlugin) return nativePlugin.sslCheck({ hostname, port })
    return apiFetch(url('/osint/ssl'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname, port }),
    })
  }, [backendUrl])

  const osintHeaders = useCallback(async (urlToScan: string) => {
    if (nativePlugin) return nativePlugin.httpHeaders({ url: urlToScan })
    return apiFetch(url('/osint/headers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlToScan }),
    })
  }, [backendUrl])

  const osintSubdomains = useCallback(async (domain: string) => {
    if (nativePlugin) return nativePlugin.subdomainEnum({ domain })
    return apiFetch(url('/osint/subdomains'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    })
  }, [backendUrl])

  const osintEmail = useCallback(async (email: string) => {
    if (nativePlugin) return nativePlugin.emailBreach({ email })
    return apiFetch(url('/osint/email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
  }, [backendUrl])

  const osintDiscord = useCallback(async (message: string) => {
    if (nativePlugin) return { type: 'response', message: 'Discord scan no disponible en Android', results: [] }
    return apiFetch(url('/osint/discord/scan'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
  }, [backendUrl])

  const osintDiscordInvite = useCallback(async (code: string) => {
    if (nativePlugin) return { type: 'response', message: 'Discord invite check no disponible en Android', results: [] }
    return apiFetch(url('/osint/discord/invite'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
  }, [backendUrl])

  return {
    connected, loading, pages, crawlProgress,
    query, executeCommand, crawlUrl, scrapeUrl,
    startLegalCrawl, stopLegalCrawl, refreshPages,
    osintDNS, osintWhois, osintIPGeo, osintPortScan,
    osintSSL, osintHeaders, osintSubdomains, osintEmail,
    osintDiscord, osintDiscordInvite,
    transcribe, getGreeting, ai,
  }
}
