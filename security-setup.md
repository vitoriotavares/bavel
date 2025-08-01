# 🔐 Setup de Segurança - Bavel Extension

Este guia explica como configurar a camada de segurança Cloudflare para a extensão Bavel.

## 📋 Pré-requisitos

1. **Conta Cloudflare** com acesso aos Workers
2. **CLI Wrangler** instalado (`npm install -g wrangler`)
3. **Conta N8N** configurada
4. **Node.js** versão 18+

## 🚀 1. Deploy do Cloudflare Worker

### 1.1 Configurar Wrangler
```bash
# Login no Cloudflare
wrangler login

# Verificar autenticação
wrangler whoami
```

### 1.2 Criar KV Namespaces
```bash
cd cloudflare-worker

# Criar namespaces para produção
wrangler kv namespace create "RATE_LIMIT_KV" --env production
wrangler kv namespace create "SECURITY_KV" --env production
wrangler kv namespace create "METRICS_KV" --env production

# Criar namespaces para desenvolvimento
wrangler kv namespace create "RATE_LIMIT_KV" --env development
wrangler kv namespace create "SECURITY_KV" --env development
wrangler kv namespace create "METRICS_KV" --env development
```

### 1.3 Atualizar wrangler.toml
Copie os IDs retornados pelos comandos acima e atualize o arquivo `wrangler.toml`:

```toml
# Exemplo de saída do comando:
# 🌀 Creating namespace with title "bavel-security-proxy-RATE_LIMIT_KV"
# ✨ Success! Created KV namespace with id "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

# Substitua os IDs pelos valores reais retornados pelos comandos
[[env.production.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"  # Cole o ID real aqui

[[env.production.kv_namespaces]]
binding = "SECURITY_KV" 
id = "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7"  # Cole o ID real aqui

[[env.production.kv_namespaces]]
binding = "METRICS_KV"
id = "c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8"  # Cole o ID real aqui

# Faça o mesmo para o ambiente de desenvolvimento
[[env.development.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9"  # ID do namespace de dev

[[env.development.kv_namespaces]]
binding = "SECURITY_KV"
id = "e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"  # ID do namespace de dev

[[env.development.kv_namespaces]]
binding = "METRICS_KV"
id = "f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1"  # ID do namespace de dev
```

### 1.4 Configurar Secrets
```bash
# Gerar chave HMAC segura (use este comando ou gere sua própria)
openssl rand -hex 32

# Configurar secret para produção
wrangler secret put BAVEL_HMAC_SECRET --env production
# Cole a chave HMAC quando solicitado

# Configurar secret para desenvolvimento  
wrangler secret put BAVEL_HMAC_SECRET --env development
# Use a mesma chave ou uma diferente para desenvolvimento
```

### 1.5 Atualizar URLs no wrangler.toml
```toml
[env.production]
vars = { 
  N8N_WEBHOOK_URL = "https://SEU_N8N_SERVIDOR.com/webhook/bavel/analyze",
  SECURITY_WEBHOOK_URL = "https://SEU_WEBHOOK_ALERTAS.com/webhook"
}

[env.development]
vars = {
  N8N_WEBHOOK_URL = "https://SEU_N8N_DEV.com/webhook/bavel/analyze",
  SECURITY_WEBHOOK_URL = ""
}
```

### 1.6 Deploy do Worker
```bash
# Deploy para produção
wrangler deploy --env production

# Deploy para desenvolvimento
wrangler deploy --env development

# Verificar deploy
wrangler tail --env production
```

## 🔧 2. Configurar a Extensão Chrome

### 2.1 Atualizar Security Client
Edite o arquivo `bavel/src/security/security-client.js`:

```javascript
constructor() {
  // Substitua pelas suas URLs reais do Cloudflare Worker
  this.endpoints = {
    production: 'https://bavel-security-proxy.SEU_SUBDOMAIN.workers.dev',
    development: 'https://bavel-security-proxy-dev.SEU_SUBDOMAIN.workers.dev'
  };
  
  // API Keys configuradas no Worker
  this.apiKeys = {
    production: 'bavel_prod_2024_a3b2c1d4e5f6',
    development: 'bavel_dev_2024_x9y8z7w6v5u4'
  };
  
  // Use a mesma chave HMAC configurada no Worker
  this.hmacSecret = 'SUA_CHAVE_HMAC_AQUI';
  
  // Altere para 'production' quando deployar
  this.environment = 'development';
}
```

### 2.2 Testar Configuração
Carregue a extensão no Chrome e abra o console:

```javascript
// Console do background script
const client = new BavelSecurityClient();
client.testConnection().then(result => {
  console.log('Connection test:', result);
});
```

## 🛡️ 3. Configurações de Segurança

### 3.1 Configurar Rate Limiting
O Worker está configurado com os seguintes limites padrão:

```javascript
rateLimits: {
  ip: { requests: 50, window: 900 },     // 50 req/15min por IP
  apiKey: { requests: 100, window: 900 }, // 100 req/15min por API Key
  global: { requests: 1000, window: 900 } // 1000 req/15min global
}
```

