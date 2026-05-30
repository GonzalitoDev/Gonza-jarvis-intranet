import hashlib
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from pathlib import Path
import json

CACHE_DIR = Path("data/cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def _cache_path(url: str) -> Path:
    hash = hashlib.md5(url.encode()).hexdigest()
    return CACHE_DIR / f"{hash}.json"

def _get_cached(url: str) -> dict | None:
    path = _cache_path(url)
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def _set_cache(url: str, data: dict):
    with open(_cache_path(url), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

def _extract_text(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)

def _can_crawl(url: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        resp = requests.get(robots_url, timeout=5)
        if resp.status_code == 200:
            for line in resp.text.splitlines():
                line = line.strip().lower()
                if line.startswith("disallow:") and parsed.path:
                    path = line.split(":", 1)[1].strip()
                    if path and parsed.path.startswith(path):
                        return False
    except requests.RequestException:
        pass
    return True

def crawl_url(url: str, timeout: int = 10) -> dict | None:
    if not _can_crawl(url):
        return None

    cached = _get_cached(url)
    if cached:
        return cached

    try:
        resp = requests.get(url, timeout=timeout, headers={
            "User-Agent": "JARVIS-Intranet-Assistant/1.0"
        })
        resp.raise_for_status()
    except requests.RequestException:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    title = soup.title.string.strip() if soup.title and soup.title.string else url

    content = _extract_text(soup)

    links = []
    for a_tag in soup.find_all("a", href=True):
        full_url = urljoin(url, a_tag["href"])
        parsed = urlparse(full_url)
        if parsed.scheme in ("http", "https"):
            links.append(full_url)

    metadata = {
        "url": url,
        "title": title,
        "links": links[:100],
        "content_length": len(content),
        "crawled_at": time.time()
    }

    result = {
        "url": url,
        "title": title,
        "content": content,
        "metadata": metadata
    }

    _set_cache(url, result)
    return result
