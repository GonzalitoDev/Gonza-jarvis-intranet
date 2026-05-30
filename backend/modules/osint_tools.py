import socket
import ssl
import struct
import urllib.parse
import ipaddress
from datetime import datetime
from typing import Optional

import requests

COMMON_PORTS = [
    (21, "FTP"), (22, "SSH"), (23, "Telnet"), (25, "SMTP"),
    (53, "DNS"), (80, "HTTP"), (110, "POP3"), (143, "IMAP"),
    (443, "HTTPS"), (445, "SMB"), (993, "IMAPS"), (995, "POP3S"),
    (1433, "MSSQL"), (1521, "Oracle"), (3306, "MySQL"),
    (3389, "RDP"), (5432, "PostgreSQL"), (5900, "VNC"),
    (6379, "Redis"), (8080, "HTTP-Alt"), (8443, "HTTPS-Alt"),
    (27017, "MongoDB"),
]

SUBDOMAIN_WORDLIST = [
    "www", "mail", "ftp", "admin", "api", "blog", "dev", "test",
    "webmail", "smtp", "pop", "ns1", "ns2", "mx", "cpanel",
    "whm", "vpn", "remote", "intranet", "portal", "web", "secure",
    "support", "forum", "wiki", "shop", "app", "m", "mobile",
    "cdn", "static", "media", "img", "css", "js", "assets",
    "download", "downloads", "upload", "backup", "status",
    "status", "stats", "analytics", "tracker", "git", "svn",
    "jenkins", "jira", "confluence", "gitlab", "grafana",
    "prometheus", "kibana", "elastic", "kafka", "redis",
    "mysql", "db", "database", "sql", "mongo", "mongodb",
    "staging", "stage", "preprod", "prod", "production",
    "develop", "development", "qa", "testing", "demo",
]

IPINFO_URL = "http://ip-api.com/json/{}"

HIBP_API = "https://api.pwnedpasswords.com/range/{}"


# Validation functions for security
def is_private_ip(ip_str: str) -> bool:
    """Valida si una IP es privada o reservada"""
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private or ip.is_loopback or ip.is_reserved
    except (ValueError, ipaddress.AddressValueError):
        return False


def validate_target_domain(domain: str) -> tuple[bool, str]:
    """
    Valida un dominio antes de hacer operaciones OSINT.
    Retorna (es_válido, mensaje_error)
    """
    if not domain or len(domain) > 255:
        return False, "Dominio inválido o muy largo"
    
    # Bloquear localhost y IPs privadas disfrazadas
    if domain.lower() in ["localhost", "127.0.0.1", "0.0.0.0"]:
        return False, "No se pueden escanear direcciones locales"
    
    # Si es una IP, validar que no sea privada
    try:
        ipaddress.ip_address(domain)
        if is_private_ip(domain):
            return False, "No se pueden escanear redes privadas (192.168.x.x, 10.x.x.x, 172.16-31.x.x)"
        return True, ""
    except ValueError:
        # Es un dominio, no una IP
        pass
    
    # Validar caracteres válidos en dominio
    import re
    if not re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', domain):
        return False, "Formato de dominio inválido"
    
    return True, ""


def validate_target_ip(ip_str: str) -> tuple[bool, str]:
    """
    Valida una IP antes de operaciones OSINT.
    Retorna (es_válido, mensaje_error)
    """
    try:
        ip = ipaddress.ip_address(ip_str)
        if is_private_ip(ip_str):
            return False, "No se pueden escanear redes privadas"
        return True, ""
    except (ValueError, ipaddress.AddressValueError):
        return False, "IP inválida"


def validate_url(url: str) -> tuple[bool, str]:
    """
    Valida una URL antes de operaciones como crawling/headers.
    Retorna (es_válido, mensaje_error)
    """
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    
    try:
        parsed = urllib.parse.urlparse(url)
        hostname = parsed.hostname
        
        if not hostname:
            return False, "URL sin hostname válido"
        
        # Bloquear localhost
        if hostname in ["localhost", "127.0.0.1", "0.0.0.0", "::1"]:
            return False, "No se pueden acceder a direcciones locales"
        
        # Validar que no sea IP privada
        try:
            ip = ipaddress.ip_address(hostname)
            if is_private_ip(hostname):
                return False, "No se pueden acceder a redes privadas"
        except ValueError:
            # Es un dominio, no una IP - OK
            pass
        
        return True, ""
    except Exception as e:
        return False, f"URL inválida: {str(e)}"


