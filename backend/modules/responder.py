import re
from modules.search_engine import SearchEngine

STOP_WORDS = {"el", "la", "los", "las", "un", "una", "y", "e", "o", "a", "de", "del", "en",
              "por", "para", "con", "sin", "sobre", "entre", "que", "es", "se", "su",
              "como", "más", "pero", "sí", "no", "lo", "le", "tu", "mi", "me", "te"}

class Responder:
    def __init__(self, search_engine: SearchEngine):
        self.search_engine = search_engine

    def _extract_keywords(self, text: str) -> str:
        text = text.lower()
        text = re.sub(r"[¿?¡!.,;:()\"']", " ", text)
        words = text.split()
        keywords = [w for w in words if w not in STOP_WORDS and len(w) > 2]
        return " ".join(keywords[:10])

    def answer(self, question: str) -> dict:
        keywords = self._extract_keywords(question)
        if not keywords:
            return {
                "type": "no_results",
                "message": "No encontré información sobre eso en las páginas indexadas."
            }

        results = self.search_engine.search(keywords, limit=3)
        if not results:
            return {
                "type": "no_results",
                "message": "No encontré información sobre eso en las páginas indexadas."
            }

        best = results[0]
        return {
            "type": "answer",
            "message": f"Según {best['title']}, la respuesta es:\n\n{best['highlights']}\n\nFuente: {best['url']}",
            "results": results
        }
