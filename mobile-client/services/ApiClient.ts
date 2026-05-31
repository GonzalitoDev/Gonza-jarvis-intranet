import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClientService {
  private instance: AxiosInstance;
  private apiKey: string | null = null;
  private baseURL: string;

  constructor(baseURL: string = 'http://127.0.0.1:8765') {
    this.baseURL = baseURL;
    this.instance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para agregar autorización
    this.instance.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers.Authorization = `Bearer ${this.apiKey}`;
      }
      return config;
    });
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  setBaseURL(url: string) {
    this.baseURL = url;
    this.instance = axios.create({
      baseURL: url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async health(): Promise<boolean> {
    try {
      const response = await this.instance.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // OSINT Tools
  async dnsMockup(domain: string, recordType: string = 'A'): Promise<ApiResponse<any>> {
    return this.instance.post('/osint/dns', { domain, type: recordType });
  }

  async whoisLookup(domain: string): Promise<ApiResponse<any>> {
    return this.instance.post('/osint/whois', { domain });
  }

  async ipGeolocation(ip: string): Promise<ApiResponse<any>> {
    return this.instance.post('/osint/ipgeo', { ip });
  }

  async portScan(target: string, ports?: number[]): Promise<ApiResponse<any>> {
    return this.instance.post('/osint/portscan', { target, ports });
  }

  async sslCheck(hostname: string, port: number = 443): Promise<ApiResponse<any>> {
    return this.instance.post('/osint/ssl', { hostname, port });
  }

  async httpHeaders(url: string): Promise<ApiResponse<any>> {
    return this.instance.post('/osint/headers', { url });
  }

  async subdomainEnum(domain: string): Promise<ApiResponse<any>> {
    return this.instance.post('/osint/subdomains', { domain });
  }

  async emailBreachCheck(email: string): Promise<ApiResponse<any>> {
    return this.instance.post('/osint/email', { email });
  }

  // Search
  async search(query: string): Promise<ApiResponse<any>> {
    return this.instance.post('/query', { query });
  }

  // Pages
  async getPages(): Promise<ApiResponse<any>> {
    return this.instance.get('/pages');
  }

  // Crawl
  async crawlUrl(url: string): Promise<ApiResponse<any>> {
    return this.instance.post('/crawl', { url });
  }

  // Legal Crawling
  async requestLegalCrawlConsent(): Promise<ApiResponse<any>> {
    return this.instance.post('/crawl/legal/consent');
  }

  async startLegalCrawl(): Promise<ApiResponse<any>> {
    return this.instance.post('/crawl/legal/start');
  }

  async stopLegalCrawl(): Promise<ApiResponse<any>> {
    return this.instance.post('/crawl/legal/stop');
  }

  async getLegalCrawlStatus(): Promise<ApiResponse<any>> {
    return this.instance.get('/crawl/legal/status');
  }

  // Commands
  async executeCommand(command: string): Promise<ApiResponse<any>> {
    return this.instance.post('/command', { command });
  }
}

export const ApiClient = new ApiClientService();
