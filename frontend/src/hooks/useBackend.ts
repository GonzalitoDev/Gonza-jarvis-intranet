import { useState, useCallback, useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { BackendResponse, Page, CrawlProgress } from '../types'

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
  try {
    return await res.json()
  } catch {
    const text = await res.text()
    return { error: text || `HTTP ${res.status}` }
  }
}

async function apiFetch(url: string, init?: RequestInit): Promise<any> {
  try {
    const res = await fetch(url, init)
    return safeJson(res)
  } catch (e: any) {
    return { error: e.message || 'Error de conexión' }
  }
}

export function useBackend(backendUrl: string) {
  const [connected, setConnected] = useState(IS_ANDROID)
  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState<Page[]>([])
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null)

  const url = (path: string) => `${backendUrl}${path}`

  useEffect(() => {
    if (IS_ANDROID) { setConnected(true); return }
    if (!backendUrl) { setConnected(false); return }
    apiFetch(url('/health'))
      .then((d: any) => setConnected(!!d.status))
      .catch(() => setConnected(false))
  }, [backendUrl])

  useEffect(() => {
    if (!connected || !backendUrl || IS_ANDROID) return
    const interval = setInterval(async () => {
      const d = await apiFetch(url('/crawl/legal/status'))
      if (!d.error) setCrawlProgress(d)
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

  const startLegalCrawl = useCallback(async () => {
    if (nativePlugin) return
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

  return {
    connected, loading, pages, crawlProgress,
    query, executeCommand, crawlUrl,
    startLegalCrawl, stopLegalCrawl, refreshPages,
    osintDNS, osintWhois, osintIPGeo, osintPortScan,
    osintSSL, osintHeaders, osintSubdomains, osintEmail,
  }
}
