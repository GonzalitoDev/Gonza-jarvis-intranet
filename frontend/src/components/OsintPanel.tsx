import { useState } from 'react'
import type {
  OsintDNSResult, OsintWhoisResult, OsintGeoResult, OsintPortResult,
  OsintSSLResult, OsintHeadersResult, OsintSubdomainResult, OsintEmailResult,
} from '../types'

interface OsintPanelProps {
  osintDNS: (domain: string, type?: string) => Promise<OsintDNSResult>
  osintWhois: (domain: string) => Promise<OsintWhoisResult>
  osintIPGeo: (ip: string) => Promise<OsintGeoResult>
  osintPortScan: (target: string, ports?: number[]) => Promise<OsintPortResult>
  osintSSL: (hostname: string, port?: number) => Promise<OsintSSLResult>
  osintHeaders: (url: string) => Promise<OsintHeadersResult>
  osintSubdomains: (domain: string) => Promise<OsintSubdomainResult>
  osintEmail: (email: string) => Promise<OsintEmailResult>
}

type ToolId = 'dns' | 'whois' | 'ipgeo' | 'portscan' | 'ssl' | 'headers' | 'subdomains' | 'email'

interface ToolDef {
  id: ToolId
  label: string
  icon: string
  category: string
  inputLabel: string
  inputPlaceholder: string
}

const TOOLS: ToolDef[] = [
  { id: 'dns', label: 'DNS Lookup', icon: '🌐', category: 'Investigacion', inputLabel: 'Dominio', inputPlaceholder: 'ejemplo.com' },
  { id: 'whois', label: 'WHOIS', icon: '📋', category: 'Investigacion', inputLabel: 'Dominio', inputPlaceholder: 'ejemplo.com' },
  { id: 'ipgeo', label: 'IP Geolocation', icon: '📍', category: 'Investigacion', inputLabel: 'Direccion IP', inputPlaceholder: '8.8.8.8' },
  { id: 'subdomains', label: 'Subdominios', icon: '🔗', category: 'Investigacion', inputLabel: 'Dominio', inputPlaceholder: 'ejemplo.com' },
  { id: 'email', label: 'Email Breach Check', icon: '📧', category: 'Investigacion', inputLabel: 'Email', inputPlaceholder: 'user@ejemplo.com' },
  { id: 'portscan', label: 'Port Scan', icon: '🔌', category: 'Ciberseguridad', inputLabel: 'IP / Host', inputPlaceholder: '192.168.1.1' },
  { id: 'ssl', label: 'SSL Check', icon: '🔒', category: 'Ciberseguridad', inputLabel: 'Hostname', inputPlaceholder: 'ejemplo.com' },
  { id: 'headers', label: 'HTTP Headers', icon: '📡', category: 'Ciberseguridad', inputLabel: 'URL', inputPlaceholder: 'https://ejemplo.com' },
]

