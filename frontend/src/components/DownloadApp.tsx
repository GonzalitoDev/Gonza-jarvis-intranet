import { useEffect, useState } from 'react'
import { isElectron } from '../connection'

const REPO = 'GonzalitoDev/Gonza-jarvis-intranet'
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`

interface Asset { name: string; browser_download_url: string; size: number }

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`

// Solo en la web: enlaces directos al instalador de Windows y al APK de la última versión
export default function DownloadApp() {
  const [version, setVersion] = useState('')
  const [exe, setExe] = useState<Asset | null>(null)
  const [apk, setApk] = useState<Asset | null>(null)

  useEffect(() => {
    if (isElectron()) return
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then(r => (r.ok ? r.json() : null))
      .then(rel => {
        if (!rel) return
        const assets: Asset[] = rel.assets || []
        setVersion(rel.tag_name || '')
        setExe(assets.find(a => a.name.endsWith('.exe')) || null)
        setApk(assets.find(a => a.name.endsWith('.apk')) || null)
      })
      .catch(() => {})
  }, [])

  if (isElectron()) return null

  return (
    <div className="sidebar-section">
      <h3>Descargar JARVIS {version && <span className="ai-note">{version}</span>}</h3>
      <div className="download-buttons">
        <a className="download-btn" href={exe?.browser_download_url || RELEASES_URL}>
          🪟 Windows{exe ? ` · ${mb(exe.size)}` : ''}
        </a>
        <a className="download-btn" href={apk?.browser_download_url || RELEASES_URL}>
          🤖 Android{apk ? ` · ${mb(apk.size)}` : ''}
        </a>
      </div>
      <p className="ai-note">
        La app de escritorio trae el motor local completo: voz, control del sistema e indexación.
      </p>
    </div>
  )
}