Para ajustar os limites, edite `worker.js` e faça redeploy.

### 3.2 Configurar DDoS Protection
O sistema detecta automaticamente padrões de DDoS:

```javascript
ddosThresholds: {
  requestsPerSecond: 2,    // Máximo 2 req/segundo
  burstRequests: 10,       // Máximo 10 requests em 5 segundos
  windowSize: 60           // Janela de análise de 60 segundos
}
```

### 3.3 Configurar Alertas de Segurança
Para receber alertas de eventos de segurança críticos:

1. Configure um webhook (Discord, Slack, email, etc.)
2. Atualize `SECURITY_WEBHOOK_URL` no `wrangler.toml`
3. Redeploy o Worker

## 📊 4. Monitoramento

### 4.1 Logs do Cloudflare
```bash
# Ver logs em tempo real
wrangler tail --env production

# Filtrar apenas eventos de segurança
wrangler tail --env production | grep SECURITY_EVENT
```

### 4.2 Analytics
O Worker registra automaticamente:
- **Rate limiting**: Requests bloqueados por limite
- **DDoS**: Tentativas de ataque detectadas
- **Autenticação**: Falhas de API key ou assinatura
- **Performance**: Tempo de resposta e erros

### 4.3 Dashboard Cloudflare
Acesse o dashboard Cloudflare > Workers > Seu Worker para ver:
- Número de requests
- Latência média
- Taxa de erro
- Uso de recursos

## 🔍 5. Troubleshooting

### 5.1 Problemas Comuns

**Erro 401 (Unauthorized)**
- Verifique se a API key está correta
- Confirme se a chave HMAC é a mesma no Worker e na extensão
- Verifique se os timestamps estão sincronizados

**Erro 429 (Rate Limited)**
- Reduza a frequência das requisições
- Verifique se não há loops infinitos
- Monitore o uso no dashboard

**Erro 500 (Internal Server Error)**
- Verifique os logs do Worker: `wrangler tail`
- Confirme se o N8N está respondendo
- Verifique se os KV namespaces estão configurados

### 5.2 Comandos Úteis do Wrangler
```bash
# Ver todos os namespaces KV
wrangler kv namespace list

# Ver dados em um namespace específico
wrangler kv key list --binding RATE_LIMIT_KV --env production

# Inserir dados de teste
wrangler kv key put "test-key" "test-value" --binding RATE_LIMIT_KV --env production

# Ver logs em tempo real
wrangler tail --env production

# Ver informações do Worker
wrangler deployments list --env production
```

### 5.3 Debug da Extensão
```javascript
// Console do background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Debug - Message received:', message);
  // Seu código aqui
});

// Testar cliente de segurança
const client = new BavelSecurityClient();
console.log('Security client config:', {
  environment: client.environment,
  baseUrl: client.baseUrl,
  hasApiKey: !!client.apiKey,
  hasHmacSecret: !!client.hmacSecret
});
```

### 5.4 Validar Configuração
```javascript
// Executar no console da extensão
validateSecurityConfig();

// Testar conectividade completa
const client = new BavelSecurityClient();
client.testConnection().then(result => {
  console.log('Connection test result:', result);
  if (result.success) {
    console.log('✅ Security layer is working correctly!');
  } else {
    console.error('❌ Security layer failed:', result.error);
  }
});
```

## 🔄 6. Atualizações e Manutenção

### 6.1 Rotação de Chaves
```bash
# Gerar nova chave HMAC
openssl rand -hex 32

# Atualizar secret no Cloudflare
wrangler secret put BAVEL_HMAC_SECRET --env production

# Atualizar extensão com nova chave
# Redeploy Worker e extensão
```

### 6.2 Monitoring de Segurança
- **Diário**: Verificar logs de ataques
- **Semanal**: Analisar padrões de uso
- **Mensal**: Revisar configurações de rate limiting
- **Trimestral**: Rotacionar chaves de API

## 📈 7. Otimizações de Performance

### 7.1 Cache Headers
O Worker já está configurado com headers apropriados de cache.

### 7.2 Geolocation
Configure o Worker para rodar nas regiões mais próximas dos seus usuários.

### 7.3 Timeout Configuration
Ajuste os timeouts baseado na performance do seu N8N:

```javascript
// Em worker.js
const n8nResponse = await fetch(n8nUrl, {
  // ...
  timeout: 30000 // 30 segundos
});
```

## ✅ Checklist Final

- [ ] Cloudflare Worker deployado com sucesso
- [ ] KV Namespaces criados e configurados
- [ ] Secrets HMAC configurados
- [ ] URLs atualizadas na extensão
- [ ] Teste de conectividade passou
- [ ] Rate limiting funcionando
- [ ] Logs de segurança aparecendo
- [ ] Alertas configurados (opcional)
- [ ] Documentação atualizada

## 🆘 Suporte

Para suporte:
1. Verifique os logs do Worker
2. Teste a conectividade
3. Valide a configuração de segurança
4. Consulte a documentação do Cloudflare Workers

---

**Importante**: Mantenha suas chaves HMAC e API keys seguras. Nunca as exponha em código público ou logs.