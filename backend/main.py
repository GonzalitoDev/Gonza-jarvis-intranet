import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from modules.crawler import crawl_url
from modules.search_engine import SearchEngine
from modules.system_control import SystemControl
from modules.responder import Responder

app = FastAPI(title="JARVIS Intranet Assistant")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

search_engine = SearchEngine("data/index")
system = SystemControl()
responder = Responder(search_engine)

class CrawlRequest(BaseModel):
    url: str

class QueryRequest(BaseModel):
    query: str

class CommandRequest(BaseModel):
    command: str

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
    return system.execute(req.command)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
