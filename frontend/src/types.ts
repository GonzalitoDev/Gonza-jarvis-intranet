export interface Page {
  url: string
  title: string
}

export interface SearchResult extends Page {
  score: number
  highlights: string
  metadata: Record<string, unknown>
}

export interface BackendResponse {
  type: string
  message: string
  results?: SearchResult[]
  data?: Record<string, unknown>
  files?: string[]
  notes?: string[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  results?: SearchResult[]
}

export interface BackendStatus {
  connected: boolean
  loading: boolean
}

export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  total: number
  transferred: number
}

export interface UpdateInfo {
  version: string
  releaseName?: string
  releaseDate?: string
}

export type UpdateStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; info: UpdateInfo }
  | { status: 'not-available' }
  | { status: 'downloading'; progress: UpdateProgress }
  | { status: 'downloaded'; info: UpdateInfo }
  | { status: 'error'; message: string }
