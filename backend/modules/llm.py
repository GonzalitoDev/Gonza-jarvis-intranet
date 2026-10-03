import os
from pathlib import Path

import requests

from modules.personality import USER_NAME

API_URL = "https://openrouter.ai/api/v1/chat/completions"
# "openrouter/free" elige en cada petición un modelo gratuito disponible
DEFAULT_MODEL = os.environ.get("OPENROUTER_MODEL", "openrouter/free")
KEY_PATH = Path("data/openrouter.key.enc")
MAX_HISTORY = 8

SYSTEM_PROMPT = (
    "Sos JARVIS, el asistente personal de {name}. Hablás en español rioplatense, con tono "
    "amable, seguro y un toque de humor elegante, como la IA de un traje de superhéroe. "
    "Tus respuestas se leen en voz alta, así que sé breve (2 a 4 oraciones), sin markdown, "
    "sin listas largas y sin URLs. Si se te da contexto de páginas indexadas, basate en él "
    "y decí de qué página sale el dato; si no alcanza, decilo con honestidad."
)


class OpenRouterLLM:
    def __init__(self, encrypt, decrypt):
        self._encrypt = encrypt
        self._decrypt = decrypt
        self._history: list[dict] = []
        self.api_key = os.environ.get("OPENROUTER_API_KEY", "") or self._load()

    def _load(self) -> str:
        try:
            return self._decrypt(KEY_PATH.read_text().strip()) if KEY_PATH.exists() else ""
        except Exception:
            return ""

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def set_key(self, key: str):
        KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
        KEY_PATH.write_text(self._encrypt(key))
        self.api_key = key
        self._history.clear()

    def clear_key(self):
        KEY_PATH.unlink(missing_ok=True)
        self.api_key = os.environ.get("OPENROUTER_API_KEY", "")
        self._history.clear()

    def test(self) -> tuple[bool, str]:
        try:
            self._complete([{"role": "user", "content": "Respondé solo: ok"}], max_tokens=5)
            return True, "Conectado a OpenRouter"
        except Exception as e:
            return False, str(e)

    def _complete(self, messages: list[dict], max_tokens: int = 400) -> str:
        r = requests.post(
            API_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "X-Title": "JARVIS Intranet Assistant",
            },
            json={"model": DEFAULT_MODEL, "messages": messages, "max_tokens": max_tokens},
            timeout=60,
        )
        if r.status_code == 401:
            raise RuntimeError("La API key de OpenRouter no es válida")
        if r.status_code == 429:
            raise RuntimeError("Límite gratuito de OpenRouter alcanzado; probá en un rato")
        r.raise_for_status()
        content = r.json()["choices"][0]["message"].get("content") or ""
        if not content.strip():
            raise RuntimeError("OpenRouter devolvió una respuesta vacía")
        return content.strip()

    def answer(self, question: str, results: list[dict]) -> str:
        context = ""
        if results:
            parts = [f"[{r['title']}] {r.get('highlights', '')}" for r in results[:3]]
            context = "\n\nContexto de páginas indexadas:\n" + "\n".join(parts)
        messages = [{"role": "system", "content": SYSTEM_PROMPT.format(name=USER_NAME)}]
        messages += self._history
        messages.append({"role": "user", "content": question + context})
        reply = self._complete(messages)
        # El historial guarda la pregunta sin el contexto para no inflar los tokens
        self._history += [{"role": "user", "content": question}, {"role": "assistant", "content": reply}]
        self._history = self._history[-MAX_HISTORY:]
        return reply
