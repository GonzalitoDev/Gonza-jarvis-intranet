import os
import platform
import datetime
import subprocess
import json
import re
import psutil
from pathlib import Path
from modules.crawler import crawl_url

NOTES_DIR = Path("data/notes")
NOTES_DIR.mkdir(parents=True, exist_ok=True)

class SystemControl:
    def execute(self, command: str) -> dict:
        cmd_lower = command.lower().strip()

        if any(kw in cmd_lower for kw in ["ram", "memoria", "cpu", "disco", "rendimiento", "rendimientp"]):
            return self._system_info()

        if "hora" in cmd_lower or "fecha" in cmd_lower or "día" in cmd_lower or "dia" in cmd_lower:
            return self._datetime()

        if cmd_lower.startswith("tomá nota") or cmd_lower.startswith("toma nota") or cmd_lower.startswith("guardá") or cmd_lower.startswith("guarda"):
            text = command.split(":", 1)[-1].strip() if ":" in command else command.split("nota", 1)[-1].strip()
            return self._save_note(text)

        if cmd_lower.startswith("listá") or cmd_lower.startswith("lista") or cmd_lower.startswith("listar"):
            parts = command.split(" ", 1)
            path = parts[1].strip() if len(parts) > 1 else "."
            return self._list_files(path)

        if cmd_lower.startswith("abrí") or cmd_lower.startswith("abri") or cmd_lower.startswith("abrir"):
            app = command.split(" ", 1)[-1].strip() if " " in command else ""
            return self._launch_app(app)

        if cmd_lower.startswith("notas") or cmd_lower == "notas":
            return self._list_notes()

        if cmd_lower.startswith("scrapea") or cmd_lower.startswith("extrae") or cmd_lower.startswith("scrape"):
            url = re.search(r"https?://\S+", command)
            if url:
                return self._scrape(url.group())
            return {"type": "error", "message": "No encontré una URL válida. Ej: scrapea https://ejemplo.com"}

        return {"type": "unknown", "message": f"No entendí el comando: {command}. Probá con: RAM, hora, abrí [app], tomá nota: ..., listá [carpeta], scrapea [url]."}

    def _system_info(self) -> dict:
        mem = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=1)
        disk = psutil.disk_usage("/")
        return {
            "type": "system_info",
            "message": (
                f"RAM: {mem.used // (1024**3)} GB / {mem.total // (1024**3)} GB ({mem.percent}% usado)\n"
                f"CPU: {cpu}%\n"
                f"Disco: {disk.used // (1024**3)} GB / {disk.total // (1024**3)} GB ({disk.percent}% usado)"
            ),
            "data": {
                "ram_percent": mem.percent,
                "cpu_percent": cpu,
                "disk_percent": disk.percent
            }
        }

    def _datetime(self) -> dict:
        now = datetime.datetime.now()
        return {
            "type": "datetime",
            "message": f"Son las {now.strftime('%H:%M')} del {now.strftime('%d/%m/%Y')}",
            "data": {"datetime": now.isoformat()}
        }

    def _save_note(self, text: str) -> dict:
        if not text:
            return {"type": "error", "message": "No escribiste nada para guardar."}
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = NOTES_DIR / f"nota_{ts}.txt"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(text)
        return {"type": "note_saved", "message": f"Nota guardada: {filepath.name}"}

    def _list_notes(self) -> dict:
        notes = sorted(NOTES_DIR.iterdir(), key=os.path.getmtime, reverse=True)
        if not notes:
            return {"type": "notes_list", "message": "No hay notas guardadas.", "notes": []}
        lines = []
        for n in notes:
            with open(n, "r", encoding="utf-8") as f:
                preview = f.read()[:80]
            lines.append(f"{n.name}: {preview}")
        return {"type": "notes_list", "message": "\n".join(lines), "notes": [n.name for n in notes]}

    def _list_files(self, path: str) -> dict:
        try:
            p = Path(path)
            if not p.exists():
                return {"type": "error", "message": f"La carpeta '{path}' no existe."}
            items = list(p.iterdir())
            if not items:
                return {"type": "file_list", "message": f"'{path}' está vacía.", "files": []}
            lines = []
            for item in items:
                lines.append(f"{'[DIR]' if item.is_dir() else '[FILE]'} {item.name}")
            return {"type": "file_list", "message": "\n".join(lines), "files": [str(i) for i in items]}
        except PermissionError:
            return {"type": "error", "message": f"No tengo permisos para leer '{path}'."}

    def _scrape(self, url: str) -> dict:
        result = crawl_url(url)
        if not result:
            return {"type": "error", "message": f"No pude acceder a {url}."}
        content = result["content"][:2000]
        return {
            "type": "scrape",
            "message": f"**{result['title']}**\n\n{content}\n\nFuente: {result['url']}",
            "data": {"title": result["title"], "url": result["url"], "content": result["content"]}
        }

    def _launch_app(self, app: str) -> dict:
        app_map = {
            "chrome": "chrome",
            "edge": "msedge",
            "firefox": "firefox",
            "notepad": "notepad",
            "calculadora": "calc",
            "calculator": "calc",
            "explorer": "explorer",
            "cmd": "cmd",
            "terminal": "cmd",
            "powershell": "powershell",
            "vscode": "code",
            "visual studio code": "code",
        }
        mapped = app_map.get(app.lower().strip(), app.lower().strip())
        try:
            if platform.system() == "Windows":
                subprocess.Popen(mapped, shell=True)
            elif platform.system() == "Darwin":
                subprocess.Popen(["open", "-a", mapped])
            else:
                subprocess.Popen([mapped])
            return {"type": "app_launched", "message": f"Abriendo {app}..."}
        except FileNotFoundError:
            return {"type": "error", "message": f"No encontré la aplicación '{app}'."}