const EXTERNAL_TOOLS = [
  {
    category: 'OSINT',
    items: [
      { name: 'Shodan', url: 'https://www.shodan.io', desc: 'Motor de busqueda de dispositivos' },
      { name: 'Censys', url: 'https://search.censys.io', desc: 'Busqueda de hosts/redes' },
      { name: 'Hunter.io', url: 'https://hunter.io', desc: 'Encontrar emails por dominio' },
      { name: 'IntelX', url: 'https://intelx.io', desc: 'Busqueda OSINT avanzada' },
      { name: 'Have I Been Pwned', url: 'https://haveibeenpwned.com', desc: 'Filtraciones de cuentas' },
      { name: 'Dehashed', url: 'https://dehashed.com', desc: 'Credenciales filtradas' },
      { name: 'Wayback Machine', url: 'https://web.archive.org', desc: 'Archivo historico web' },
      { name: 'Shodan InternetDB', url: 'https://internetdb.shodan.io', desc: 'Datos de IP publica' },
    ],
  },
  {
    category: 'Amenazas',
    items: [
      { name: 'VirusTotal', url: 'https://www.virustotal.com', desc: 'Analisis de archivos/URLs' },
      { name: 'AbuseIPDB', url: 'https://www.abuseipdb.com', desc: 'Reportar IPs maliciosas' },
      { name: 'URLScan.io', url: 'https://urlscan.io', desc: 'Escaneo de URLs' },
      { name: 'AlienVault OTX', url: 'https://otx.alienvault.com', desc: 'Threat intelligence' },
      { name: 'MISP', url: 'https://www.misp-project.org', desc: 'Plataforma de comparticion de amenazas' },
      { name: 'GreyNoise', url: 'https://viz.greynoise.io', desc: 'Analisis de ruido IP' },
    ],
  },
  {
    category: 'Analisis Web',
    items: [
      { name: 'SSL Labs', url: 'https://www.ssllabs.com/ssltest', desc: 'Analisis SSL/TLS' },
      { name: 'Security Headers', url: 'https://securityheaders.com', desc: 'Analisis de cabeceras' },
      { name: 'MxToolbox', url: 'https://mxtoolbox.com', desc: 'Diagnostico DNS/email' },
      { name: 'DNS Checker', url: 'https://dnschecker.org', desc: 'Propagacion DNS global' },
      { name: 'BuiltWith', url: 'https://builtwith.com', desc: 'Tecnologias de un sitio' },
      { name: 'Wappalyzer', url: 'https://www.wappalyzer.com', desc: 'Identificar tecnologias web' },
    ],
  },
  {
    category: 'Vulnerabilidades',
    items: [
      { name: 'Exploit DB', url: 'https://www.exploit-db.com', desc: 'Base de exploits' },
      { name: 'CVE Mitre', url: 'https://cve.mitre.org', desc: 'Base de vulnerabilidades CVE' },
      { name: 'NVD NIST', url: 'https://nvd.nist.gov', desc: 'Base nacional de vulnerabilidades' },
      { name: 'MITRE ATT&CK', url: 'https://attack.mitre.org', desc: 'Framework tacticas/tecnicas' },
      { name: 'OWASP', url: 'https://owasp.org', desc: 'Seguridad en aplicaciones' },
      { name: 'CVE Details', url: 'https://www.cvedetails.com', desc: 'Detalles de CVEs' },
    ],
  },
]

