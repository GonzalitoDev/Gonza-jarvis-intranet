import threading
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from modules.crawler import crawl_url, _extract_text, _can_crawl

LEGAL_KEYWORDS = [
    "ley", "decreto", "resolucion", "resolución", "normativa", "reglamento",
    "articulo", "artículo", "disposicion", "disposición", "ordenanza",
    "codigo", "codigo", "constitucion", "constitucion", "estatuto",
    "acuerdo", "convenio", "directiva", "instruccion", "instruccion",
    "circular", "providencia", "sentencia", "fallo", "jurisprudencia",
    "doctrina", "boletin", "boletín", "digesto", "legislacion",
    "legislacion", "norma", "dictamen", "laudo", "reglamentacion",
    "reglamentacion", "fe de erratas", "modificacion", "modificacion",
    "derogacion", "derogacion", "promulgacion", "promulgacion",
    "veto", "observacion", "observacion", "comunicacion", "comunicacion",
]

LEGAL_URL_PATTERNS = [
    "/ley/", "/decreto/", "/resolucion/", "/resolucion/", "/normativa/",
    "/reglamento/", "/articulo/", "/disposicion/", "/disposicion/",
    "/ordenanza/", "/codigo/", "/constitucion/", "/estatuto/",
    "/acuerdo/", "/convenio/", "/directiva/", "/circular/",
    "/boletin/", "/boletín/", "/digesto/", "/legislacion/",
    "/norma/", "/dictamen/", "/jurisprudencia/", "/fallo/",
    "/sentencia/", "/providencia/",
]

LEGAL_SOURCES = [
    {"url": "https://www.infoleg.gob.ar", "name": "Infoleg", "max_pages": 200, "max_depth": 2},
    {"url": "https://www.boletinoficial.gob.ar", "name": "Boletin Oficial", "max_pages": 100, "max_depth": 2},
    {"url": "https://www.saij.gob.ar", "name": "SAIJ", "max_pages": 100, "max_depth": 2},
    {"url": "https://www.argentina.gob.ar/normativa", "name": "Normativa Argentina", "max_pages": 100, "max_depth": 2},
    {"url": "https://www.csjn.gov.ar", "name": "CSJN", "max_pages": 50, "max_depth": 2},
    {"url": "https://www.diputados.gob.ar/legislacion", "name": "Legislacion Diputados", "max_pages": 50, "max_depth": 2},
    {"url": "https://www.senado.gob.ar/legislacion", "name": "Legislacion Senado", "max_pages": 50, "max_depth": 2},
]

class LegalCrawler:
    def __init__(self, search_engine):
        self.search_engine = search_engine
        self._running = False
        self._thread = None
        self.progress = {
            "running": False,
            "current_source": "",
            "current_url": "",
            "pages_found": 0,
            "pages_indexed": 0,
            "errors": 0,
            "sources_completed": 0,
            "total_sources": len(LEGAL_SOURCES),
            "status_text": ""
        }

    def is_legal_page(self, soup: BeautifulSoup | None, url: str, title: str) -> bool:
        url_lower = url.lower()
        title_lower = title.lower()

        for pattern in LEGAL_URL_PATTERNS:
            if pattern in url_lower:
                return True

        for kw in LEGAL_KEYWORDS:
            if kw in title_lower or kw in url_lower:
                return True

        if soup:
            text = _extract_text(soup)[:500].lower()
            match_count = sum(1 for kw in LEGAL_KEYWORDS if kw in text)
            if match_count >= 3:
                return True

        return False

    def get_domain(self, url: str) -> str:
        return urlparse(url).netloc

    def crawl_source(self, source: dict):
        seed_url = source["url"]
        max_pages = source.get("max_pages", 500)
        max_depth = source.get("max_depth", 3)
        domain = self.get_domain(seed_url)

        self.progress["current_source"] = source["name"]

        visited = set()
        queue = [(seed_url, 0)]
        headers = {"User-Agent": "JARVIS-Intranet-Assistant/1.0"}

        while queue and self._running and len(visited) < max_pages:
            url, depth = queue.pop(0)

            if url in visited or depth > max_depth:
                continue
            visited.add(url)
            self.progress["current_url"] = url
            self.progress["pages_found"] = len(visited)

            try:
                if not _can_crawl(url):
                    continue
                resp = requests.get(url, timeout=10, headers=headers)
                if resp.status_code != 200:
                    continue
                soup = BeautifulSoup(resp.text, "html.parser")
                title = soup.title.string.strip() if soup.title and soup.title.string else url

                if self.is_legal_page(soup, url, title):
                    result = crawl_url(url)
                    if result:
                        self.search_engine.index_page(
                            result["url"], result["title"],
                            result["content"], result["metadata"]
                        )
                        self.progress["pages_indexed"] += 1

                if depth < max_depth:
                    for a_tag in soup.find_all("a", href=True):
                        full_url = urljoin(url, a_tag["href"])
                        parsed = urlparse(full_url)
                        if parsed.scheme in ("http", "https") and self.get_domain(full_url) == domain:
                            clean_url = parsed._replace(fragment="").geturl()
                            if clean_url not in visited:
                                queue.append((clean_url, depth + 1))

                time.sleep(1.0)

            except Exception as e:
                # Cualquier error en una página no debe matar el hilo y dejar "running" colgado
                if not isinstance(e, requests.RequestException):
                    print(f"[legal_crawler] {url}: {e}")
                self.progress["errors"] += 1
                continue

        self.progress["sources_completed"] += 1

    def start_all(self):
        if self._running:
            return

        self._running = True
        self.progress = {
            "running": True,
            "current_source": "",
            "current_url": "",
            "pages_found": 0,
            "pages_indexed": 0,
            "errors": 0,
            "sources_completed": 0,
            "total_sources": len(LEGAL_SOURCES),
            "status_text": "Iniciando indexacion legal..."
        }

        def run():
            try:
                for source in LEGAL_SOURCES:
                    if not self._running:
                        break
                    self.progress["status_text"] = f"Indexando {source['name']}..."
                    self.crawl_source(source)
                self.progress["status_text"] = "Indexacion legal completa"
            except Exception as e:
                self.progress["status_text"] = f"Indexacion detenida por un error: {e}"
            finally:
                self._running = False
                self.progress["running"] = False

        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        self.progress["status_text"] = "Deteniendo..."

    def get_progress(self) -> dict:
        return dict(self.progress)
