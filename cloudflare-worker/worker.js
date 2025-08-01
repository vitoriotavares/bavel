// Bavel Security Proxy - Cloudflare Worker
// Camada de segurança entre a extensão Chrome e o N8N

// Configurações de segurança
const SECURITY_CONFIG = {
  maxRequestSize: 50000, // 50KB max
  rateLimits: {
    ip: { requests: 50, window: 900 }, // 50 req/15min por IP
    apiKey: { requests: 100, window: 900 }, // 100 req/15min por API Key
    global: { requests: 1000, window: 900 } // 1000 req/15min global
  },
  allowedOrigins: [
    'chrome-extension://*',
    'moz-extension://*'
  ],
  ddosThresholds: {
    requestsPerSecond: 2,
    burstRequests: 10,
    windowSize: 60
  }
};

// API Keys válidas (em produção, usar KV storage)
const VALID_API_KEYS = new Map([
  ['bavel_prod_2024_a3b2c1d4e5f6', { 
    name: 'Bavel Extension Prod', 
    rateLimit: 100,
    permissions: ['analyze', 'translate']
  }],
  ['bavel_dev_2024_x9y8z7w6v5u4', { 
    name: 'Bavel Extension Dev', 
    rateLimit: 50,
    permissions: ['analyze', 'translate']
  }]
]);

class SecurityManager {
  // Validação de API Key
  static validateApiKey(request) {
    const apiKey = request.headers.get('X-Bavel-API-Key');
    
    if (!apiKey) {
      return { 
        valid: false, 
        error: 'Missing API key',
        status: 401
      };
    }
    
    const keyInfo = VALID_API_KEYS.get(apiKey);
    if (!keyInfo) {
      return { 
        valid: false, 
        error: 'Invalid API key',
        status: 401
      };
    }
    
    return { 
      valid: true, 
      keyInfo 
    };
  }
  
  // Validação de assinatura HMAC
  static async validateSignature(request, body, env) {
    const signature = request.headers.get('X-Bavel-Signature');
    const timestamp = request.headers.get('X-Bavel-Timestamp');
    
    if (!signature || !timestamp) {
      return { valid: false, error: 'Missing signature or timestamp' };
    }
    
    // Verificar timestamp (máximo 5 minutos)
    const now = Math.floor(Date.now() / 1000);
    const reqTime = parseInt(timestamp);
    
    if (Math.abs(now - reqTime) > 300) {
      return { valid: false, error: 'Request timestamp expired' };
    }
    
    try {
      // Verificar assinatura HMAC
      const secret = env.BAVEL_HMAC_SECRET;
      const payload = timestamp + JSON.stringify(body);
      
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const expectedSignature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payload)
      );
      
      const expectedHex = Array.from(new Uint8Array(expectedSignature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      if (signature !== expectedHex) {
        return { valid: false, error: 'Invalid signature' };
      }
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: 'Signature validation failed' };
    }
  }
  
  // Sanitização de entrada
  static sanitizeInput(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid request body');
    }
    
    const sanitized = { ...data };
    
    // Limites de tamanho
    const limits = {
      selectedText: 5000,
      userLanguage: 10,
      action: 20
    };
    
    // Aplicar limites
    Object.entries(limits).forEach(([field, limit]) => {
      if (sanitized[field] && typeof sanitized[field] === 'string') {
        sanitized[field] = sanitized[field].substring(0, limit);
      }
    });
    
    // Sanitizar pageContext se existir
    if (sanitized.pageContext) {
      const contextLimits = {
        title: 200,
        url: 2048,
        mainContent: 10000,
        description: 500
      };
      
      Object.entries(contextLimits).forEach(([field, limit]) => {
        if (sanitized.pageContext[field] && typeof sanitized.pageContext[field] === 'string') {
          sanitized.pageContext[field] = sanitized.pageContext[field].substring(0, limit);
        }
      });
    }
    
    // Remover scripts e HTML perigoso
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^>]*>/gi
    ];
    
    function cleanString(str) {
      if (typeof str !== 'string') return str;
      return dangerousPatterns.reduce((clean, pattern) => 
        clean.replace(pattern, '[removed]'), str
      );
    }
    
    function deepClean(obj) {
      if (typeof obj === 'string') return cleanString(obj);
      if (Array.isArray(obj)) return obj.map(deepClean);
      if (obj && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [k, deepClean(v)])
        );
      }
      return obj;
    }
    
    return deepClean(sanitized);
  }
}