export default function OsintPanel(props: OsintPanelProps) {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [input, setInput] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showExternal, setShowExternal] = useState(false)
  const [showLocal, setShowLocal] = useState(true)

  const activeDef = TOOLS.find(t => t.id === activeTool)

  const handleRun = async () => {
    if (!activeTool || !input.trim()) return
    setLoading(true)
    setResult(null)
    try {
      let data: any
      switch (activeTool) {
        case 'dns':
          data = await props.osintDNS(input.trim())
          break
        case 'whois':
          data = await props.osintWhois(input.trim())
          break
        case 'ipgeo':
          data = await props.osintIPGeo(input.trim())
          break
        case 'portscan':
          data = await props.osintPortScan(input.trim())
          break
        case 'ssl':
          data = await props.osintSSL(input.trim())
          break
        case 'headers':
          data = await props.osintHeaders(input.trim())
          break
        case 'subdomains':
          data = await props.osintSubdomains(input.trim())
          break
        case 'email':
          data = await props.osintEmail(input.trim())
          break
      }
      setResult(data)
    } catch (e) {
      setResult({ error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  const renderResult = () => {
    if (!result) return null
    if (result.error) return <div className="osint-error">{(result.error as string).slice(0, 200)}</div>

    switch (activeTool) {
      case 'dns': {
        const d = result as unknown as OsintDNSResult
        return (
          <div className="osint-result-content">
            <div className="osint-result-field"><strong>Target:</strong> {d.target}</div>
            {d.results?.map((r, i) => (
              <div key={i} className="osint-result-field"><strong>{r.type}:</strong> {r.value}</div>
            ))}
          </div>
        )
      }
      case 'whois': {
        const d = result as unknown as OsintWhoisResult
        return (
          <div className="osint-result-content">
            <div className="osint-result-field"><strong>Dominio:</strong> {d.target}</div>
            {d.parsed && Object.entries(d.parsed).map(([k, v]) => (
              <div key={k} className="osint-result-field"><strong>{k}:</strong> {String(v).slice(0, 100)}</div>
            ))}
            {d.raw && <details><summary>Raw output</summary><pre className="osint-raw">{d.raw.slice(0, 500)}</pre></details>}
          </div>
        )
      }
      case 'ipgeo': {
        const d = result as unknown as OsintGeoResult
        return (
          <div className="osint-result-content">
            <div className="osint-result-field"><strong>IP:</strong> {d.ip}</div>
            {d.country && <div className="osint-result-field"><strong>Pais:</strong> {d.country} ({d.countryCode})</div>}
            {d.region && <div className="osint-result-field"><strong>Region:</strong> {d.region}</div>}
            {d.city && <div className="osint-result-field"><strong>Ciudad:</strong> {d.city}</div>}
            {d.isp && <div className="osint-result-field"><strong>ISP:</strong> {d.isp}</div>}
            {d.org && <div className="osint-result-field"><strong>Org:</strong> {d.org}</div>}
            {d.as && <div className="osint-result-field"><strong>AS:</strong> {d.as}</div>}
            {d.lat != null && <div className="osint-result-field"><strong>Coords:</strong> {d.lat}, {d.lon}</div>}
            {d.timezone && <div className="osint-result-field"><strong>Timezone:</strong> {d.timezone}</div>}
          </div>
        )
      }
      case 'portscan': {
        const d = result as unknown as OsintPortResult
        return (
          <div className="osint-result-content">
            <div className="osint-result-field"><strong>Target:</strong> {d.target}</div>
            <div className="osint-result-field"><strong>Escaneados:</strong> {d.total_scanned} puertos</div>
            <div className="osint-result-field"><strong>Abiertos:</strong> {d.open_ports?.length ?? 0}</div>
            {d.open_ports?.length ? (
              <table className="osint-table">
                <thead><tr><th>Puerto</th><th>Servicio</th><th>Estado</th></tr></thead>
                <tbody>
                  {d.open_ports.map((p, i) => (
                    <tr key={i}><td>{p.port}</td><td>{p.service}</td><td className="osint-open">{p.state}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        )
      }
      case 'ssl': {
        const d = result as unknown as OsintSSLResult
        return (
          <div className="osint-result-content">
            <div className="osint-result-field"><strong>Host:</strong> {d.hostname}:{d.port}</div>
            {d.error ? <div className="osint-error">{d.error}</div> : (
              <>
                {d.subject && Object.entries(d.subject).map(([k, v]) => (
                  <div key={k} className="osint-result-field"><strong>Subject {k}:</strong> {v}</div>
                ))}
                {d.issuer && Object.entries(d.issuer).map(([k, v]) => (
                  <div key={k} className="osint-result-field"><strong>Issuer {k}:</strong> {v}</div>
                ))}
                {d.notBefore && <div className="osint-result-field"><strong>Valido desde:</strong> {d.notBefore}</div>}
                {d.notAfter && <div className="osint-result-field"><strong>Valido hasta:</strong> {d.notAfter}</div>}
                {d.cipher && <div className="osint-result-field"><strong>Cipher:</strong> {d.cipher} ({d.cipher_bits} bits)</div>}
                {d.expired != null && (
                  <div className={`osint-result-field ${d.expired ? 'osint-error' : ''}`}>
                    <strong>Expirado:</strong> {d.expired ? 'SI' : 'NO'}
                  </div>
                )}
              </>
            )}
          </div>
        )
      }
      case 'headers': {
        const d = result as unknown as OsintHeadersResult
        return (
          <div className="osint-result-content">
            <div className="osint-result-field"><strong>URL:</strong> {d.url}</div>
            {d.error ? <div className="osint-error">{d.error}</div> : (
              <>
                <div className="osint-result-field"><strong>Status:</strong> {d.status_code}</div>
                <div className="osint-result-field"><strong>Server:</strong> {d.server}</div>
                <div className="osint-result-field"><strong>Content-Type:</strong> {d.content_type}</div>
                <div className="osint-result-field"><strong>URL Final:</strong> {d.final_url}</div>
                {d.security_headers && (
                  <div className="osint-sec-headers">
                    <strong>Security Headers:</strong>
                    {Object.entries(d.security_headers).map(([k, v]) => (
                      <div key={k} className={`osint-sec-hdr ${v === 'No presente' ? 'osint-missing' : 'osint-present'}`}>
                        {k}: {v.slice(0, 80)}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )
      }
      case 'subdomains': {
        const d = result as unknown as OsintSubdomainResult
        return (
          <div className="osint-result-content">
            <div className="osint-result-field"><strong>Dominio:</strong> {d.domain}</div>
            <div className="osint-result-field"><strong>Revisados:</strong> {d.total_checked} subdominios</div>
            <div className="osint-result-field"><strong>Encontrados:</strong> {d.count}</div>
            {d.found?.length ? (
              <table className="osint-table">
                <thead><tr><th>Subdominio</th><th>IP</th></tr></thead>
                <tbody>
                  {d.found.map((s, i) => (
                    <tr key={i}><td>{s.subdomain}</td><td>{s.ip}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        )
      }
      case 'email': {
        const d = result as unknown as OsintEmailResult
        return (
          <div className="osint-result-content">
            <div className="osint-result-field"><strong>Email:</strong> {d.email}</div>
            {d.error ? <div className="osint-error">{d.error}</div> : (
              <>
                <div className={`osint-result-field ${d.breached ? 'osint-breach' : ''}`}>
                  <strong>Comprometido:</strong> {d.breached ? `SI (${d.breach_count} filtraciones)` : 'NO'}
                </div>
                {d.message && <div className="osint-result-field"><strong>Resultado:</strong> {d.message}</div>}
              </>
            )}
          </div>
        )
      }
      default:
        return <pre className="osint-raw">{JSON.stringify(result, null, 2)}</pre>
    }
  }

  return (
    <div className="sidebar-section">
      <h3 style={{ cursor: 'pointer' }} onClick={() => setShowLocal(!showLocal)}>
        OSINT & Ciberseguridad {showLocal ? '▾' : '▸'}
      </h3>
      {showLocal && (
        <>
          <div className="osint-toolbar">
            <div className="osint-tabs">
              {TOOLS.map(t => (
                <button
                  key={t.id}
                  className={`osint-tab ${activeTool === t.id ? 'active' : ''}`}
                  onClick={() => { setActiveTool(t.id); setResult(null); setInput('') }}
                  title={t.label}
                >
                  {t.icon}
                </button>
              ))}
            </div>
          </div>

          {activeDef && (
            <div className="osint-active-tool">
              <div className="osint-input-row">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={activeDef.inputPlaceholder}
                  onKeyDown={e => e.key === 'Enter' && handleRun()}
                />
                <button onClick={handleRun} disabled={loading || !input.trim()}>
                  {loading ? '...' : 'Ejecutar'}
                </button>
              </div>
              {result && (
                <div className="osint-result">
                  <div className="osint-result-header">{activeDef.label}</div>
                  {renderResult()}
                </div>
              )}
            </div>
          )}

          <div className="osint-divider" />

          <h4 style={{ cursor: 'pointer', fontSize: 12, textTransform: 'uppercase', color: '#8892b0', marginBottom: 6 }}
              onClick={() => setShowExternal(!showExternal)}>
            Herramientas Externas {showExternal ? '▾' : '▸'}
          </h4>
          {showExternal && EXTERNAL_TOOLS.map(group => (
            <div key={group.category} className="osint-ext-group">
              <div className="osint-ext-cat">{group.category}</div>
              {group.items.map(item => (
                <a key={item.name} href={item.url} target="_blank" rel="noopener noreferrer"
                   className="osint-ext-link" title={item.desc}>
                  {item.name}
                </a>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
