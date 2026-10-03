import os
import time
import threading
import base64
import hashlib
import secrets
import uuid
from functools import wraps
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from modules.crawler import crawl_url
from modules.search_engine import SearchEngine
from modules.system_control import SystemControl
from modules.responder import Responder
from modules.legal_crawler import LegalCrawler
from modules import personality
from modules.voice import transcribe
from modules.llm import OpenRouterLLM
from modules import llm as llm_module
from modules.osint_tools import (
    dns_lookup, whois_lookup, ip_geolocation, port_scan,
    ssl_check, http_headers, subdomain_enum, email_breach_check,
)
from modules.discord_tools import (
    scan_message as discord_scan_message,
    check_invite as discord_check_invite,
    decode_discord_id,
    scan_urls as discord_scan_urls,
)

# Funciones para almacenar API key de forma segura
def _encrypt_data(data: str) -> str:
    """Encripta datos usando XOR con una clave derivada del hardware (solo para protección básica)"""
    # En un entorno real, usaríamos una biblioteca como cryptography.fernet
    # Esto es solo ofuscación básica para evitar que la key esté en texto plano
    key = hashlib.sha256(str(uuid.getnode()).encode()).digest()[:16]
    encrypted = bytearray()
    for i, byte in enumerate(data.encode()):
        encrypted.append(byte ^ key[i % len(key)])
    return base64.b64encode(encrypted).decode()

def _decrypt_data(encrypted_data: str) -> str:
    """Desencripta datos"""
    try:
        decoded = base64.b64decode(encrypted_data.encode())
        key = hashlib.sha256(str(uuid.getnode()).encode()).digest()[:16]
        decrypted = bytearray()
        for i, byte in enumerate(decoded):
            decrypted.append(byte ^ key[i % len(key)])
        return decrypted.decode()
    except Exception:
        return ""

def _get_secure_api_key() -> str:
    """Obtiene la API key de forma segura"""
    API_KEY = os.environ.get("JARVIS_API_KEY", "")
    if API_KEY:
        return API_KEY
    
    key_path = os.path.join(os.path.dirname(__file__), ".api_key.enc")
    if os.path.exists(key_path):
        try:
            with open(key_path, "r") as f:
                encrypted_key = f.read().strip()
                return _decrypt_data(encrypted_key)
        except Exception:
            pass
    
    # Formato legado (para migración)
    legacy_key_path = os.path.join(os.path.dirname(__file__), ".api_key")
    if os.path.exists(legacy_key_path):
        try:
            with open(legacy_key_path, "r") as f:
                legacy_key = f.read().strip()
                if legacy_key:
                    # Migrar al formato encriptado
                    encrypted_key = _encrypt_data(legacy_key)
                    with open(key_path, "w") as f:
                        f.write(encrypted_key)
                    # Eliminar archivo legado
                    os.remove(legacy_key_path)
                    return legacy_key
        except Exception:
            pass
    
    return ""

API_KEY = _get_secure_api_key()

def verify_key(request: Request):
    if not API_KEY:
        # No hay API key configurada - esto es un error de configuración
        raise HTTPException(status_code=500, detail="API key no configurada. Contacte al administrador.")
    
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Formato de autorización inválido. Use: Bearer <token>")
    
    token = auth[7:]  # Remover "Bearer "
    if not secrets.compare_digest(token.encode(), API_KEY.encode()):
        raise HTTPException(status_code=401, detail="API key inválida")
    
    return True

