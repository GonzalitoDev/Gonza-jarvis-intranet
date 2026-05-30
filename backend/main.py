import threading
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

app = FastAPI(title="JARVIS Intranet Assistant")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

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
def crawl(req: CrawlRequest):
    result = crawl_url(req.url)
    if result:
        search_engine.index_page(result["url"], result["title"], result["content"], result["metadata"])
        return {"message": "Page indexed", "title": result["title"], "url": result["url"]}
    raise HTTPException(status_code=400, detail="Failed to crawl URL")

@app.get("/pages")
def list_pages():
    return search_engine.list_indexed_pages()

@app.post("/query")
def query(req: QueryRequest):
    result = responder.answer(req.query)
    return result

@app.post("/command")
def command(req: CommandRequest):
    result = system.execute(req.command)
    if "index" in req.command.lower() and "legal" in req.command.lower():
        legal_crawler.start_all()
        result = {"type": "crawl_started", "message": "Indexacion legal automatica iniciada en segundo plano"}
    return result

@app.post("/crawl/legal/start")
def start_legal_crawl():
    legal_crawler.start_all()
    return {"message": "Indexacion legal iniciada"}

@app.post("/crawl/legal/stop")
def stop_legal_crawl():
    legal_crawler.stop()
    return {"message": "Indexacion legal detenida"}

@app.get("/crawl/legal/status")
def legal_crawl_status():
    return legal_crawler.get_progress()

@app.post("/osint/dns")
def osint_dns(req: OsintDNSRequest):
    return dns_lookup(req.domain, req.type)

@app.post("/osint/whois")
def osint_whois(req: OsintWhoisRequest):
    return whois_lookup(req.domain)

@app.post("/osint/ipgeo")
def osint_ipgeo(req: OsintIPRequest):
    return ip_geolocation(req.ip)

@app.post("/osint/portscan")
def osint_portscan(req: OsintPortScanRequest):
    return port_scan(req.target, req.ports)

@app.post("/osint/ssl")
def osint_ssl(req: OsintSSLRequest):
    return ssl_check(req.hostname, req.port)

@app.post("/osint/headers")
def osint_headers(req: OsintHeadersRequest):
    return http_headers(req.url)

@app.post("/osint/subdomains")
def osint_subdomains(req: OsintSubdomainRequest):
    return subdomain_enum(req.domain)

@app.post("/osint/email")
def osint_email(req: OsintEmailRequest):
    return email_breach_check(req.email)

@app.on_event("startup")
def startup():
    t = threading.Thread(target=legal_crawler.start_all, daemon=True)
    t.start()

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
