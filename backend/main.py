import os
import time
import threading
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
from modules.osint_tools import (
    dns_lookup, whois_lookup, ip_geolocation, port_scan,
    ssl_check, http_headers, subdomain_enum, email_breach_check,
)

API_KEY = os.environ.get("JARVIS_API_KEY", "")
if not API_KEY:
    key_path = os.path.join(os.path.dirname(__file__), ".api_key")
    if os.path.exists(key_path):
        API_KEY = open(key_path).read().strip()

def verify_key(request: Request):
    if API_KEY:
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {API_KEY}":
            raise HTTPException(status_code=401, detail="API key requerida")
    return True

# --- Rate limiter simple ---
_rate_limit_store = {}
def rate_limit(max_calls: int = 30, period: int = 60):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            ip = "local"
            now = time.time()
            window = now // period
            key = (ip, window)
            if key not in _rate_limit_store:
                _rate_limit_store[key] = 0
            _rate_limit_store[key] += 1
            if _rate_limit_store[key] > max_calls:
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

static_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")

search_engine = SearchEngine("data/index")
system = SystemControl()
responder = Responder(search_engine)
legal_crawler = LegalCrawler(search_engine)

class CrawlRequest(BaseModel):
    url: str

class QueryRequest(BaseModel):
    query: str

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

@app.get("/pages")
def list_pages(_=Depends(verify_key)):
    return search_engine.list_indexed_pages()

@app.post("/query")
@rate_limit(max_calls=30, period=60)
def query(req: QueryRequest, _=Depends(verify_key)):
    result = responder.answer(req.query)
    return result

@app.post("/command")
@rate_limit(max_calls=20, period=60)
def command(req: CommandRequest, _=Depends(verify_key)):
    result = system.execute(req.command)
    if "index" in req.command.lower() and "legal" in req.command.lower():
        legal_crawler.start_all()
        result = {"type": "crawl_started", "message": "Indexacion legal automatica iniciada en segundo plano"}
    return result

@app.post("/crawl/legal/start")
@rate_limit(max_calls=5, period=60)
def start_legal_crawl(_=Depends(verify_key)):
    legal_crawler.start_all()
    return {"message": "Indexacion legal iniciada"}

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

@app.on_event("startup")
def startup():
    t = threading.Thread(target=legal_crawler.start_all, daemon=True)
    t.start()

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
