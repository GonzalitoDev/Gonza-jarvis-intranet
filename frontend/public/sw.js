const CACHE = 'jarvis-v2'
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.svg', './icon-512.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  // Borrar cachés de versiones anteriores
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  // Solo archivos propios: nunca interceptar el backend local ni la API de GitHub
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  // Red primero (para recibir siempre la última versión) y caché como respaldo sin conexión
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  )
})
