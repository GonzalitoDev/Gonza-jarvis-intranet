package com.jarvis.intranet

import android.os.Handler
import android.os.Looper
import android.util.Log
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.security.MessageDigest
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

class BackendServer(port: Int) : NanoHTTPD(port) {

    private val handler = Handler(Looper.getMainLooper())
    private val executor = java.util.concurrent.Executors.newCachedThreadPool()

    override fun serve(session: IHTTPSession): Response {
        return try {
            val uri = session.uri
            val method = session.method

            // CORS headers
            val corsHeaders = mapOf(
                "Access-Control-Allow-Origin" to "*",
                "Access-Control-Allow-Methods" to "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers" to "Content-Type"
            )

            if (method == Method.OPTIONS) {
                return newFixedLengthResponse(Response.Status.OK, "application/json", "{}").also {
                    corsHeaders.forEach { (k, v) -> it.addHeader(k, v) }
                }
            }

            val response = when {
                uri == "/health" -> handleHealth()
                uri == "/query" -> handleCommand(session, false)
                uri == "/command" -> handleCommand(session, true)
                uri == "/osint/dns" -> handleDNS(session)
                uri == "/osint/whois" -> handleWhois(session)
                uri == "/osint/ipgeo" -> handleIPGeo(session)
                uri == "/osint/portscan" -> handlePortScan(session)
                uri == "/osint/ssl" -> handleSSL(session)
                uri == "/osint/headers" -> handleHeaders(session)
                uri == "/osint/subdomains" -> handleSubdomains(session)
                uri == "/osint/email" -> handleEmail(session)
                uri == "/pages" -> newFixedLengthResponse(Response.Status.OK, "application/json", "[]")
                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json",
                    """{"error":"not found"}""")
            }

            corsHeaders.forEach { (k, v) -> response.addHeader(k, v) }
            response

        } catch (e: Exception) {
            Log.e("BackendServer", "Error handling ${session.uri}", e)
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json",
                """{"error":"${e.message?.replace("\"", "'") ?: "unknown"}"}""")
        }
    }

    private fun handleHealth(): Response {
        return json("""{"status":"ok","mode":"android-embedded"}""")
    }

    private fun handleCommand(session: IHTTPSession, isCommand: Boolean): Response {
        val body = parseBody(session)
        val text = body.optString(if (isCommand) "command" else "query", "")
        return json("""{"type":"response","message":"JARVIS Android: comando '$text' no disponible en modo offline","results":[]}""")
    }

    // === OSINT: DNS ===
    private fun handleDNS(session: IHTTPSession): Response {
        val body = parseBody(session)
        val domain = body.optString("domain", "")
        val type = body.optString("type", "A")
        val results = JSONArray()
        try {
            val addrs = InetAddress.getAllByName(domain)
            for (addr in addrs) {
                results.put(JSONObject().put("type", type).put("value", addr.hostAddress))
            }
        } catch (e: Exception) {
            results.put(JSONObject().put("type", "error").put("value", e.message ?: "Resolution failed"))
        }
        return json(JSONObject().apply {
            put("target", domain)
            put("type", type)
            put("results", results)
        }.toString())
    }

    // === OSINT: WHOIS ===
    private fun handleWhois(session: IHTTPSession): Response {
        val body = parseBody(session)
        val domain = body.optString("domain", "")
        val parsed = JSONObject()
        try {
            val socket = Socket("whois.verisign-grs.com", 43)
            socket.soTimeout = 10000
            socket.getOutputStream().write("$domain\r\n".toByteArray())
            val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
            var line: String?
            var first = true
            while (reader.readLine().also { line = it } != null) {
                if (first) { first = false; continue }
                val parts = line!!.split(": ", limit = 2)
                if (parts.size == 2) parsed.put(parts[0].trim(), parts[1].trim())
                if (parsed.length() > 20) break
            }
            socket.close()
        } catch (e: Exception) {
            parsed.put("error", e.message ?: "WHOIS failed")
        }
        return json(JSONObject().apply {
            put("target", domain)
            put("parsed", parsed)
        }.toString())
    }

    // === OSINT: IP Geo ===
    private fun handleIPGeo(session: IHTTPSession): Response {
        val body = parseBody(session)
        val ip = body.optString("ip", "")
        return try {
            val url = URL("http://ip-api.com/json/$ip?fields=status,country,countryCode,region,city,zip,lat,lon,isp,org,as,timezone,query")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 10000
            conn.readTimeout = 10000
            val text = BufferedReader(InputStreamReader(conn.inputStream)).readText()
            json(text)
        } catch (e: Exception) {
            json("""{"ip":"$ip","error":"${e.message?.replace("\"", "'") ?: "Geo lookup failed"}"}""")
        }
    }

    // === OSINT: Port Scan ===
    private fun handlePortScan(session: IHTTPSession): Response {
        val body = parseBody(session)
        val target = body.optString("target", "")
        val ports = body.optJSONArray("ports") ?: JSONArray("[21,22,23,25,53,80,110,143,443,445,993,995,1433,3306,3389,5432,6379,8080,8443,27017]")
        val open = JSONArray()
        for (i in 0 until ports.length()) {
            val port = ports.getInt(i)
            try {
                val s = Socket()
                s.connect(InetSocketAddress(target, port), 3000)
                s.close()
                open.put(JSONObject().put("port", port).put("service", getServiceName(port)).put("state", "open"))
            } catch (_: Exception) {}
        }
        return json(JSONObject().apply {
            put("target", target)
            put("total_scanned", ports.length())
            put("open_ports", open)
            put("closed_count", ports.length() - open.length())
        }.toString())
    }

    private fun getServiceName(port: Int): String = when (port) {
        21 -> "FTP"; 22 -> "SSH"; 23 -> "Telnet"; 25 -> "SMTP"; 53 -> "DNS"
        80 -> "HTTP"; 110 -> "POP3"; 143 -> "IMAP"; 443 -> "HTTPS"; 445 -> "SMB"
        993 -> "IMAPS"; 995 -> "POP3S"; 1433 -> "MSSQL"; 3306 -> "MySQL"
        3389 -> "RDP"; 5432 -> "PostgreSQL"; 6379 -> "Redis"; 8080 -> "HTTP-Alt"
        8443 -> "HTTPS-Alt"; 27017 -> "MongoDB"; else -> "unknown"
    }

    // === OSINT: SSL ===
    private fun handleSSL(session: IHTTPSession): Response {
        val body = parseBody(session)
        val hostname = body.optString("hostname", "")
        val port = body.optInt("port", 443)
        return try {
            val ctx = SSLContext.getInstance("TLS")
            ctx.init(null, arrayOf(TRUST_ALL), null)
            val sock = ctx.socketFactory.createSocket(hostname, port) as SSLSocket
            sock.soTimeout = 10000
            sock.startHandshake()
            val certs = sock.session.peerCertificates
            val cert = certs[0] as X509Certificate
            val issuer = JSONObject()
            cert.issuerX500Principal.name.split(",").forEach {
                val parts = it.split("=", limit = 2)
                if (parts.size == 2) issuer.put(parts[0].trim(), parts[1].trim())
            }
            val subject = JSONObject()
            cert.subjectX500Principal.name.split(",").forEach {
                val parts = it.split("=", limit = 2)
                if (parts.size == 2) subject.put(parts[0].trim(), parts[1].trim())
            }
            val notBefore = cert.notBefore?.toString() ?: ""
            val notAfter = cert.notAfter?.toString() ?: ""
            sock.close()
            json(JSONObject().apply {
                put("hostname", hostname)
                put("port", port)
                put("subject", subject)
                put("issuer", issuer)
                put("notBefore", notBefore)
                put("notAfter", notAfter)
                put("expired", cert.notAfter?.before(java.util.Date()) ?: true)
                put("cipher", sock.session.cipherSuite)
                put("cipher_bits", sock.session.cipherSuite.length)
            }.toString())
        } catch (e: Exception) {
            json("""{"hostname":"$hostname","port":$port,"error":"${e.message?.replace("\"", "'") ?: "SSL failed"}"}""")
        }
    }

    // === OSINT: HTTP Headers ===
    private fun handleHeaders(session: IHTTPSession): Response {
        val body = parseBody(session)
        val urlStr = body.optString("url", "")
        return try {
            val url = URL(urlStr)
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 10000
            conn.readTimeout = 10000
            conn.instanceFollowRedirects = true
            val secHeaders = JSONObject()
            val allHeaders = JSONObject()
            for ((key, value) in conn.headerFields) {
                if (key != null) {
                    allHeaders.put(key, value.joinToString(", "))
                    val lower = key.lowercase()
                    if (lower.contains("security") || lower in listOf("strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options", "x-xss-protection", "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "cross-origin-embedder-policy")) {
                        secHeaders.put(key, value.joinToString(", "))
                    }
                }
            }
            // Mark missing security headers
            val expected = listOf("Strict-Transport-Security", "Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy")
            for (h in expected) {
                if (!allHeaders.has(h)) secHeaders.put(h, "No presente")
            }
            json(JSONObject().apply {
                put("url", urlStr)
                put("status_code", conn.responseCode)
                put("server", allHeaders.optString("Server", ""))
                put("content_type", allHeaders.optString("Content-Type", ""))
                put("final_url", conn.url.toString())
                put("security_headers", secHeaders)
                put("all_headers", allHeaders)
            }.toString())
        } catch (e: Exception) {
            json("""{"url":"$urlStr","error":"${e.message?.replace("\"", "'") ?: "Headers failed"}"}""")
        }
    }

    // === OSINT: Subdomains ===
    private fun handleSubdomains(session: IHTTPSession): Response {
        val body = parseBody(session)
        val domain = body.optString("domain", "")
        val commons = listOf("www", "mail", "ftp", "admin", "blog", "api", "mail2", "webmail", "dns", "ns1", "ns2", "smtp", "pop3", "imap", "vpn", "dev", "test", "portal", "app", "cdn", "m", "status", "help", "support", "forum", "bbs", "wiki", "intranet", "remote", "exchange", "owa", "autodiscover", "cpanel", "whm", "webmin", "cloud", "mx", "mx1", "mx2")
        val found = JSONArray()
        var checked = 0
        for (sub in commons) {
            checked++
            try {
                val fullName = "$sub.$domain"
                val addrs = InetAddress.getAllByName(fullName)
                for (addr in addrs) {
                    found.put(JSONObject().put("subdomain", fullName).put("ip", addr.hostAddress))
                }
            } catch (_: Exception) {}
        }
        return json(JSONObject().apply {
            put("domain", domain)
            put("total_checked", checked)
            put("found", found)
            put("count", found.length())
        }.toString())
    }

    // === OSINT: Email Breach ===
    private fun handleEmail(session: IHTTPSession): Response {
        val body = parseBody(session)
        val email = body.optString("email", "")
        return try {
            val hash = MessageDigest.getInstance("SHA-1").digest(email.lowercase().toByteArray())
                .joinToString("") { "%02x".format(it) }.uppercase()
            val prefix = hash.substring(0, 5)
            val suffix = hash.substring(5)
            val url = URL("https://api.pwnedpasswords.com/range/$prefix")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 10000
            conn.readTimeout = 10000
            val text = BufferedReader(InputStreamReader(conn.inputStream)).readText()
            val lines = text.split("\r\n", "\n")
            var count = 0
            for (line in lines) {
                val parts = line.split(":")
                if (parts.size == 2 && parts[0] == suffix) {
                    count = parts[1].trim().toIntOrNull() ?: 0
                    break
                }
            }
            json(JSONObject().apply {
                put("email", email)
                put("breached", count > 0)
                put("breach_count", count)
                put("message", if (count > 0) "Email comprometido en $count filtraciones" else "No se encontraron filtraciones")
            }.toString())
        } catch (e: Exception) {
            json("""{"email":"$email","error":"${e.message?.replace("\"", "'") ?: "Check failed"}"}""")
        }
    }

    // === HELPERS ===
    private fun parseBody(session: IHTTPSession): JSONObject {
        return try {
            val files = HashMap<String, String>()
            session.parseBody(files)
            val body = files["postData"] ?: session.queryParameterString ?: "{}"
            JSONObject(body)
        } catch (e: Exception) {
            JSONObject()
        }
    }

    private fun json(text: String): Response {
        return newFixedLengthResponse(Response.Status.OK, "application/json", text)
    }

    companion object {
        private val TRUST_ALL = object : X509TrustManager {
            override fun checkClientTrusted(certs: Array<X509Certificate>, authType: String) {}
            override fun checkServerTrusted(certs: Array<X509Certificate>, authType: String) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        }
    }
}
