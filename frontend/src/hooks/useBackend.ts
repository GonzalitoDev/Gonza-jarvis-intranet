import { useState, useCallback, useEffect } from 'react'
import type { BackendResponse, Page, CrawlProgress } from '../types'

export function useBackend(backendUrl: string) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState<Page[]>([])
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null)

  const url = (path: string) => `${backendUrl}${path}`

  useEffect(() => {
    if (!backendUrl) { setConnected(false); return }
    fetch(url('/health'))
      .then(r => r.json())
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [backendUrl])

  useEffect(() => {
    if (!connected || !backendUrl) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(url('/crawl/legal/status'))
        const data = await res.json()
        setCrawlProgress(data)
      } catch {
        // ignore
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [connected, backendUrl])

  const query = useCallback(async (q: string): Promise<BackendResponse> => {
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

  const crawlUrl = useCallback(async (urlToCrawl: string): Promise<BackendResponse> => {
    setLoading(true)
    try {
      const res = await fetch(url('/crawl'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToCrawl }),
      })
      const data: BackendResponse = await res.json()
      await refreshPages()
      return data
    } finally {
      setLoading(false)
    }
  }, [backendUrl])

  const startLegalCrawl = useCallback(async () => {
    try {
      await fetch(url('/crawl/legal/start'), { method: 'POST' })
    } catch {
      // ignore
    }
  }, [backendUrl])

  const stopLegalCrawl = useCallback(async () => {
    try {
      await fetch(url('/crawl/legal/stop'), { method: 'POST' })
    } catch {
      // ignore
    }
  }, [backendUrl])

  const refreshPages = useCallback(async () => {
    try {
      const res = await fetch(url('/pages'))
      const data = await res.json()
      setPages(data)
    } catch {
      // ignore
    }
  }, [backendUrl])

  const osintDNS = useCallback(async (domain: string, type: string = 'A') => {
    const res = await fetch(url('/osint/dns'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, type }),
    })
    return res.json()
  }, [backendUrl])

  const osintWhois = useCallback(async (domain: string) => {
    const res = await fetch(url('/osint/whois'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    })
    return res.json()
  }, [backendUrl])

  const osintIPGeo = useCallback(async (ip: string) => {
    const res = await fetch(url('/osint/ipgeo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    })
    return res.json()
  }, [backendUrl])

  const osintPortScan = useCallback(async (target: string, ports?: number[]) => {
    const res = await fetch(url('/osint/portscan'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, ports }),
    })
    return res.json()
  }, [backendUrl])

  const osintSSL = useCallback(async (hostname: string, port: number = 443) => {
    const res = await fetch(url('/osint/ssl'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname, port }),
    })
    return res.json()
  }, [backendUrl])

  const osintHeaders = useCallback(async (urlToScan: string) => {
    const res = await fetch(url('/osint/headers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlToScan }),
    })
    return res.json()
  }, [backendUrl])

  const osintSubdomains = useCallback(async (domain: string) => {
    const res = await fetch(url('/osint/subdomains'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    })
    return res.json()
  }, [backendUrl])

  const osintEmail = useCallback(async (email: string) => {
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