class RateLimiter {
  constructor(env) {
    this.env = env;
    this.kv = env.RATE_LIMIT_KV;
  }
  
  async checkRateLimit(type, identifier) {
    const key = `rate_limit:${type}:${identifier}`;
    const limit = SECURITY_CONFIG.rateLimits[type];
    
    if (!limit) {
      throw new Error(`Unknown rate limit type: ${type}`);
    }
    
    try {
      const current = await this.kv.get(key);
      const now = Math.floor(Date.now() / 1000);
      
      if (!current) {
        await this.kv.put(key, JSON.stringify({
          count: 1,
          resetTime: now + limit.window
        }), { expirationTtl: limit.window });
        
        return { 
          allowed: true, 
          remaining: limit.requests - 1,
          resetTime: now + limit.window
        };
      }
      
      const data = JSON.parse(current);
      
      // Reset se janela expirou
      if (now > data.resetTime) {
        await this.kv.put(key, JSON.stringify({
          count: 1,
          resetTime: now + limit.window
        }), { expirationTtl: limit.window });
        
        return { 
          allowed: true, 
          remaining: limit.requests - 1,
          resetTime: now + limit.window
        };
      }
      
      // Verificar se excedeu limite
      if (data.count >= limit.requests) {
        return { 
          allowed: false, 
          remaining: 0, 
          resetTime: data.resetTime 
        };
      }
      
      // Incrementar contador
      data.count++;
      await this.kv.put(key, JSON.stringify(data), { 
        expirationTtl: data.resetTime - now 
      });
      
      return { 
        allowed: true, 
        remaining: limit.requests - data.count,
        resetTime: data.resetTime
      };
      
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Em caso de erro, permitir (fail-open para disponibilidade)
      return { allowed: true, remaining: 999 };
    }
  }
}

class DDoSProtection {
  constructor(env) {
    this.env = env;
    this.kv = env.SECURITY_KV;
  }
  
  async detectDDoSPattern(clientIP) {
    const key = `ddos_pattern:${clientIP}`;
    const config = SECURITY_CONFIG.ddosThresholds;
    const now = Math.floor(Date.now() / 1000);
    
    try {
      const pattern = await this.kv.get(key);
      const requests = pattern ? JSON.parse(pattern) : [];
      
      // Filtrar requests recentes
      const recentRequests = requests.filter(t => now - t < config.windowSize);
      recentRequests.push(now);
      
      // Salvar padrão atualizado
      await this.kv.put(key, JSON.stringify(recentRequests.slice(-100)), {
        expirationTtl: config.windowSize * 2
      });
      
      // Calcular métricas
      const requestsPerSecond = recentRequests.length / config.windowSize;
      const burstRequests = recentRequests.filter(t => now - t < 5).length;
      
      const isDDoS = requestsPerSecond > config.requestsPerSecond || 
                     burstRequests > config.burstRequests;
      
      return {
        isDDoS,
        requestsPerSecond,
        burstRequests,
        totalRequests: recentRequests.length
      };
      
    } catch (error) {
      console.error('DDoS detection failed:', error);
      return { isDDoS: false };
    }
  }
}

class SecurityLogger {
  static async logEvent(event, env) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: event.type,
      severity: event.severity || 'LOW',
      clientIP: event.clientIP,
      userAgent: event.userAgent,
      apiKey: event.apiKey ? event.apiKey.substring(0, 12) + '***' : null,
      details: event.details || {},
      blocked: event.blocked || false
    };
    
    // Log para console (Cloudflare Analytics)
    console.log('SECURITY_EVENT:', JSON.stringify(logEntry));
    
    // Salvar evento crítico
    if (event.severity === 'HIGH') {
      try {
        await env.SECURITY_KV.put(
          `security_event:${Date.now()}:${Math.random()}`,
          JSON.stringify(logEntry),
          { expirationTtl: 86400 * 30 } // 30 dias
        );
        
        // Enviar alerta se configurado
        if (env.SECURITY_WEBHOOK_URL) {
          await SecurityLogger.sendAlert(logEntry, env);
        }
      } catch (error) {
        console.error('Failed to log security event:', error);
      }
    }
  }
  
  static async sendAlert(logEntry, env) {
    try {
      await fetch(env.SECURITY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: 'High severity security event detected',
          service: 'Bavel Security Proxy',
          details: logEntry
        })
      });
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }
}

