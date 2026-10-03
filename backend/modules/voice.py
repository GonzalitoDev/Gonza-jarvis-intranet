import base64
import io

import speech_recognition as sr

MAX_AUDIO_BYTES = 10 * 1024 * 1024


def transcribe(audio_b64: str, language: str = "es-AR") -> dict:
    try:
        data = base64.b64decode(audio_b64)
    except Exception:
        return {"error": "Audio inválido"}
    if not data or len(data) > MAX_AUDIO_BYTES:
        return {"error": "Audio vacío o demasiado largo"}

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(io.BytesIO(data)) as source:
            audio = recognizer.record(source)
        text = recognizer.recognize_google(audio, language=language)
        return {"text": text}
    except sr.UnknownValueError:
        return {"error": "No te entendí. Probá de nuevo."}
    except sr.RequestError:
        return {"error": "El reconocimiento de voz necesita conexión a internet."}
    except Exception as e:
        return {"error": f"No se pudo procesar el audio: {e}"}
