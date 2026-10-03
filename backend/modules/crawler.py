import hashlib
import time
import requests
import base64
import os
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
from functools import lru_cache
from pathlib import Path
import json

CACHE_DIR = Path("data/cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Funciones simples de ofuscación para el caché
def _get_cache_key() -> bytes:
    """Genera una clave basada en características de la máquina"""
    # Usamos el MAC address como semilla para generar una clave consistente en esta máquina
    import uuid
    mac = uuid.getnode()
    # Crear una clave determinística pero única para esta máquina
    key_string = f"jarvis-cache-key-{mac}"
    return hashlib.sha256(key_string.encode()).digest()[:16]  # 16 bytes para XOR

def _encrypt_data(data: str) -> str:
    """Ofusca datos usando XOR con clave de máquina"""
    key = _get_cache_key()
    encrypted = bytearray()
    data_bytes = data.encode('utf-8')
    for i, byte in enumerate(data_bytes):
        encrypted.append(byte ^ key[i % len(key)])
    return base64.b64encode(encrypted).decode('utf-8')

def _decrypt_data(encrypted_data: str) -> str:
    """Desofusca datos"""
    try:
        decoded = base64.b64decode(encrypted_data.encode('utf-8'))
        key = _get_cache_key()
        decrypted = bytearray()
        for i, byte in enumerate(decoded):
            decrypted.append(byte ^ key[i % len(key)])
        return decrypted.decode('utf-8')
    except Exception:
        return ""  # Retornar vacío si falla la desofuscación

def _cache_path(url: str) -> Path:
    hash = hashlib.md5(url.encode()).hexdigest()
    return CACHE_DIR / f"{hash}.json.enc"

def _get_cached(url: str) -> dict | None:
    path = _cache_path(url)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                encrypted_json = f.read()
                decrypted_json = _decrypt_data(encrypted_json)
                if decrypted_json:
                    return json.loads(decrypted_json)
        except Exception:
            # Si falla la desofuscación, eliminar el archivo corrupto
            try:
                path.unlink()
            except:
                pass
    return None

def _set_cache(url: str, data: dict):
    try:
        json_str = json.dumps(data, ensure_ascii=False)
        encrypted_json = _encrypt_data(json_str)
        with open(_cache_path(url), "w", encoding="utf-8") as f:
            f.write(encrypted_json)
    except Exception:
        # Fallback: guardar sin encriptar si falla la encriptación
        with open(_cache_path(url).with_suffix('.json'), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

def _extract_text(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)

USER_AGENT = "JARVIS-Intranet-Assistant/1.0"

@lru_cache(maxsize=256)
def _robots_for(origin: str) -> RobotFileParser | None:
    """Descarga y parsea robots.txt una sola vez por dominio."""
    try:
        resp = requests.get(f"{origin}/robots.txt", timeout=5, headers={"User-Agent": USER_AGENT})
    except requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    rp = RobotFileParser()
    rp.parse(resp.text.splitlines())
    return rp

def _can_crawl(url: str) -> bool:
    # Respeta los grupos User-agent; antes cualquier Disallow (incluso para otros bots) bloqueaba
    parsed = urlparse(url)
    rp = _robots_for(f"{parsed.scheme}://{parsed.netloc}")
    return rp.can_fetch(USER_AGENT, url) if rp else True

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