function addSecurityHeaders(response) {
  const headers = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'X-Robots-Tag': 'noindex, nofollow'
  };
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

function setCORSHeaders(response, origin) {
  const isValidOrigin = SECURITY_CONFIG.allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace('*', '.*');
      return new RegExp(pattern).test(origin || '');
    }
    return allowed === origin;
  });
  
  if (isValidOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 
      'Content-Type, X-Bavel-API-Key, X-Bavel-Signature, X-Bavel-Timestamp, User-Agent'
    );
    response.headers.set('Access-Control-Max-Age', '3600');
    response.headers.set('Vary', 'Origin');
  }
  
  return response;
}

function handleCORS() {
  const response = new Response(null, { status: 204 });
  return addSecurityHeaders(setCORSHeaders(response, '*'));
}

async function handleRequest(request, env, ctx) {
  const startTime = Date.now();
  const clientIP = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const userAgent = request.headers.get('User-Agent') || 'Unknown';
  const origin = request.headers.get('Origin');
  
  try {
    // 1. Verificar método HTTP
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }
    
    if (request.method !== 'POST') {
      await SecurityLogger.logEvent({
        type: 'INVALID_METHOD',
        severity: 'LOW',
        clientIP,
        userAgent,
        details: { method: request.method },
        blocked: true
      }, env);
      
      return new Response('Method not allowed', { status: 405 });
    }
    
    // 2. Verificar tamanho da requisição
    const contentLength = parseInt(request.headers.get('Content-Length') || '0');
    if (contentLength > SECURITY_CONFIG.maxRequestSize) {
      await SecurityLogger.logEvent({
        type: 'REQUEST_TOO_LARGE',
        severity: 'MEDIUM',
        clientIP,
        userAgent,
        details: { contentLength },
        blocked: true
      }, env);
      
      return new Response('Request too large', { status: 413 });
    }
    
    // 3. Detectar DDoS
    const ddosProtection = new DDoSProtection(env);
    const ddosCheck = await ddosProtection.detectDDoSPattern(clientIP);
    
    if (ddosCheck.isDDoS) {
      await SecurityLogger.logEvent({
        type: 'DDOS_DETECTED',
        severity: 'HIGH',
        clientIP,
        userAgent,
        details: ddosCheck,
        blocked: true
      }, env);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Too many requests detected'
      }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 4. Validar API Key
    const apiKeyValidation = SecurityManager.validateApiKey(request);
    if (!apiKeyValidation.valid) {
      await SecurityLogger.logEvent({
        type: 'INVALID_API_KEY',
        severity: 'HIGH',
        clientIP,
        userAgent,
        details: { error: apiKeyValidation.error },
        blocked: true
      }, env);
      
      return new Response(JSON.stringify({
        success: false,
        error: apiKeyValidation.error
      }), { 
        status: apiKeyValidation.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const apiKey = request.headers.get('X-Bavel-API-Key');
    const keyInfo = apiKeyValidation.keyInfo;
    
    // 5. Rate Limiting
    const rateLimiter = new RateLimiter(env);
    const [ipLimit, keyLimit] = await Promise.all([
      rateLimiter.checkRateLimit('ip', clientIP),
      rateLimiter.checkRateLimit('apiKey', apiKey)
    ]);
    
    if (!ipLimit.allowed || !keyLimit.allowed) {
      await SecurityLogger.logEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        clientIP,
        userAgent,
        apiKey,
        details: { ipLimit, keyLimit },
        blocked: true
      }, env);
      
      const response = new Response(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.max(ipLimit.resetTime || 0, keyLimit.resetTime || 0)
      }), { 
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((Math.max(ipLimit.resetTime || 0, keyLimit.resetTime || 0) - Date.now()/1000))
        }
      });
      
      return addSecurityHeaders(setCORSHeaders(response, origin));
    }
    
    // 6. Processar request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 7. Validar assinatura HMAC
    const signatureValidation = await SecurityManager.validateSignature(request, body, env);
    if (!signatureValidation.valid) {
      await SecurityLogger.logEvent({
        type: 'INVALID_SIGNATURE',
        severity: 'HIGH',
        clientIP,
        userAgent,
        apiKey,
        details: { error: signatureValidation.error },
        blocked: true
      }, env);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request signature'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 8. Sanitizar entrada
    let sanitizedBody;
    try {
      sanitizedBody = SecurityManager.sanitizeInput(body);
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request data'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 9. Validar permissões - detectar ação do URL e body
    const urlPath = new URL(request.url).pathname;
    let action;
    
    if (urlPath.includes('/translate')) {
      action = 'translate';
    } else if (urlPath.includes('/analyze')) {
      action = 'analyze';
    } else {
      // Fallback para o body
      action = sanitizedBody.action || 'analyze';
    }
    
    console.log(`Action detected: ${action} (from URL: ${urlPath})`);
    if (!keyInfo.permissions.includes(action)) {
      await SecurityLogger.logEvent({
        type: 'INSUFFICIENT_PERMISSIONS',
        severity: 'MEDIUM',
        clientIP,
        userAgent,
        apiKey,
        details: { action, permissions: keyInfo.permissions },
        blocked: true
      }, env);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Insufficient permissions'
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 10. Encaminhar para N8N baseado na ação
    // Reutilizar a variável action já declarada anteriormente
    let n8nUrl;
    
    if (action === 'translate') {
      n8nUrl = env.N8N_TRANSLATE_URL;
    } else {
      n8nUrl = env.N8N_ANALYZE_URL;
    }
    
    if (!n8nUrl) {
      throw new Error(`N8N webhook URL not configured for action: ${action}`);
    }
    
    console.log(`Routing to N8N: ${action} -> ${n8nUrl}`);
    
    const n8nResponse = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': clientIP,
        'X-Real-IP': clientIP,
        'X-Extension-Version': request.headers.get('X-Extension-Version') || '1.0.0',
        'User-Agent': 'Bavel-Security-Proxy/1.0.0'
      },
      body: JSON.stringify(sanitizedBody),
      timeout: 30000 // 30 segundos timeout
    });
    
    if (!n8nResponse.ok) {
      await SecurityLogger.logEvent({
        type: 'N8N_ERROR',
        severity: 'MEDIUM',
        clientIP,
        userAgent,
        apiKey,
        details: { 
          status: n8nResponse.status,
          statusText: n8nResponse.statusText
        }
      }, env);
    }
    
    const result = await n8nResponse.json();
    
    // 11. Criar resposta com headers de segurança
    let response = new Response(JSON.stringify(result), {
      status: n8nResponse.status,
      headers: { 
        'Content-Type': 'application/json',
        'X-Rate-Limit-Remaining-IP': ipLimit.remaining.toString(),
        'X-Rate-Limit-Remaining-Key': keyLimit.remaining.toString()
      }
    });
    
    response = addSecurityHeaders(response);
    response = setCORSHeaders(response, origin);
    
    // 12. Log de sucesso
    const duration = Date.now() - startTime;
    await SecurityLogger.logEvent({
      type: 'REQUEST_SUCCESS',
      severity: 'LOW',
      clientIP,
      userAgent,
      apiKey,
      details: { 
        duration,
        action,
        responseStatus: n8nResponse.status
      }
    }, env);
    
    return response;
    
  } catch (error) {
    // Log de erro
    await SecurityLogger.logEvent({
      type: 'WORKER_ERROR',
      severity: 'HIGH',
      clientIP,
      userAgent,
      details: { 
        error: error.message,
        stack: error.stack?.substring(0, 500)
      }
    }, env);
    
    const response = new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    
    return addSecurityHeaders(setCORSHeaders(response, origin));
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};