def dns_lookup(domain: str, record_type: str = "A") -> dict:
    # Validar dominio primero
    is_valid, error_msg = validate_target_domain(domain)
    if not is_valid:
        return {"type": "error", "target": domain, "message": f"Validación fallida: {error_msg}"}
    
    results = []
    try:
        ip = socket.gethostbyname(domain)
        results.append({"type": "A", "value": ip})
    except socket.gaierror:
        pass

    try:
        hostname, _, ip_list = socket.gethostbyname_ex(domain)
        results.append({"type": "A (full)", "value": ", ".join(ip_list)})
    except socket.gaierror:
        pass

    if record_type.upper() in ("MX", "ALL"):
        try:
            mx_records = socket.getaddrinfo(domain, 25, socket.AF_INET, socket.SOCK_STREAM)
            if mx_records:
                results.append({"type": "MX (via getaddrinfo)", "value": mx_records[0][4][0]})
        except socket.gaierror:
            pass

    if not results:
        try:
            ip = socket.gethostbyname(f"www.{domain}")
            results.append({"type": "A (www.)", "value": ip})
        except socket.gaierror:
            pass

    return {
        "target": domain,
        "type": record_type.upper(),
        "results": results if results else [{"type": "error", "value": "No se pudo resolver el dominio"}],
    }


def whois_lookup(domain: str) -> dict:
    # Validar dominio primero
    is_valid, error_msg = validate_target_domain(domain)
    if not is_valid:
        return {"type": "error", "target": domain, "message": f"Validación fallida: {error_msg}"}
    
    try:
        import subprocess
        result = subprocess.run(
            ["whois", domain],
            capture_output=True, text=True, timeout=15
        )
        output = result.stdout or result.stderr
        lines = output.split("\n")[:40]
        parsed = {}
        for line in lines:
            if ":" in line:
                key, _, val = line.partition(":")
                k = key.strip().lower()
                if k in ("domain name", "registrar", "creation date", "expiry date",
                         "updated date", "name server", "registrant name", "registrant organization",
                         "admin email", "tech email", "registrant email"):
                    parsed.setdefault(k, []).append(val.strip())
        return {
            "target": domain,
            "raw": "\n".join(lines),
            "parsed": {k: v[0] if len(v) == 1 else v for k, v in parsed.items()},
        }
    except (FileNotFoundError, subprocess.TimeoutExpired, subprocess.CalledProcessError):
        return _whois_fallback(domain)


def _whois_fallback(domain: str) -> dict:
    try:
        whois_server = "whois.verisign-grs.com"
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        sock.connect((whois_server, 43))
        sock.send(f"{domain}\r\n".encode())
        data = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            data += chunk
        sock.close()
        text = data.decode("utf-8", errors="ignore")
        lines = text.split("\n")[:40]
        return {
            "target": domain,
            "raw": "\n".join(lines),
            "parsed": {},
        }
    except Exception as e:
        return {"target": domain, "error": str(e), "raw": ""}


def ip_geolocation(ip: str) -> dict:
    # Validar IP primero
    is_valid, error_msg = validate_target_ip(ip)
    if not is_valid:
        return {"type": "error", "ip": ip, "message": f"Validación fallida: {error_msg}"}
    
    try:
        resp = requests.get(IPINFO_URL.format(ip), timeout=10)
        data = resp.json()
        if data.get("status") == "success":
            return {
                "ip": data.get("query", ip),
                "country": data.get("country", ""),
                "countryCode": data.get("countryCode", ""),
                "region": data.get("regionName", ""),
                "city": data.get("city", ""),
                "zip": data.get("zip", ""),
                "lat": data.get("lat"),
                "lon": data.get("lon"),
                "isp": data.get("isp", ""),
                "org": data.get("org", ""),
                "as": data.get("as", ""),
                "timezone": data.get("timezone", ""),
            }
        return {"ip": ip, "error": data.get("message", "Unknown error")}
    except Exception as e:
        return {"ip": ip, "error": str(e)}


def port_scan(target: str, ports: Optional[list[int]] = None) -> dict:
    # Validar objetivo primero
    is_valid, error_msg = validate_target_domain(target)
    if not is_valid:
        # Intentar validar como IP
        is_valid_ip, error_msg_ip = validate_target_ip(target)
        if not is_valid_ip:
            return {"type": "error", "target": target, "message": f"Validación fallida: {error_msg} (o IP: {error_msg_ip})"}
    
    if ports is None:
        scan_ports = [p[0] for p in COMMON_PORTS]
    else:
        # Validar que los puertos sean válidos
        scan_ports = []
        invalid_ports = []
        for port in ports:
            try:
                port_int = int(port)
                if 1 <= port_int <= 65535:
                    scan_ports.append(port_int)
                else:
                    invalid_ports.append(port)
            except (ValueError, TypeError):
                invalid_ports.append(port)
        
        if invalid_ports:
            return {"type": "error", "target": target, "message": f"Puertos inválidos: {invalid_ports}"}
        
        if not scan_ports:
            return {"type": "error", "target": target, "message": "No se especificaron puertos válidos"}

    open_ports = []
    for port in scan_ports:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1.5)
            result = sock.connect_ex((target, port))
            sock.close()
            if result == 0:
                service = next((s for p, s in COMMON_PORTS if p == port), "unknown")
                open_ports.append({"port": port, "service": service, "state": "open"})
        except Exception:
            pass

    return {
        "target": target,
        "total_scanned": len(scan_ports),
        "open_ports": open_ports,
        "closed_count": len(scan_ports) - len(open_ports),
    }


