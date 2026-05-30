# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :x:                |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in JARVIS Intranet Assistant, please report it by:

1. **Email**: Send details to the project maintainer via GitHub
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature
3. **Do not** open a public issue if the vulnerability is sensitive

### What to include:
- Description of the vulnerability
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (if you have one)

### Response timeline:
- We aim to acknowledge vulnerability reports within 48 hours
- Security patches will be released as soon as possible
- Accepted vulnerabilities will be fixed before public disclosure

## Security Considerations

This project runs locally on your machine with the following security features:

- **Local-only binding**: Backend binds to `127.0.0.1` by default (not exposed to network)
- **API Authentication**: Optional API key support via `JARVIS_API_KEY` environment variable
- **Rate Limiting**: Built-in rate limiting on sensitive endpoints (OSINT tools, crawling)
- **CORS Restrictions**: CORS is restricted to localhost only
- **robots.txt Compliance**: Web crawler respects robots.txt files
- **SSL/TLS Validation**: Proper certificate validation (no TRUST_ALL)

## Security Best Practices

When using JARVIS Intranet Assistant:

1. **Only run against systems you own or have permission to scan**
   - OSINT tools (port scanning, DNS enumeration) should only be used on your own infrastructure
   - Unauthorized scanning may be illegal in your jurisdiction

2. **Protect your API key** (if configured)
   - Store `JARVIS_API_KEY` in environment variables, never in code
   - Rotate keys periodically

3. **Keep dependencies updated**
   - Regularly update Python packages and Node.js dependencies
   - Monitor for security advisories

4. **Review the code**
   - This is open-source software. Review the code before running it
   - Understand what the OSINT tools do before using them

5. **Network security**
   - Run behind a firewall if on a shared network
   - Do not expose the backend port to untrusted networks

## Known Limitations

- The application assumes it runs on a trusted machine
- No built-in encryption for locally stored data
- Web crawling should only target sites where you have permission to scrape
