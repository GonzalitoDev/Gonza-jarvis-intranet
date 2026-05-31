import re
import json
import base64
import ipaddress
import urllib.parse
from datetime import datetime, timezone
from typing import Optional
import requests

SUSPICIOUS_PATTERNS = {
    "discord_token": {
        "pattern": r"[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}",
        "severity": "alta",
        "label": "Token de Discord"
    },
    "discord_webhook": {
        "pattern": r"https?://discord(?:app)?\.com/api/webhooks/\d+/[\w-]+",
        "severity": "alta",
        "label": "Webhook de Discord"
    },
    "discord_invite": {
        "pattern": r"(?:discord\.(?:gg|com/invite|app/invite|me))/[\w-]+",
        "severity": "media",
        "label": "Invitación de Discord"
    },
    "base64_payload": {
        "pattern": r"(?:eyJ[A-Za-z0-9+/=]+|YWJj[A-Za-z0-9+/=]+)",
        "severity": "media",
        "label": "Posible payload Base64"
    },
    "private_ip": {
        "pattern": r"\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3})\b",
        "severity": "media",
        "label": "IP privada expuesta"
    },
    "suspicious_url": {
        "pattern": r"(?:bit\.ly|tinyurl\.com|shorturl\.at|shorte\.st|rb\.gy|0rz\.tw|s\.gd)/\w+",
        "severity": "media",
        "label": "URL acortada sospechosa"
    },
    "credit_card": {
        "pattern": r"\b(?:\d{4}[-\s]?){3}\d{4}\b",
        "severity": "alta",
        "label": "Posible número de tarjeta"
    },
    "email": {
        "pattern": r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b",
        "severity": "baja",
        "label": "Dirección de email"
    },
    "phone": {
        "pattern": r"\b(?:\+\d{1,3}[-\s]?)?\(?\d{2,4}\)?[-\s]?\d{2,4}[-\s]?\d{2,4}\b",
        "severity": "media",
        "label": "Número de teléfono"
    },
    "suspicious_file": {
        "pattern": r"\b[\w.-]+\.(?:exe|bat|cmd|ps1|vbs|js|jar|dll|scr|zip|rar|7z)\b",
        "severity": "alta",
        "label": "Archivo potencialmente peligroso"
    },
    "crypto_address": {
        "pattern": r"\b(?:1[1-9A-HJ-NP-Za-km-z]{25,34}|3[1-9A-HJ-NP-Za-km-z]{25,34}|bc1[0-9A-Za-z]{38,})\b",
        "severity": "media",
        "label": "Dirección de criptomoneda"
    },
    "authorization_header": {
        "pattern": r"(?:Bearer|Basic|Token)\s+[\w-]{10,}",
        "severity": "alta",
        "label": "Cabecera de autorización"
    },
    "sql_injection": {
        "pattern": r"\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b.*\b(?:FROM|INTO|TABLE|WHERE)\b",
        "severity": "alta",
        "label": "Posible inyección SQL"
    },
    "jwt_token": {
        "pattern": r"\beyJ[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=_\-]+\b",
        "severity": "alta",
        "label": "Token JWT"
    },
}

SUSPICIOUS_KEYWORDS = [
    "nigger", "faggot", "kys", "kill yourself", "cp ", "child porn",
    "hebe", "drogas", "armacion", "hack", "crack", "keygen",
    "exploit", "0day", "shell", "backdoor", "rat ", "malware",
    "ransomware", "ddos", "botnet", "carding", "dox", "doxx",
    "swatting", "cp link", "lolita", "gore", "snuff",
    "compre", "vendo", "arma", "explosivo", "bomba",
    "secuestro", "extorsion", "amenaza",
]

PHISHING_DOMAINS = [
    "free-nitro", "discord-nitro", "steamcommunitu", "steamcomunnity",
    "discordgift", "discordgifts", "nitro-discord", "gift-nitro",
    "verify-discord", "discord-verify", "steam-gift", "free-steam",
    "minecraft-free", "spotify-premium", "netflix-gratis",
]


def decode_discord_id(snowflake: str) -> dict:
    try:
        sid = int(snowflake)
        timestamp = (sid >> 22) + 1420070400000
        dt = datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc)
        worker_id = (sid >> 17) & 0x1F
        process_id = (sid >> 12) & 0x1F
        increment = sid & 0xFFF
        return {
            "id": snowflake,
            "timestamp": dt.isoformat(),
            "date": dt.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "worker_id": worker_id,
            "process_id": process_id,
            "increment": increment,
            "internal": sid,
        }
    except (ValueError, OverflowError):
        return {"error": "ID de Discord inválida"}


