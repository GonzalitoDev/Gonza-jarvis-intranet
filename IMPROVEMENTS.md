# JARVIS Intranet Assistant - Legal & Security Improvements

## Summary of Changes

Your application has been improved with security hardening and legal compliance measures. Here's what was done:

---

## ✅ 1. LICENSE ADDED (MIT)
**File**: `LICENSE`
- Added MIT License to make the project legally clear
- Now anyone can see exactly what they can and cannot do with the code
- Update: `package.json` now includes `"license": "MIT"`

---

## ✅ 2. BACKEND SECURITY HARDENED
**File**: `backend/main.py`

### Network Binding (CRITICAL)
- **Before**: `host="0.0.0.0"` (exposed to entire network)
- **After**: `host="127.0.0.1"` (localhost only)
- **Impact**: Backend is now only accessible from the local machine

### CORS Policy (CRITICAL)
- **Before**: `allow_origins=["*"]` (anyone can call your API)
- **After**: `allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "file://"]`
- **Impact**: Only the frontend and local dev can call the API

### API Authentication
- **Added**: Optional API key authentication via `JARVIS_API_KEY` environment variable
- **How to use**:
  ```bash
  set JARVIS_API_KEY=your-secret-key  # Windows
  export JARVIS_API_KEY=your-secret-key  # Linux/Mac
  ```
- **Or**: Create a file `backend/.api_key` with your key
- **Headers required**: `Authorization: Bearer your-secret-key`
- **If not set**: No authentication required (for backward compatibility)

### Rate Limiting (NEW)
- **Added**: Rate limits on all endpoints, especially OSINT tools
- **Limits per endpoint**:
  - `/crawl`: 20 requests/minute
  - `/query`: 30 requests/minute
  - `/osint/portscan`: 5 requests/minute (most sensitive)
  - `/osint/dns`, `/osint/ipgeo`: 15 requests/minute
  - Other OSINT tools: 10 requests/minute
- **Impact**: Prevents abuse and protects against accidental loops

---

## ✅ 3. WEB CRAWLING - ROBOTS.TXT COMPLIANCE
**Files**: 
- `backend/modules/crawler.py`
- `backend/modules/legal_crawler.py`

### What changed:
- **Added**: `_can_crawl(url)` function that checks `robots.txt` before crawling
- **Impact**: 
  - Web crawler now respects website owners' crawling preferences
  - More legal and ethical web scraping
  - Reduces risk of Terms of Service violations

### Legal Crawler improvements:
- **Reduced crawl volumes**: 
  - From 1000 pages → 200 pages per source
  - Reduced depth: 4 → 2
- **Increased politeness**:
  - Delay between requests: 0.3s → 1.0s
  - Respects `robots.txt` files
- **Impact**: More respectful to government servers, less likely to trigger IP blocks

---

## ✅ 4. ANDROID SSL/TLS FIXED (CRITICAL)
**File**: `frontend/android/app/src/main/java/com/jarvis/intranet/OSINTPlugin.kt`

### Security issue fixed:
- **Before**: Used `TRUST_ALL` SSL trust manager
  - Accepted ANY certificate (including forged ones)
  - Vulnerable to man-in-the-middle attacks
- **After**: Uses default SSL context with proper validation
  - Validates all SSL certificates properly
  - Secure by default
- **Impact**: Android app is now secure against MITM attacks

---

## ✅ 5. DOCUMENTATION & LEGAL NOTICES

### New files:
- **`LICENSE`**: MIT License (clear legal rights)
- **`NOTICE.md`**: Trademark disclaimer for "JARVIS"
  - Explains the name is used for identification only
  - Not affiliated with Marvel/Disney
  - Protects you legally if distributing publicly

### Updated files:
- **`SECURITY.md`**: Now has real, actionable content
  - Supported versions
  - How to report vulnerabilities
  - Security best practices
  - Known limitations
  - Recommendations for safe usage

---

## 📋 OSINT TOOLS - IMPORTANT LEGAL NOTES

Your application includes powerful OSINT (Open Source Intelligence) tools:
- Port scanning
- DNS enumeration
- Subdomain enumeration
- SSL/TLS certificate analysis

### ⚠️ Legal reminder:
- **Port scanning** unauthorized systems may be **illegal** in many jurisdictions
- **DNS/subdomain enumeration** on systems you don't own could violate laws
- **Always ensure** you only use these tools on:
  - Your own infrastructure
  - Systems with explicit written permission
  - In testing/educational environments under controlled conditions

---

## 🔐 SECURITY BEST PRACTICES - WHAT YOU SHOULD DO

### If you deploy this beyond localhost:

1. **Always set an API key**:
   ```bash
   export JARVIS_API_KEY=$(openssl rand -base64 32)
   ```

2. **Use a firewall**: Don't expose port 8765 to the internet

3. **Use HTTPS/TLS**: Put behind a reverse proxy (nginx, Apache)

4. **Limit who can crawl**:
   - Set stricter rate limits if needed
   - Only allow specific IPs to access the API

5. **Monitor legal sources**:
   - Government websites sometimes change their ToS
   - Keep robots.txt compliance enabled

6. **Keep dependencies updated**:
   ```bash
   cd backend && pip install --upgrade -r requirements.txt
   cd frontend && npm update
   ```

---

## 📊 COMPLIANCE CHECKLIST

- ✅ Proper open-source license (MIT)
- ✅ Trademark disclaimers (NOTICE.md)
- ✅ Security policy (SECURITY.md)
- ✅ robots.txt compliance
- ✅ API authentication support
- ✅ Rate limiting
- ✅ Secure SSL/TLS (no TRUST_ALL)
- ✅ Local-only by default (127.0.0.1)
- ✅ Restricted CORS
- ✅ Crawl delays (respectful to servers)

---

## 🎯 NEXT STEPS

1. **Review all changes**: Read through this document
2. **Test locally**: Run `npm run dev` and verify everything works
3. **Set API key** (optional but recommended):
   ```bash
   set JARVIS_API_KEY=your-secret-key
   npm run dev
   ```
4. **Test rate limiting**: Try making rapid requests to `/osint/portscan`
5. **Build and deploy**: `npm run build`

---

## ⚖️ LEGAL STATUS NOW

Your application is now:
- ✅ **Licensed** (MIT - clear legal framework)
- ✅ **Compliant** (robots.txt, respectful crawling)
- ✅ **Secure** (authentication, rate limiting, proper SSL)
- ✅ **Documented** (security policy, trademark notices)
- ✅ **Ethical** (for personal/authorized use)

**Important**: This doesn't mean you can scan any system or crawl any website. Always ensure you have permission and follow applicable laws in your jurisdiction.

---

## ❓ QUESTIONS?

If you have concerns about specific use cases, consult with:
- Your local jurisdiction's cybersecurity laws
- Terms of Service of websites you crawl
- Network administrators before scanning production systems
- A lawyer if using for commercial purposes
