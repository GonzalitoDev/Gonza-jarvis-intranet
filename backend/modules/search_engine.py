import json
from pathlib import Path
from whoosh.index import create_in, open_dir, exists_in
from whoosh.fields import Schema, TEXT, ID, STORED
from whoosh.qparser import MultifieldParser, FuzzyTermPlugin
from whoosh.highlight import HtmlFormatter

class SearchEngine:
    def __init__(self, index_dir: str):
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
        writer = self.ix.writer()
        writer.update_document(
            url=url,
            title=title,
            content=content,
            metadata_json=json.dumps(metadata or {}, ensure_ascii=False)
        )
        writer.commit()

    def search(self, query_str: str, limit: int = 5) -> list[dict]:
        results = []
        with self.ix.searcher() as searcher:
            parser = MultifieldParser(["title", "content"], schema=self.schema)
            parser.add_plugin(FuzzyTermPlugin())
            query = parser.parse(query_str)
            hits = searcher.search(query, limit=limit)
            hits.fragmenter.maxchars = 200
            hits.fragmenter.surround = 80
            for hit in hits:
                results.append({
                    "url": hit["url"],
                    "title": hit["title"],
                    "score": hit.score,
                    "highlights": hit.highlights("content", text="..."),
                    "metadata": json.loads(hit["metadata_json"]) if hit.get("metadata_json") else {}
                })
        return results

    def list_indexed_pages(self) -> list[dict]:
        pages = []
        with self.ix.searcher() as searcher:
            for doc in searcher.documents():
                pages.append({
                    "url": doc["url"],
                    "title": doc["title"]
                })
        return pages