def check_invite(invite_code: str) -> dict:
    try:
        resp = requests.get(
            f"https://discord.com/api/v10/invites/{invite_code}",
            timeout=10,
            headers={"User-Agent": "JARVIS-OSINT/1.0"}
        )
        if resp.status_code == 200:
            data = resp.json()
            guild = data.get("guild", {})
            channel = data.get("channel", {})
            inviter = data.get("inviter", {})
            return {
                "code": invite_code,
                "valid": True,
                "guild": guild.get("name", "Desconocido"),
                "guild_id": guild.get("id", ""),
                "channel": channel.get("name", "Desconocido"),
                "channel_id": channel.get("id", ""),
                "member_count": guild.get("approximate_member_count", 0),
                "presence_count": guild.get("approximate_presence_count", 0),
                "inviter": inviter.get("username", "Desconocido"),
                "inviter_id": inviter.get("id", ""),
                "expires_at": data.get("expires_at", "No expira"),
            }
        elif resp.status_code == 404:
            return {"code": invite_code, "valid": False, "error": "Invitación inválida o expirada"}
        else:
            return {"code": invite_code, "valid": False, "error": f"HTTP {resp.status_code}"}
    except requests.RequestException as e:
        return {"code": invite_code, "valid": False, "error": str(e)}


def scan_message(message: str) -> dict:
    findings = []

    for name, info in SUSPICIOUS_PATTERNS.items():
        matches = re.findall(info["pattern"], message, re.IGNORECASE)
        for m in matches:
            findings.append({
                "tipo": info["label"],
                "valor": m[:100],
                "severidad": info["severity"],
            })

    msg_lower = message.lower()
    for kw in SUSPICIOUS_KEYWORDS:
        if kw in msg_lower:
            findings.append({
                "tipo": "Palabra clave sospechosa",
                "valor": kw,
                "severidad": "alta",
            })

    urls = re.findall(r"https?://[^\s<>\"']+|www\.[^\s<>\"']+", message)
    for url in urls:
        parsed = urllib.parse.urlparse(url)
        hostname = parsed.hostname or ""
        for phishing in PHISHING_DOMAINS:
            if phishing in hostname:
                findings.append({
                    "tipo": "Dominio de phishing",
                    "valor": hostname,
                    "severidad": "alta",
                })
                break

    stats = {}
    for f in findings:
        sev = f["severidad"]
        stats[sev] = stats.get(sev, 0) + 1

    risk_score = sum(
        {"alta": 10, "media": 5, "baja": 1}.get(f["severidad"], 0)
        for f in findings
    )

    risk_level = "bajo"
    if risk_score >= 30:
        risk_level = "critico"
    elif risk_score >= 15:
        risk_level = "alto"
    elif risk_score >= 5:
        risk_level = "medio"

    return {
        "message_length": len(message),
        "total_findings": len(findings),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "stats": stats,
        "findings": findings[:50],
    }


def scan_urls(urls: list[str]) -> dict:
    results = []
    for url in urls[:10]:
        parsed = urllib.parse.urlparse(url)
        hostname = parsed.hostname or ""

        ip_check = None
        if hostname:
            try:
                ip = ipaddress.ip_address(hostname)
                ip_check = str(ip)
            except ValueError:
                pass

        result = {
            "url": url,
            "hostname": hostname,
            "has_ip": ip_check is not None,
            "is_private": False,
            "is_phishing": False,
            "has_suspicious_path": False,
        }

        if ip_check:
            try:
                result["is_private"] = ipaddress.ip_address(ip_check).is_private
            except ValueError:
                pass

        for phishing in PHISHING_DOMAINS:
            if phishing in hostname:
                result["is_phishing"] = True
                break

        suspicious_paths = ["/backdoor", "/shell", "/exploit", "/c99", "/r57",
                           "/admin", "/config", "/wp-admin", "/phpmyadmin",
                           "/web-shell", "/cmd", "/bypass"]
        for sp in suspicious_paths:
            if sp in parsed.path.lower():
                result["has_suspicious_path"] = True
                break

        results.append(result)

    return {
        "total_scanned": len(urls),
        "results": results,
    }
