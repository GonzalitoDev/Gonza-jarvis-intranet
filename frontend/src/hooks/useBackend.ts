import { useState, useCallback, useEffect } from 'react'
import type { BackendResponse, Page } from '../types'

const BACKEND_URL = 'http://127.0.0.1:8765'

export function useBackend() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState<Page[]>([])

  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then(r => r.json())
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [])

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

  const refreshPages = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/pages`)
      const data = await res.json()
      setPages(data)
    } catch {
      // ignore
    }
  }, [])

  return { connected, loading, pages, query, executeCommand, crawlUrl, refreshPages }
}