# --- Rate limiter simple ---
_rate_limit_store = {}
_rate_limit_lock = threading.Lock()
def rate_limit(max_calls: int = 30, period: int = 60):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            window = int(time.time() // period)
            key = (func.__name__, window)
            with _rate_limit_lock:
                # Limpiar ventanas viejas para que el diccionario no crezca indefinidamente
                for old in [k for k in _rate_limit_store if k[0] == func.__name__ and k[1] < window]:
                    del _rate_limit_store[old]
                _rate_limit_store[key] = _rate_limit_store.get(key, 0) + 1
                exceeded = _rate_limit_store[key] > max_calls
            if exceeded:
                raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Esperá un momento.")
            return func(*args, **kwargs)
        return wrapper
    return decorator

app = FastAPI(title="JARVIS Intranet Assistant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "file://"],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

search_engine = SearchEngine("data/index")
system = SystemControl()
responder = Responder(search_engine)
legal_crawler = LegalCrawler(search_engine)
llm = OpenRouterLLM(_encrypt_data, _decrypt_data)

# Track crawling consent
_crawling_consent = False

class CrawlRequest(BaseModel):
    url: str

class QueryRequest(BaseModel):
    query: str

class VoiceRequest(BaseModel):
    audio: str  # WAV en base64
    language: str = "es-AR"

class CommandRequest(BaseModel):
    command: str

class OsintDNSRequest(BaseModel):
    domain: str
    type: str = "A"

class OsintWhoisRequest(BaseModel):
    domain: str

class OsintIPRequest(BaseModel):
    ip: str

class OsintPortScanRequest(BaseModel):
    target: str
    ports: Optional[list[int]] = None

class OsintSSLRequest(BaseModel):
    hostname: str
    port: int = 443

class OsintHeadersRequest(BaseModel):
    url: str

class OsintSubdomainRequest(BaseModel):
    domain: str

class OsintEmailRequest(BaseModel):
    email: str

class OsintDiscordScanRequest(BaseModel):
    message: str

class OsintDiscordInviteRequest(BaseModel):
    code: str

class OsintDiscordIDRequest(BaseModel):
    snowflake: str

class OsintDiscordURLsRequest(BaseModel):
    urls: list[str]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/crawl")
@rate_limit(max_calls=20, period=60)
def crawl(req: CrawlRequest, _=Depends(verify_key)):
    result = crawl_url(req.url)
    if result:
        search_engine.index_page(result["url"], result["title"], result["content"], result["metadata"])
        return {"message": "Page indexed", "title": result["title"], "url": result["url"]}
    raise HTTPException(status_code=400, detail="Failed to crawl URL")

@app.post("/scrape")
@rate_limit(max_calls=20, period=60)
def scrape(req: CrawlRequest, _=Depends(verify_key)):
    result = crawl_url(req.url)
    if result:
        return {
            "url": result["url"],
            "title": result["title"],
            "content_length": len(result["content"]),
            "content": result["content"][:5000],
            "links": result["metadata"]["links"][:30],
            "crawled_at": result["metadata"]["crawled_at"],
        }
    raise HTTPException(status_code=400, detail="Failed to scrape URL")

@app.get("/pages")
def list_pages(_=Depends(verify_key)):
    return search_engine.list_indexed_pages()

@app.post("/query")
@rate_limit(max_calls=30, period=60)
def query(req: QueryRequest, _=Depends(verify_key)):
    if llm.configured:
        results = search_engine.search(responder._extract_keywords(req.query) or req.query, limit=3)
        try:
            return {"type": "answer", "message": llm.answer(req.query, results), "results": results}
        except Exception as e:
            print(f"[llm] {e}")  # Sin IA disponible se sigue con las respuestas locales
    chat = personality.reply(req.query)
    if chat:
        return {"type": "chat", "message": chat}
    return responder.answer(req.query)

class OpenRouterKeyRequest(BaseModel):
    api_key: str

@app.get("/setup/openrouter")
def openrouter_status(_=Depends(verify_key)):
    return {"configured": llm.configured, "model": llm_module.DEFAULT_MODEL}

@app.post("/setup/openrouter")
@rate_limit(max_calls=10, period=60)
def openrouter_set_key(req: OpenRouterKeyRequest, _=Depends(verify_key)):
    key = req.api_key.strip()
    if not key.startswith("sk-or-"):
        raise HTTPException(status_code=400, detail="La key de OpenRouter empieza con sk-or-")
    previous = llm.api_key
    llm.api_key = key
    ok, msg = llm.test()
    if not ok:
        llm.api_key = previous
        raise HTTPException(status_code=400, detail=msg)
    llm.set_key(key)
    return {"configured": True, "message": "OpenRouter conectado. JARVIS ahora usa IA."}

@app.post("/setup/openrouter/clear")
def openrouter_clear(_=Depends(verify_key)):
    llm.clear_key()
    return {"configured": llm.configured, "message": "API key de OpenRouter eliminada"}

@app.get("/greeting")
def greeting(_=Depends(verify_key)):
    return {"message": personality.greeting()}

@app.post("/voice/transcribe")
@rate_limit(max_calls=30, period=60)
def voice_transcribe(req: VoiceRequest, _=Depends(verify_key)):
    return transcribe(req.audio, req.language)

@app.post("/command")
@rate_limit(max_calls=20, period=60)
def command(req: CommandRequest, _=Depends(verify_key)):
    result = system.execute(req.command)
    if "index" in req.command.lower() and "legal" in req.command.lower():
        if not _crawling_consent:
            result = {
                "type": "info", 
                "message": "Para iniciar la indexación legal, primero debe dar consentimiento usando el endpoint /crawl/legal/consent"
            }
        else:
            legal_crawler.start_all()
            result = {"type": "crawl_started", "message": "Indexacion legal automatica iniciada en segundo plano"}
    return result

@app.post("/crawl/legal/consent")
def give_consent(_=Depends(verify_key)):
    global _crawling_consent
    _crawling_consent = True
    return {"message": "Consentimiento otorgado. Ya puede iniciar la indexación legal."}

@app.post("/crawl/legal/start")
@rate_limit(max_calls=5, period=60)
def start_legal_crawl(_=Depends(verify_key)):
    global _crawling_consent
    if not _crawling_consent:
        raise HTTPException(
            status_code=403,
            detail="Crawling deshabilitado. Debe dar consentimiento primero usando /crawl/legal/consent"
        )
    legal_crawler.start_all()
    return {"message": "Indexacion legal iniciada"}

class ApiKeyRequest(BaseModel):
    api_key: str

@app.post("/setup/api-key")
def setup_api_key(req: ApiKeyRequest, _=Depends(verify_key)):
    global API_KEY
    if not req.api_key.strip():
        raise HTTPException(status_code=400, detail="API key no puede estar vacía")
    
    encrypted_key = _encrypt_data(req.api_key.strip())
    key_path = os.path.join(os.path.dirname(__file__), ".api_key.enc")
    with open(key_path, "w") as f:
        f.write(encrypted_key)
    
    API_KEY = req.api_key.strip()
    
    return {"message": "API key actualizada y almacenada de forma segura"}

@app.get("/setup/api-key-status")
def api_key_status(_=Depends(verify_key)):
    return {
        "configured": bool(API_KEY),
        "message": "API key configurada" if API_KEY else "API key no configurada"
    }

@app.post("/crawl/legal/stop")
def stop_legal_crawl(_=Depends(verify_key)):
    legal_crawler.stop()
    return {"message": "Indexacion legal detenida"}

@app.get("/crawl/legal/status")
def legal_crawl_status(_=Depends(verify_key)):
    return legal_crawler.get_progress()

@app.post("/osint/dns")
@rate_limit(max_calls=15, period=60)
def osint_dns(req: OsintDNSRequest, _=Depends(verify_key)):
    return dns_lookup(req.domain, req.type)

@app.post("/osint/whois")
@rate_limit(max_calls=10, period=60)
def osint_whois(req: OsintWhoisRequest, _=Depends(verify_key)):
    return whois_lookup(req.domain)

@app.post("/osint/ipgeo")
@rate_limit(max_calls=15, period=60)
def osint_ipgeo(req: OsintIPRequest, _=Depends(verify_key)):
    return ip_geolocation(req.ip)

@app.post("/osint/portscan")
@rate_limit(max_calls=5, period=60)
def osint_portscan(req: OsintPortScanRequest, _=Depends(verify_key)):
    return port_scan(req.target, req.ports)

@app.post("/osint/ssl")
@rate_limit(max_calls=10, period=60)
def osint_ssl(req: OsintSSLRequest, _=Depends(verify_key)):
    return ssl_check(req.hostname, req.port)

@app.post("/osint/headers")
@rate_limit(max_calls=10, period=60)
def osint_headers(req: OsintHeadersRequest, _=Depends(verify_key)):
    return http_headers(req.url)

@app.post("/osint/subdomains")
@rate_limit(max_calls=5, period=60)
def osint_subdomains(req: OsintSubdomainRequest, _=Depends(verify_key)):
    return subdomain_enum(req.domain)

@app.post("/osint/email")
@rate_limit(max_calls=10, period=60)
def osint_email(req: OsintEmailRequest, _=Depends(verify_key)):
    return email_breach_check(req.email)

@app.post("/osint/discord/scan")
@rate_limit(max_calls=15, period=60)
def osint_discord_scan(req: OsintDiscordScanRequest, _=Depends(verify_key)):
    return discord_scan_message(req.message)

@app.post("/osint/discord/invite")
@rate_limit(max_calls=10, period=60)
def osint_discord_invite(req: OsintDiscordInviteRequest, _=Depends(verify_key)):
    return discord_check_invite(req.code)

@app.post("/osint/discord/id")
@rate_limit(max_calls=15, period=60)
def osint_discord_id(req: OsintDiscordIDRequest, _=Depends(verify_key)):
    return decode_discord_id(req.snowflake)

@app.post("/osint/discord/urls")
@rate_limit(max_calls=10, period=60)
def osint_discord_urls(req: OsintDiscordURLsRequest, _=Depends(verify_key)):
    return discord_scan_urls(req.urls)

# El mount de archivos estáticos va al final: montado en "/" antes de las rutas
# las taparía a todas (Starlette resuelve en orden de registro).
static_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
