# JARVIS API Key Setup Guide

## Overview

JARVIS now supports optional API key authentication. If no API key is configured, the system works as before (no authentication required).

## Option 1: Environment Variable (Recommended)

### Windows (Command Prompt)
```batch
set JARVIS_API_KEY=your-secret-key-here
npm run dev
```

### Windows (PowerShell)
```powershell
$env:JARVIS_API_KEY="your-secret-key-here"
npm run dev
```

### Linux / macOS
```bash
export JARVIS_API_KEY="your-secret-key-here"
npm run dev
```

## Option 2: API Key File

Create a file `backend/.api_key` with your API key:

```
your-secret-key-here
```

The backend will automatically read it on startup.

## Option 3: Generate a Secure Key

### Using OpenSSL (Linux/Mac)
```bash
openssl rand -base64 32
```

### Using PowerShell (Windows)
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## Using the API with Authentication

Once you set an API key, all requests to the API must include it:

### cURL Example
```bash
curl -X POST http://localhost:8765/query \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

### JavaScript/Fetch Example
```javascript
fetch('http://localhost:8765/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-secret-key-here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: 'test' })
})
.then(r => r.json())
.then(data => console.log(data))
```

### Python Example
```python
import requests

headers = {
    'Authorization': 'Bearer your-secret-key-here'
}

response = requests.post(
    'http://localhost:8765/query',
    json={'query': 'test'},
    headers=headers
)
print(response.json())
```

## Disabling Authentication

Simply don't set `JARVIS_API_KEY` environment variable and don't create a `.api_key` file. The API will work without authentication.

## Notes

- API key is not encrypted in the `.api_key` file - keep it safe!
- Never commit the `.api_key` file to version control
- For production, use a proper secrets management system
- The key is case-sensitive
- Rate limits are applied regardless of authentication status
