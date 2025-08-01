// Bavel Security Client
// Cliente de segurança para comunicação segura com o Cloudflare Worker

class BavelSecurityClient {
  constructor() {
    // URLs do Cloudflare Worker (atualize com sua URL real)
    this.endpoints = {
      production: 'https://bavel-security-proxy.workers.dev',
      development: 'https://bavel-security-proxy-development.bavel-security-proxy.workers.dev'
    };
    
    // API Keys (em produção, essas chaves devem ser diferentes)
    this.apiKeys = {
      production: 'bavel_prod_2024_a3b2c1d4e5f6',
      development: 'bavel_dev_2024_x9y8z7w6v5u4'
    };
    
    // HMAC Secret para assinatura de requests
    this.hmacSecret = '1f6e1f800901c2f58c9712f29a312d73b745f5bbf3e8ac2c53f484d36b3aff30';
    
    // Environment detection
    this.environment = this.detectEnvironment();
    this.baseUrl = this.endpoints[this.environment];
    this.apiKey = this.apiKeys[this.environment];
    
    console.log(`Bavel Security Client initialized for ${this.environment}`);
  }
  
  detectEnvironment() {
    // Detectar ambiente baseado na URL da extensão ou outras condições
    const extensionId = chrome.runtime.id;
    
    // IDs de produção vs desenvolvimento podem ser diferentes
    // Por enquanto, usar development como padrão
    return 'development'; // Altere para 'production' quando deployar
  }
  
  async createHMACSignature(timestamp, payload) {
    try {
      const message = timestamp + JSON.stringify(payload);
      const encoder = new TextEncoder();
      
      // Importar chave HMAC
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.hmacSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      // Criar assinatura
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(message)
      );
      
      // Converter para hex
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
        
    } catch (error) {
      console.error('HMAC signature creation failed:', error);
      throw new Error('Failed to create request signature');
    }
  }
  
  async makeSecureRequest(endpoint, payload) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    try {
      // Criar assinatura HMAC
      const signature = await this.createHMACSignature(timestamp, payload);
      
      // Headers de segurança
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Bavel-Extension/1.0.0',
        'X-Extension-Version': '1.0.0',
        'X-Bavel-API-Key': this.apiKey,
        'X-Bavel-Signature': signature,
        'X-Bavel-Timestamp': timestamp
      };
      
      console.log('Making secure request to:', `${this.baseUrl}${endpoint}`);
      console.log('Request headers:', { ...headers, 'X-Bavel-API-Key': '***', 'X-Bavel-Signature': '***' });
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      
      console.log('Response status:', response.status, response.statusText);
      
      // Headers de rate limiting
      const rateLimitIP = response.headers.get('X-Rate-Limit-Remaining-IP');
      const rateLimitKey = response.headers.get('X-Rate-Limit-Remaining-Key');
      
      if (rateLimitIP || rateLimitKey) {
        console.log('Rate limit status:', { 
          remainingIP: rateLimitIP, 
          remainingKey: rateLimitKey 
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
        }
        
        if (response.status === 401) {
          throw new Error('Authentication failed - check API key');
        }
        
        if (response.status === 403) {
          throw new Error('Insufficient permissions for this action');
        }
        
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('API Response received:', result.success ? 'Success' : 'Failed');
      
      return result;
      
    } catch (error) {
      console.error('Secure request failed:', error);
      throw error;
    }
  }
  
  async analyzeText(data) {
    const payload = {
      action: 'analyze',
      selectedText: data.selectedText,
      userLanguage: data.userLanguage,
      pageContext: data.pageContext || {},
      preferences: {
        responseStyle: 'helpful',
        responseLength: 'medium',
        includeExamples: true,
        tone: 'constructive'
      }
    };
    
    return await this.makeSecureRequest('/analyze', payload);
  }
  
  async translateText(data) {
    const payload = {
      action: 'translate',
      selectedText: data.selectedText,
      userLanguage: data.userLanguage,
      sourceLanguage: data.sourceLanguage || 'auto',
      context: data.context || ''
    };
    
    return await this.makeSecureRequest('/translate', payload);
  }
  
  // Método para testar conectividade
  async testConnection() {
    try {
      const testPayload = {
        action: 'analyze',
        selectedText: 'Hello world',
        userLanguage: 'pt'
      };
      
      const result = await this.makeSecureRequest('/test', testPayload);
      return { success: true, result };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Método para verificar status de rate limiting
  async checkRateLimitStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: {
          'X-Bavel-API-Key': this.apiKey
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      return { available: false };
      
    } catch (error) {
      console.error('Rate limit status check failed:', error);
      return { available: false, error: error.message };
    }
  }
  
  // Retry com backoff exponencial
  async makeRequestWithRetry(endpoint, payload, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeSecureRequest(endpoint, payload);
        
      } catch (error) {
        lastError = error;
        
        // Não fazer retry para erros de autenticação ou permissão
        if (error.message.includes('Authentication failed') || 
            error.message.includes('Insufficient permissions')) {
          throw error;
        }
        
        // Para rate limiting, esperar mais tempo
        if (error.message.includes('Rate limit exceeded')) {
          const waitTime = Math.pow(2, attempt) * 1000; // Backoff exponencial
          console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Para outros erros, retry com backoff
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          console.log(`Request failed, retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  }
}

// Validação de configuração
function validateSecurityConfig() {
  const client = new BavelSecurityClient();
  
  const issues = [];
  
  if (client.hmacSecret === 'your-shared-hmac-secret-key-here') {
    issues.push('HMAC secret key not configured');
  }
  
  if (client.baseUrl.includes('your-subdomain')) {
    issues.push('Cloudflare Worker URL not configured');
  }
  
  if (client.apiKey.includes('your-api-key')) {
    issues.push('API key not configured');
  }
  
  if (issues.length > 0) {
    console.warn('Security configuration issues:', issues);
    return { valid: false, issues };
  }
  
  return { valid: true };
}

// Export para uso global
if (typeof window !== 'undefined') {
  window.BavelSecurityClient = BavelSecurityClient;
  window.validateSecurityConfig = validateSecurityConfig;
}