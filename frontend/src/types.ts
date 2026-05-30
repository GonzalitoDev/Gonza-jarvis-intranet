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

export interface CrawlProgress {
  running: boolean
  current_source: string
  current_url: string
  pages_found: number
  pages_indexed: number
  errors: number
  sources_completed: number
  total_sources: number
  status_text: string
}

export interface OsintResult {
  type: string
  title: string
  timestamp: string
  data: Record<string, unknown>
}

export interface OsintDNSResult {
  target: string
  type: string
  results: { type: string; value: string }[]
}

export interface OsintWhoisResult {
  target: string
  raw?: string
  parsed?: Record<string, string>
  error?: string
}

export interface OsintGeoResult {
  ip: string
  country?: string
  countryCode?: string
  region?: string
  city?: string
  zip?: string
  lat?: number
  lon?: number
  isp?: string
  org?: string
  as?: string
  timezone?: string
  error?: string
}

export interface OsintPortResult {
  target: string
  total_scanned: number
  open_ports: { port: number; service: string; state: string }[]
  closed_count: number
}

export interface OsintSSLResult {
  hostname: string
  port: number
  subject?: Record<string, string>
  issuer?: Record<string, string>
  version?: number
  serialNumber?: string
  notBefore?: string
  notAfter?: string
  cipher?: string
  cipher_bits?: number
  cipher_version?: string
  expired?: boolean
  error?: string
}

export interface OsintHeadersResult {
  url: string
  status_code?: number
  server?: string
  content_type?: string
  security_headers?: Record<string, string>
  all_headers?: Record<string, string>
  final_url?: string
  error?: string
}

export interface OsintSubdomainResult {
  domain: string
  total_checked: number
  found: { subdomain: string; ip: string }[]
  count: number
}

export interface OsintEmailResult {
  email: string
  breached?: boolean
  breach_count?: number
  message?: string
  error?: string
}

export type OsintToolType =
  | 'dns'
  | 'whois'
  | 'ipgeo'
  | 'portscan'
  | 'ssl'
  | 'headers'
  | 'subdomains'
  | 'email'
