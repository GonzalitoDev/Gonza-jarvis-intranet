# JARVIS Intranet Assistant - Cliente Móvil

Cliente React Native para Android e iOS con todas las funcionalidades OSINT y búsqueda de la aplicación de escritorio.

## Características

- 🔍 **Búsqueda Avanzada**: Indexa y busca en sitios legales
- 🛠️ **Herramientas OSINT**:
  - DNS Lookup
  - WHOIS Information
  - IP Geolocation
  - Port Scanning
  - SSL Certificate Check
  - HTTP Headers Analysis
  - Subdomain Enumeration
  - Email Breach Detection

- 🔐 **Seguridad**:
  - API Key almacenada en Keychain
  - Validación de OSINT (bloquea IPs privadas)
  - Autenticación contra servidor

- 📱 **Interfaz Móvil**:
  - Diseño responsive
  - Navegación por tabs
  - Dark mode ready

## Requisitos

- Node.js 16+
- React Native CLI
- Android Studio (para Android)
- Xcode (para iOS)
- Acceso a servidor JARVIS Intranet

## Instalación

```bash
# Instalar dependencias
cd mobile-client
npm install

# Para Android
npm run android

# Para iOS
npm run ios
```

## Configuración

1. Abre la app y ve a Settings
2. Ingresa tu API key del servidor JARVIS
3. Configura la URL del servidor (ej: `http://192.168.1.100:8765`)
4. Presiona "Guardar"

## Build para Producción

### Android

```bash
npm run build:android:apk
```

Esto generará un APK en `android/app/build/outputs/apk/release/`

### iOS

```bash
npm run build:ios
```

## Estructura del Proyecto

```
mobile-client/
├── App.tsx                    # Componente principal
├── services/
│   └── ApiClient.ts          # Cliente HTTP
├── screens/
│   ├── HomeScreen.tsx        # Búsqueda principal
│   ├── OSINTScreen.tsx       # Herramientas OSINT
│   ├── SearchScreen.tsx      # Búsqueda avanzada
│   └── SettingsScreen.tsx    # Configuración
└── package.json
```

## API Endpoints

El cliente se conecta a los siguientes endpoints del servidor:

- `POST /query` - Búsqueda
- `GET /pages` - Lista de páginas indexadas
- `POST /crawl` - Crawlear URL
- `POST /osint/*` - Herramientas OSINT
- `POST /crawl/legal/*` - Crawling legal

## Seguridad

- La API key se almacena en el Keychain del dispositivo
- Se validan todas las IPs/dominios antes de operaciones OSINT
- Se bloquean IPs privadas (192.168.x.x, 10.x.x.x, etc.)
- Timeout de 30 segundos para operaciones

## Permisos Requeridos

### Android

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### iOS

- Network access (Info.plist)
- Keychain access

## Solución de Problemas

### "No se puede conectar al servidor"
- Verifica que el servidor está corriendo
- Verifica la URL ingresada en configuración
- Asegúrate de estar en la misma red o que el servidor sea accesible

### "API key inválida"
- Verifica que ingresaste correctamente la API key
- Revisa que el servidor tiene la misma API key configurada

### "Error en OSINT tools"
- Algunos ISP pueden bloquear ciertos puertos (DNS, WHOIS)
- Intenta desde una red diferente

## Contribución

Este proyecto es parte de JARVIS Intranet Assistant. Para reportar bugs o sugerencias, abre un issue en GitHub.

## Licencia

Ver archivo LICENSE en la raíz del proyecto.
