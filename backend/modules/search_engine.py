import json
import re
import base64
import hashlib
import os
import threading
from pathlib import Path
from whoosh.index import create_in, open_dir, exists_in
from whoosh.fields import Schema, TEXT, ID, STORED
from whoosh.qparser import MultifieldParser, FuzzyTermPlugin, OrGroup
from whoosh.query import Every
from whoosh.highlight import HtmlFormatter

def _get_search_key() -> bytes:
    """Genera una clave para ofuscar datos de búsqueda"""
    import uuid
    mac = uuid.getnode()
    key_string = f"jarvis-search-key-{mac}"
    return hashlib.sha256(key_string.encode()).digest()[:16]

def _encrypt_data(data: str) -> str:
    """Ofusca datos usando XOR"""
    key = _get_search_key()
    encrypted = bytearray()
    data_bytes = data.encode('utf-8')
    for i, byte in enumerate(data_bytes):
        encrypted.append(byte ^ key[i % len(key)])
    return base64.b64encode(encrypted).decode('utf-8')

def _decrypt_data(encrypted_data: str) -> str:
    """Desofusca datos"""
    try:
        decoded = base64.b64decode(encrypted_data.encode('utf-8'))
        key = _get_search_key()
        decrypted = bytearray()
        for i, byte in enumerate(decoded):
            decrypted.append(byte ^ key[i % len(key)])
        return decrypted.decode('utf-8')
    except Exception:
        return ""

class SearchEngine:
    def __init__(self, index_dir: str):
        # Whoosh admite un solo writer a la vez; el crawler legal escribe desde otro hilo
        self._write_lock = threading.Lock()
        self.index_dir = Path(index_dir)
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self.schema = Schema(
            url=ID(unique=True, stored=True),
            title=TEXT(stored=True),
            content=TEXT(stored=True),
            metadata_json=STORED
        )

        if exists_in(str(self.index_dir)):
            self.ix = open_dir(str(self.index_dir))
        else:
            self.ix = create_in(str(self.index_dir), self.schema)

    def index_page(self, url: str, title: str, content: str, metadata: dict | None = None):
        with self._write_lock:
            self._index_page(url, title, content, metadata)

    def _index_page(self, url: str, title: str, content: str, metadata: dict | None = None):
        writer = self.ix.writer()
        metadata_json = json.dumps(metadata or {}, ensure_ascii=False)
        # Ofuscar los metadatos antes de almacenarlos
        encrypted_metadata = _encrypt_data(metadata_json)
        writer.update_document(
            url=url,
            title=title,
            content=content,
            metadata_json=encrypted_metadata
        )
        writer.commit()

    def search(self, query_str: str, limit: int = 5) -> list[dict]:
        results = []
        with self.ix.searcher() as searcher:
            # OrGroup: basta con que coincidan algunas palabras, no todas
            parser = MultifieldParser(["title", "content"], schema=self.schema, group=OrGroup)
            parser.add_plugin(FuzzyTermPlugin())
            try:
                query = parser.parse(query_str)
            except Exception:
                # Texto con sintaxis de Whoosh rota (paréntesis, comillas, ":"...): buscar como texto plano
                query = parser.parse(" ".join(re.findall(r"\w+", query_str)))
            if query is None or isinstance(query, Every):
                return results
            hits = searcher.search(query, limit=limit)
            hits.fragmenter.maxchars = 200
            hits.fragmenter.surround = 80
            for hit in hits:
                # Desofuscar metadata_json si existe
                metadata = {}
                if hit.get("metadata_json"):
                    try:
                        decrypted_metadata = _decrypt_data(hit["metadata_json"])
                        if decrypted_metadata:
                            metadata = json.loads(decrypted_metadata)
                    except Exception:
                        # Si falla la desofuscación, usar vacío
                        metadata = {}
                
                results.append({
                    "url": hit["url"],
                    "title": hit["title"],
                    "score": hit.score,
                    "highlights": hit.highlights("content", text="..."),
                    "metadata": metadata
                })
        return results

    def list_indexed_pages(self) -> list[dict]:
        pages = []
        with self.ix.searcher() as searcher:
            for doc in searcher.documents():
                # Los campos url y title están almacenados directamente, no necesitan desofuscación
                pages.append({
                    "url": doc["url"],
                    "title": doc["title"]
                })
        return pages