def ssl_check(hostname: str, port: int = 443) -> dict:
    # Validar hostname primero
    is_valid, error_msg = validate_target_domain(hostname)
    if not is_valid:
        return {"type": "error", "hostname": hostname, "message": f"Validación fallida: {error_msg}"}
    
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((hostname, port), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                cipher = ssock.cipher()
                return {
                    "hostname": hostname,
                    "port": port,
                    "subject": dict(cert.get("subject", [])[0]) if cert.get("subject") else {},
                    "issuer": dict(cert.get("issuer", [])[0]) if cert.get("issuer") else {},
                    "version": cert.get("version", ""),
                    "serialNumber": cert.get("serialNumber", ""),
                    "notBefore": cert.get("notBefore", ""),
                    "notAfter": cert.get("notAfter", ""),
                    "cipher": cipher[0] if cipher else "",
                    "cipher_bits": cipher[1] if cipher else 0,
                    "cipher_version": cipher[2] if cipher else "",
                    "sni": ssock.server_hostname,
                    "expired": cert.get("notAfter", "") < datetime.utcnow().strftime("%b %d %H:%M:%S %Y GMT"),
                }
    except Exception as e:
        return {"hostname": hostname, "port": port, "error": str(e)}


def http_headers(url: str) -> dict:
    # Validar URL primero
    is_valid, error_msg = validate_url(url)
    if not is_valid:
        return {"type": "error", "url": url, "message": f"Validación fallida: {error_msg}"}
    
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        resp = requests.get(url, timeout=15, allow_redirects=True)
        headers = dict(resp.headers)
        security_headers = {
            "Strict-Transport-Security": headers.get("Strict-Transport-Security", "No presente"),
            "Content-Security-Policy": headers.get("Content-Security-Policy", "No presente"),
            "X-Frame-Options": headers.get("X-Frame-Options", "No presente"),
            "X-Content-Type-Options": headers.get("X-Content-Type-Options", "No presente"),
            "X-XSS-Protection": headers.get("X-XSS-Protection", "No presente"),
            "Referrer-Policy": headers.get("Referrer-Policy", "No presente"),
            "Permissions-Policy": headers.get("Permissions-Policy", "No presente"),
        }
        return {
            "url": url,
            "status_code": resp.status_code,
            "server": headers.get("Server", headers.get("server", "No revelado")),
            "content_type": headers.get("Content-Type", ""),
            "security_headers": security_headers,
            "all_headers": headers,
            "final_url": str(resp.url),
        }
    except Exception as e:
        return {"url": url, "error": str(e)}


def subdomain_enum(domain: str, wordlist: Optional[list[str]] = None) -> dict:
    # Validar dominio primero
    is_valid, error_msg = validate_target_domain(domain)
    if not is_valid:
        return {"type": "error", "domain": domain, "message": f"Validación fallida: {error_msg}"}
    
    if wordlist is None:
        wordlist = SUBDOMAIN_WORDLIST
    found = []
    for sub in wordlist:
        full = f"{sub}.{domain}"
        try:
            ip = socket.gethostbyname(full)
            # Double-check that the discovered IP is not private
            if not is_private_ip(ip):
                found.append({"subdomain": full, "ip": ip})
        except socket.gaierror:
            pass
    return {
        "domain": domain,
        "total_checked": len(wordlist),
        "found": found,
        "count": len(found),
    }


def email_breach_check(email: str) -> dict:
    import hashlib
    # Basic email validation
    import re
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return {"email": email, "error": "Formato de email inválido"}
    
    try:
        h = hashlib.sha1(email.encode()).hexdigest().upper()
        prefix, suffix = h[:5], h[5:]
        resp = requests.get(HIBP_API.format(prefix), timeout=10)
        if resp.status_code == 200:
            hashes = [line.split(":") for line in resp.text.splitlines()]
            for hs, count in hashes:
                if hs == suffix:
                    return {
                        "email": email,
                        "breached": True,
                        "breach_count": int(count),
                        "message": f"Email comprometido en {count} filtraciones.",
                    }
            return {
                "email": email,
                "breached": False,
                "breach_count": 0,
                "message": "Email no encontrado en filtraciones conocidas.",
            }
        return {"email": email, "error": f"API error: {resp.status_code}"}
    except Exception as e:
        return {"email": email, "error": str(e)}
