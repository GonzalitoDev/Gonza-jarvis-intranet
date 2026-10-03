import base64
import io

MAX_AUDIO_BYTES = 10 * 1024 * 1024


def transcribe(audio_b64: str, language: str = "es-AR") -> dict:
    try:
        data = base64.b64decode(audio_b64)
    except Exception:
        return {"error": "Audio inválido"}
    if not data or len(data) > MAX_AUDIO_BYTES:
        return {"error": "Audio vacío o demasiado largo"}

    # Import diferido: si falta la dependencia, solo falla la voz y no todo el backend
    try:
        import speech_recognition as sr
    except ImportError:
        return {"error": "Falta instalar SpeechRecognition (pip install -r requirements.txt)."}

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
