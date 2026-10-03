import datetime
import os
import random
import re
import unicodedata

USER_NAME = os.environ.get("JARVIS_USER_NAME", "señor")


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^\w\s]", " ", text).strip()


def _time_greeting() -> str:
    h = datetime.datetime.now().hour
    if 5 <= h < 12:
        return "Buenos días"
    if 12 <= h < 20:
        return "Buenas tardes"
    return "Buenas noches"


def greeting() -> str:
    return random.choice([
        f"{_time_greeting()}, {USER_NAME}. Todos los sistemas en línea. ¿En qué te ayudo?",
        f"{_time_greeting()}, {USER_NAME}. JARVIS operativo y listo.",
        f"Hola, {USER_NAME}. Sistemas cargados al cien por ciento. ¿Qué hacemos hoy?",
    ])


# (patrones, respuestas). Los patrones se comparan contra el texto normalizado, sin tildes.
_RULES = [
    (r"^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal)\b(?!.*\b(busca|abri|indexa)\b)",
     [lambda: greeting()]),
    (r"\b(como estas|como andas|todo bien)\b",
     [lambda: f"Funcionando a la perfección, {USER_NAME}. Gracias por preguntar.",
      lambda: "Todos los sistemas en verde. ¿Y vos?"]),
    (r"\b(quien sos|que sos|como te llamas|presentate)\b",
     [lambda: "Soy JARVIS, tu asistente local. Busco en tus páginas indexadas, controlo el sistema, "
              "tomo notas y analizo redes. Todo corre en tu equipo."]),
    (r"\b(que podes hacer|ayuda|que sabes hacer|comandos)\b",
     [lambda: "Puedo buscar en las páginas indexadas, decirte la hora, el uso de CPU y RAM, abrir programas, "
              "tomar notas y usar las herramientas de análisis del panel lateral. También me podés hablar con el micrófono."]),
    (r"\b(gracias|genial|joya|buenisimo|excelente)\b",
     [lambda: f"Para eso estoy, {USER_NAME}.", lambda: "Un placer ayudar.", lambda: "Cuando quieras."]),
    (r"\b(chau|adios|hasta luego|nos vemos)\b",
     [lambda: f"Hasta luego, {USER_NAME}. Quedo en espera.", lambda: "Nos vemos. Me quedo vigilando el sistema."]),
    (r"\b(contame un chiste|chiste)\b",
     [lambda: "¿Por qué el programador confundió Halloween con Navidad? Porque OCT 31 es igual a DEC 25.",
      lambda: "Hay 10 tipos de personas: las que entienden binario y las que no."]),
]


def reply(text: str):
    """Devuelve una respuesta conversacional, o None si el texto no es charla."""
    t = _norm(text)
    # Frases largas son preguntas reales para el buscador, no charla
    if len(t.split()) > 6:
        return None
    for pattern, answers in _RULES:
        if re.search(pattern, t):
            return random.choice(answers)()
    return None
