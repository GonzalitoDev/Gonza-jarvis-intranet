import { useState, useCallback, useEffect } from 'react'
import type { BackendResponse, Page, CrawlProgress } from '../types'

const BACKEND_URL = 'http://127.0.0.1:8765'

export function useBackend() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState<Page[]>([])
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null)

  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then(r => r.json())
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [])

  useEffect(() => {
    if (!connected) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/crawl/legal/status`)
        const data = await res.json()
        setCrawlProgress(data)
      } catch {
        // ignore
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [connected])

  const query = useCallback(async (q: string): Promise<BackendResponse> => {
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data: BackendResponse = await res.json()
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  const executeCommand = useCallback(async (cmd: string): Promise<BackendResponse> => {
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      })
      const data: BackendResponse = await res.json()
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  const crawlUrl = useCallback(async (url: string): Promise<BackendResponse> => {
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data: BackendResponse = await res.json()
      await refreshPages()
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  const startLegalCrawl = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/crawl/legal/start`, { method: 'POST' })
    } catch {
      // ignore
    }
  }, [])

  const stopLegalCrawl = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/crawl/legal/stop`, { method: 'POST' })
    } catch {
      // ignore
    }
  }, [])

  const refreshPages = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/pages`)
      const data = await res.json()
      setPages(data)
    } catch {
      // ignore
    }
  }, [])

  return { connected, loading, pages, crawlProgress, query, executeCommand, crawlUrl, startLegalCrawl, stopLegalCrawl, refreshPages }
}
