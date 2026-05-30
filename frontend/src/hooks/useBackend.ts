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

export function useBackend(backendUrl: string) {
  const [connected, setConnected] = useState(IS_ANDROID)
  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState<Page[]>([])
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null)

  const url = (path: string) => `${backendUrl}${path}`

  useEffect(() => {
    if (IS_ANDROID) { setConnected(true); return }
    if (!backendUrl) { setConnected(false); return }
    fetch(url('/health'))
      .then(r => r.json())
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [backendUrl])

  useEffect(() => {
    if (!connected || !backendUrl || IS_ANDROID) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(url('/crawl/legal/status'))
        const data = await res.json()
        setCrawlProgress(data)
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [connected, backendUrl])

  const query = useCallback(async (q: string): Promise<BackendResponse> => {
    if (nativePlugin) {
      return { type: 'response', message: `'${q}' no disponible sin backend externo`, results: [] }
    }
    setLoading(true)
    try {
      const res = await fetch(url('/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data: BackendResponse = await res.json()
      return data
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
      const res = await fetch(url('/command'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      })
      const data: BackendResponse = await res.json()
      return data
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
      const res = await fetch(url('/crawl'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: _urlToCrawl }),
      })
      const data: BackendResponse = await res.json()
      await refreshPages()
      return data
    } finally {
      setLoading(false)
    }
  }, [backendUrl])

  const startLegalCrawl = useCallback(async () => {
    if (nativePlugin) return
    try {
      await fetch(url('/crawl/legal/start'), { method: 'POST' })
    } catch {}
  }, [backendUrl])

  const stopLegalCrawl = useCallback(async () => {
    if (nativePlugin) return
    try {
      await fetch(url('/crawl/legal/stop'), { method: 'POST' })
    } catch {}
  }, [backendUrl])

  const refreshPages = useCallback(async () => {
    if (nativePlugin) return
    try {
      const res = await fetch(url('/pages'))
      const data = await res.json()
      setPages(data)
    } catch {}
  }, [backendUrl])

  const osintDNS = useCallback(async (domain: string, type: string = 'A') => {
    if (nativePlugin) return nativePlugin.dnsLookup({ domain, type })
    const res = await fetch(url('/osint/dns'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, type }),
    })
    return res.json()
  }, [backendUrl])

  const osintWhois = useCallback(async (domain: string) => {
    if (nativePlugin) return nativePlugin.whoisLookup({ domain })
    const res = await fetch(url('/osint/whois'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    })
    return res.json()
  }, [backendUrl])

  const osintIPGeo = useCallback(async (ip: string) => {
    if (nativePlugin) return nativePlugin.ipGeoLookup({ ip })
    const res = await fetch(url('/osint/ipgeo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    })
    return res.json()
  }, [backendUrl])

  const osintPortScan = useCallback(async (target: string, ports?: number[]) => {
    if (nativePlugin) return nativePlugin.portScan({ target, ports })
    const res = await fetch(url('/osint/portscan'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, ports }),
    })
    return res.json()
  }, [backendUrl])

  const osintSSL = useCallback(async (hostname: string, port: number = 443) => {
    if (nativePlugin) return nativePlugin.sslCheck({ hostname, port })
    const res = await fetch(url('/osint/ssl'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname, port }),
    })
    return res.json()
  }, [backendUrl])

  const osintHeaders = useCallback(async (urlToScan: string) => {
    if (nativePlugin) return nativePlugin.httpHeaders({ url: urlToScan })
    const res = await fetch(url('/osint/headers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlToScan }),
    })
    return res.json()
  }, [backendUrl])

  const osintSubdomains = useCallback(async (domain: string) => {
    if (nativePlugin) return nativePlugin.subdomainEnum({ domain })
    const res = await fetch(url('/osint/subdomains'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    })
    return res.json()
  }, [backendUrl])

  const osintEmail = useCallback(async (email: string) => {
    if (nativePlugin) return nativePlugin.emailBreach({ email })
    const res = await fetch(url('/osint/email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return res.json()
  }, [backendUrl])

  return {
    connected, loading, pages, crawlProgress,
    query, executeCommand, crawlUrl,
    startLegalCrawl, stopLegalCrawl, refreshPages,
    osintDNS, osintWhois, osintIPGeo, osintPortScan,
    osintSSL, osintHeaders, osintSubdomains, osintEmail,
  }
}
