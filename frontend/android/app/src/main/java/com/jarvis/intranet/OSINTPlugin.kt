package com.jarvis.intranet

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
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

@CapacitorPlugin(name = "OSINT")
class OSINTPlugin : Plugin() {

    // === DNS Lookup ===
    @PluginMethod
    fun dnsLookup(call: PluginCall) {
        Thread {
            try {
                val domain = call.getString("domain") ?: ""
                val type = call.getString("type") ?: "A"
                val results = JSONArray()
                try {
                    val addrs = InetAddress.getAllByName(domain)
                    for (addr in addrs) {
                        results.put(JSONObject().put("type", type).put("value", addr.hostAddress))
                    }
                } catch (e: Exception) {
                    results.put(JSONObject().put("type", "error").put("value", e.message ?: "Resolution failed"))
                }
                val ret = JSObject()
                ret.put("target", domain)
                ret.put("type", type)
                ret.put("results", results)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "DNS lookup failed")
            }
        }.start()
    }

    // === WHOIS Lookup ===
    @PluginMethod
    fun whoisLookup(call: PluginCall) {
        Thread {
            try {
                val domain = call.getString("domain") ?: ""
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
                val ret = JSObject()
                ret.put("target", domain)
                ret.put("parsed", parsed)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "WHOIS lookup failed")
            }
        }.start()
    }

    // === IP Geolocation ===
    @PluginMethod
    fun ipGeoLookup(call: PluginCall) {
        Thread {
            try {
                val ip = call.getString("ip") ?: ""
                try {
                    val url = URL("http://ip-api.com/json/$ip?fields=status,country,countryCode,region,city,zip,lat,lon,isp,org,as,timezone,query")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.connectTimeout = 10000
                    conn.readTimeout = 10000
                    val text = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                    val json = JSObject(text)
                    call.resolve(json)
                } catch (e: Exception) {
                    val ret = JSObject()
                    ret.put("ip", ip)
                    ret.put("error", e.message ?: "Geo lookup failed")
                    call.resolve(ret)
                }
            } catch (e: Exception) {
                call.reject(e.message ?: "IP geo lookup failed")
            }
        }.start()
    }

    // === Port Scan ===
    @PluginMethod
    fun portScan(call: PluginCall) {
        Thread {
            try {
                val target = call.getString("target") ?: ""
                val portsArray = call.getArray("ports")
                    ?: JSONArray("[21,22,23,25,53,80,110,143,443,445,993,995,1433,3306,3389,5432,6379,8080,8443,27017]")
                val open = JSONArray()
                for (i in 0 until portsArray.length()) {
                    val port = portsArray.getInt(i)
                    try {
                        val s = Socket()
                        s.connect(InetSocketAddress(target, port), 3000)
                        s.close()
                        open.put(JSONObject().put("port", port).put("service", getServiceName(port)).put("state", "open"))
                    } catch (_: Exception) {}
                }
                val ret = JSObject()
                ret.put("target", target)
                ret.put("total_scanned", portsArray.length())
                ret.put("open_ports", open)
                ret.put("closed_count", portsArray.length() - open.length())
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "Port scan failed")
            }
        }.start()
    }

    // === SSL Check ===
    @PluginMethod
    fun sslCheck(call: PluginCall) {
        Thread {
            try {
                val hostname = call.getString("hostname") ?: ""
                val port = (call.getInt("port", 443) ?: 443).toInt()
                try {
                    val ctx = SSLContext.getInstance("TLS")
                    ctx.init(null, arrayOf<TrustManager>(TRUST_ALL), null)
                    val factory = ctx.socketFactory
                    val sock = factory.createSocket(hostname, port) as SSLSocket
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

                    val ret = JSObject()
                    ret.put("hostname", hostname)
                    ret.put("port", port)
                    ret.put("subject", subject)
                    ret.put("issuer", issuer)
                    ret.put("notBefore", cert.notBefore?.toString() ?: "")
                    ret.put("notAfter", cert.notAfter?.toString() ?: "")
                    ret.put("expired", cert.notAfter?.before(java.util.Date()) ?: true)
                    ret.put("cipher", sock.session.cipherSuite)
                    ret.put("cipher_bits", sock.session.cipherSuite.length)
                    sock.close()
                    call.resolve(ret)
                } catch (e: Exception) {
                    val ret = JSObject()
                    ret.put("hostname", hostname)
                    ret.put("port", port)
                    ret.put("error", e.message ?: "SSL check failed")
                    call.resolve(ret)
                }
            } catch (e: Exception) {
                call.reject(e.message ?: "SSL check failed")
            }
        }.start()
    }

    // === HTTP Headers ===
    @PluginMethod
    fun httpHeaders(call: PluginCall) {
        Thread {
            try {
                val urlStr = call.getString("url") ?: ""
                try {
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
                            if (lower.contains("security") || lower in listOf(
                                    "strict-transport-security", "content-security-policy",
                                    "x-frame-options", "x-content-type-options",
                                    "x-xss-protection", "referrer-policy",
                                    "permissions-policy", "cross-origin-opener-policy",
                                    "cross-origin-embedder-policy"
                                )) {
                                secHeaders.put(key, value.joinToString(", "))
                            }
                        }
                    }
                    val expected = listOf(
                        "Strict-Transport-Security", "Content-Security-Policy",
                        "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"
                    )
                    for (h in expected) {
                        if (!allHeaders.has(h)) secHeaders.put(h, "No presente")
                    }

                    val ret = JSObject()
                    ret.put("url", urlStr)
                    ret.put("status_code", conn.responseCode)
                    ret.put("server", allHeaders.optString("Server", ""))
                    ret.put("content_type", allHeaders.optString("Content-Type", ""))
                    ret.put("final_url", conn.url.toString())
                    ret.put("security_headers", secHeaders)
                    ret.put("all_headers", allHeaders)
                    call.resolve(ret)
                } catch (e: Exception) {
                    val ret = JSObject()
                    ret.put("url", urlStr)
                    ret.put("error", e.message ?: "Headers check failed")
                    call.resolve(ret)
                }
            } catch (e: Exception) {
                call.reject(e.message ?: "HTTP headers failed")
            }
        }.start()
    }

    // === Subdomain Enumeration ===
    @PluginMethod
    fun subdomainEnum(call: PluginCall) {
        Thread {
            try {
                val domain = call.getString("domain") ?: ""
                val commons = listOf(
                    "www", "mail", "ftp", "admin", "blog", "api", "mail2",
                    "webmail", "dns", "ns1", "ns2", "smtp", "pop3", "imap",
                    "vpn", "dev", "test", "portal", "app", "cdn", "m",
                    "status", "help", "support", "forum", "bbs", "wiki",
                    "intranet", "remote", "exchange", "owa", "autodiscover",
                    "cpanel", "whm", "webmin", "cloud", "mx", "mx1", "mx2"
                )
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
                val ret = JSObject()
                ret.put("domain", domain)
                ret.put("total_checked", checked)
                ret.put("found", found)
                ret.put("count", found.length())
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "Subdomain enumeration failed")
            }
        }.start()
    }

    // === Email Breach Check (HIBP k-anonymous) ===
    @PluginMethod
    fun emailBreach(call: PluginCall) {
        Thread {
            try {
                val email = call.getString("email") ?: ""
                try {
                    val hash = MessageDigest.getInstance("SHA-1")
                        .digest(email.lowercase().toByteArray())
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
                    val ret = JSObject()
                    ret.put("email", email)
                    ret.put("breached", count > 0)
                    ret.put("breach_count", count)
                    ret.put(
                        "message",
                        if (count > 0) "Email comprometido en $count filtraciones"
                        else "No se encontraron filtraciones"
                    )
                    call.resolve(ret)
                } catch (e: Exception) {
                    val ret = JSObject()
                    ret.put("email", email)
                    ret.put("error", e.message ?: "Breach check failed")
                    call.resolve(ret)
                }
            } catch (e: Exception) {
                call.reject(e.message ?: "Email breach check failed")
            }
        }.start()
    }

    // === Helpers ===
    private fun getServiceName(port: Int): String = when (port) {
        21 -> "FTP"; 22 -> "SSH"; 23 -> "Telnet"; 25 -> "SMTP"; 53 -> "DNS"
        80 -> "HTTP"; 110 -> "POP3"; 143 -> "IMAP"; 443 -> "HTTPS"; 445 -> "SMB"
        993 -> "IMAPS"; 995 -> "POP3S"; 1433 -> "MSSQL"; 3306 -> "MySQL"
        3389 -> "RDP"; 5432 -> "PostgreSQL"; 6379 -> "Redis"; 8080 -> "HTTP-Alt"
        8443 -> "HTTPS-Alt"; 27017 -> "MongoDB"; else -> "unknown"
    }

    companion object {
        private val TRUST_ALL = object : X509TrustManager {
            override fun checkClientTrusted(certs: Array<X509Certificate>, authType: String) {}
            override fun checkServerTrusted(certs: Array<X509Certificate>, authType: String) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        }
    }
}
