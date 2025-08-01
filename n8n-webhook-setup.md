# 🔗 Configuração dos Webhooks N8N para Bavel

Este guia explica como configurar os 2 webhooks necessários no N8N para receber as requisições do Cloudflare Worker.

## 📋 Webhooks Necessários

1. **`/webhook/bavel/analyze`** - Análise de texto e geração de sugestões
2. **`/webhook/bavel/translate`** - Tradução de texto com alternativas

## 🚀 1. Webhook de Análise (`/bavel/analyze`)

### 1.1 Criar Workflow de Análise

1. **Crie novo workflow** no N8N
2. **Adicione os seguintes nodes:**

#### Node 1: Webhook (Trigger)
```
Configurações:
- HTTP Method: POST
- Path: /webhook/bavel/analyze
- Response Mode: Wait for Response
- Response Headers: {"Content-Type": "application/json"}
```

#### Node 2: Function - Validation & Processing
```javascript
// Validar parâmetros obrigatórios
const requiredFields = ['selectedText', 'userLanguage'];
const missingFields = requiredFields.filter(field => !$json[field]);

if (missingFields.length > 0) {
  return [{
    json: {
      success: false,
      error: `Missing required fields: ${missingFields.join(', ')}`
    }
  }];
}

// Processar dados de entrada
const {
  selectedText,
  userLanguage,
  pageContext = {},
  preferences = {}
} = $json;

// Detectar idioma do texto
function detectLanguage(text) {
  const patterns = {
    'en': /\b(the|and|or|but|in|on|at|to|for|of|with|by|this|that|is|are|was|were)\b/gi,
    'es': /\b(el|la|y|o|pero|en|de|con|por|para|que|es|son|fue|fueron)\b/gi,
    'fr': /\b(le|la|et|ou|mais|dans|de|avec|pour|que|est|sont|était|étaient)\b/gi,
    'pt': /\b(o|a|e|ou|mas|em|de|com|para|por|que|é|são|foi|foram)\b/gi,
    'de': /\b(der|die|das|und|oder|aber|in|auf|mit|für|ist|sind|war|waren)\b/gi,
    'it': /\b(il|la|e|o|ma|in|di|con|per|che|è|sono|era|erano)\b/gi
  };
  
  let maxMatches = 0;
  let detectedLang = 'en';
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    const matches = (text.match(pattern) || []).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedLang = lang;
    }
  }
  
  return detectedLang;
}

const detectedLanguage = detectLanguage(selectedText);

// Preparar prompt para IA
const siteContext = pageContext.siteType ? ` em ${pageContext.siteType}` : '';
const pageTitle = pageContext.title ? `\nTítulo da página: "${pageContext.title}"` : '';

const prompt = `Você é um assistente especializado em ajudar pessoas a praticar idiomas através de respostas contextuais.

CONTEXTO DA PÁGINA:${siteContext}${pageTitle}
URL: ${pageContext.url || 'N/A'}

TEXTO SELECIONADO:
"${selectedText}"

IDIOMA DO USUÁRIO: ${userLanguage}
IDIOMA DETECTADO: ${detectedLanguage}

TAREFA:
1. Traduza o texto selecionado para ${userLanguage}
2. Forneça contexto sobre o que está sendo discutido
3. Sugira 3-5 respostas apropriadas no idioma original (${detectedLanguage})
4. As respostas devem ser educadas, construtivas e adequadas ao contexto

FORMATO DE RESPOSTA (JSON válido):
{
  "translation": "tradução do texto aqui",
  "context": "explicação detalhada do contexto",
  "suggestions": [
    "Primeira sugestão de resposta",
    "Segunda sugestão de resposta", 
    "Terceira sugestão de resposta"
  ]
}`;

return [{
  json: {
    selectedText,
    userLanguage,
    detectedLanguage,
    pageContext,
    prompt,
    processedAt: new Date().toISOString()
  }
}];
```

#### Node 3: OpenAI/Claude (IA Processing)
```
Configurações:
- Model: gpt-4 ou gpt-3.5-turbo
- System Message: "Você é um assistente especializado em tradução contextual e sugestões de resposta para prática de idiomas."
- User Message: {{ $json.prompt }}
- Temperature: 0.3
- Max Tokens: 1000
```

#### Node 4: Function - Response Processing
```javascript
// Processar resposta da IA
const aiResponse = $json.choices?.[0]?.message?.content || $json.response || '';

console.log('AI Response:', aiResponse);

try {
  // Tentar parsear JSON da resposta
  let parsedResponse;
  
  // Limpar resposta se necessário
  const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    parsedResponse = JSON.parse(cleanResponse);
  } catch (e) {
    // Se falhou, tentar extrair manualmente
    const translationMatch = aiResponse.match(/"translation":\s*"([^"]+)"/);
    const contextMatch = aiResponse.match(/"context":\s*"([^"]+)"/);
    const suggestionsMatch = aiResponse.match(/"suggestions":\s*\[(.*?)\]/s);
    
    parsedResponse = {
      translation: translationMatch ? translationMatch[1] : 'Tradução não disponível',
      context: contextMatch ? contextMatch[1] : 'Contexto não disponível',
      suggestions: []
    };
    
    if (suggestionsMatch) {
      const suggestionsText = suggestionsMatch[1];
      const suggestions = suggestionsText.match(/"([^"]+)"/g);
      if (suggestions) {
        parsedResponse.suggestions = suggestions.map(s => s.replace(/"/g, ''));
      }
    }
  }
  
  // Validar estrutura da resposta
  if (!parsedResponse.translation) {
    parsedResponse.translation = 'Tradução não disponível';
  }
  
  if (!parsedResponse.context) {
    parsedResponse.context = 'Contexto não disponível';
  }
  
  if (!Array.isArray(parsedResponse.suggestions)) {
    parsedResponse.suggestions = [
      'Thank you for sharing this!',
      'That\'s an interesting point.',
      'I appreciate your perspective.'
    ];
  }
  
  // Retornar resposta estruturada
  return [{
    json: {
      success: true,
      data: {
        detectedLanguage: $('Function').first().$json.detectedLanguage,
        translation: parsedResponse.translation,
        context: parsedResponse.context,
        suggestions: parsedResponse.suggestions.slice(0, 5), // Máximo 5 sugestões
        metadata: {
          processingTime: Date.now() - new Date($('Function').first().$json.processedAt).getTime(),
          model: 'gpt-4',
          timestamp: new Date().toISOString()
        }
      }
    }
  }];
  
} catch (error) {
  console.error('Error processing AI response:', error);
  
  return [{
    json: {
      success: false,
      error: 'Failed to process AI response',
      details: error.message,
      rawResponse: aiResponse
    }
  }];
}
```

#### Node 5: Respond to Webhook
```
Configurações:
- Response Body: {{ $json }}
- Response Headers: {"Content-Type": "application/json"}
```

## 🔄 2. Webhook de Tradução (`/bavel/translate`)

### 2.1 Criar Workflow de Tradução

1. **Crie novo workflow** no N8N
2. **Adicione os seguintes nodes:**

#### Node 1: Webhook (Trigger)
```
Configurações:
- HTTP Method: POST
- Path: /webhook/bavel/translate
- Response Mode: Wait for Response
- Response Headers: {"Content-Type": "application/json"}
```

#### Node 2: Function - Translation Processing
```javascript
// Validar parâmetros
const { selectedText, userLanguage, sourceLanguage = 'auto', context = '' } = $json;

if (!selectedText || !userLanguage) {
  return [{
    json: {
      success: false,
      error: 'Missing required fields: selectedText, userLanguage'
    }
  }];
}

// Detectar idioma automaticamente se necessário
function detectLanguage(text) {
  const patterns = {
    'en': /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi,
    'es': /\b(el|la|y|o|pero|en|de|con|por|para)\b/gi,
    'fr': /\b(le|la|et|ou|mais|dans|de|avec|pour)\b/gi,
    'pt': /\b(o|a|e|ou|mas|em|de|com|para|por)\b/gi,
    'de': /\b(der|die|das|und|oder|aber|in|auf|mit|für)\b/gi,
    'it': /\b(il|la|e|o|ma|in|di|con|per)\b/gi
  };
  
  let maxMatches = 0;
  let detectedLang = 'en';
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    const matches = (text.match(pattern) || []).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedLang = lang;
    }
  }
  
  return detectedLang;
}

const detectedSourceLang = sourceLanguage === 'auto' ? detectLanguage(selectedText) : sourceLanguage;

// Criar prompt para tradução
const contextInfo = context ? `\nContexto: ${context}` : '';

const prompt = `Traduza o seguinte texto de ${detectedSourceLang} para ${userLanguage}.
Forneça também 2-3 alternativas de tradução.${contextInfo}

TEXTO A TRADUZIR:
"${selectedText}"

FORMATO DE RESPOSTA (JSON válido):
{
  "translation": "tradução principal",
  "alternatives": [
    "alternativa 1",
    "alternativa 2",
    "alternativa 3"
  ],
  "confidence": 0.95
}`;

return [{
  json: {
    selectedText,
    userLanguage,
    detectedSourceLang,
    context,
    prompt,
    processedAt: new Date().toISOString()
  }
}];
```

#### Node 3: OpenAI/Claude (Translation)
```
Configurações:
- Model: gpt-4 ou gpt-3.5-turbo
- System Message: "Você é um tradutor especializado que fornece traduções precisas e alternativas contextuais."
- User Message: {{ $json.prompt }}
- Temperature: 0.2
- Max Tokens: 500
```

#### Node 4: Function - Translation Response
```javascript
const aiResponse = $json.choices?.[0]?.message?.content || $json.response || '';

console.log('Translation AI Response:', aiResponse);

try {
  let parsedResponse;
  
  // Limpar e parsear resposta
  const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    parsedResponse = JSON.parse(cleanResponse);
  } catch (e) {
    // Fallback manual parsing
    const translationMatch = aiResponse.match(/"translation":\s*"([^"]+)"/);
    const alternativesMatch = aiResponse.match(/"alternatives":\s*\[(.*?)\]/s);
    
    parsedResponse = {
      translation: translationMatch ? translationMatch[1] : selectedText,
      alternatives: [],
      confidence: 0.8
    };
    
    if (alternativesMatch) {
      const altText = alternativesMatch[1];
      const alternatives = altText.match(/"([^"]+)"/g);
      if (alternatives) {
        parsedResponse.alternatives = alternatives.map(s => s.replace(/"/g, '')).slice(0, 3);
      }
    }
  }
  
  return [{
    json: {
      success: true,
      data: {
        translation: parsedResponse.translation,
        detectedLanguage: $('Function').first().$json.detectedSourceLang,
        confidence: parsedResponse.confidence || 0.8,
        alternatives: parsedResponse.alternatives || []
      }
    }
  }];
  
} catch (error) {
  console.error('Translation error:', error);
  
  return [{
    json: {
      success: false,
      error: 'Translation failed',
      details: error.message
    }
  }];
}
```

#### Node 5: Respond to Webhook
```
Configurações:
- Response Body: {{ $json }}
- Response Headers: {"Content-Type": "application/json"}
```

## 🔧 3. Configurações Importantes

### 3.1 Headers de Segurança
Em ambos os webhooks, adicione um node **Set** antes da resposta:

```javascript
// Headers de segurança para o Cloudflare Worker
return [{
  json: $json,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Bavel-API-Key, X-Bavel-Signature, X-Bavel-Timestamp',
    'Content-Type': 'application/json'
  }
}];
```

### 3.2 Rate Limiting no N8N
Configure rate limiting nos webhooks:

```javascript
// Node de Rate Limiting (opcional)
const clientIP = $json.headers['x-forwarded-for'] || $json.headers['x-real-ip'] || 'unknown';
const rateLimitKey = `rate_limit_${clientIP}`;

// Implementar lógica de rate limiting se necessário
// (ou deixar o Cloudflare Worker cuidar disso)
```

### 3.3 Logging e Monitoramento
Adicione logs para debug:

```javascript
// Log de entrada
console.log('Webhook received:', {
  action: $json.action,
  textLength: $json.selectedText?.length,
  userLanguage: $json.userLanguage,
  timestamp: new Date().toISOString()
});

// Log de saída
console.log('Webhook response:', {
  success: $json.success,
  hasTranslation: !!$json.data?.translation,
  suggestionsCount: $json.data?.suggestions?.length || 0
});
```

## 🧪 4. Testar os Webhooks

### 4.1 Teste do Webhook de Análise
```bash
curl -X POST "https://SEU_N8N_SERVIDOR.com/webhook/bavel/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "selectedText": "How do I implement async/await in JavaScript?",
    "userLanguage": "pt",
    "pageContext": {
      "url": "https://stackoverflow.com/questions/123",
      "title": "JavaScript async programming",
      "siteType": "stackoverflow"
    }
  }'
```

### 4.2 Teste do Webhook de Tradução
```bash
curl -X POST "https://SEU_N8N_SERVIDOR.com/webhook/bavel/translate" \
  -H "Content-Type: application/json" \
  -d '{
    "selectedText": "Thank you for your help!",
    "userLanguage": "pt",
    "sourceLanguage": "en"
  }'
```

## 📊 5. Estrutura das Respostas

### Resposta do `/analyze`:
```json
{
  "success": true,
  "data": {
    "detectedLanguage": "en",
    "translation": "Como implementar async/await em JavaScript?",
    "context": "Esta é uma pergunta técnica sobre programação...",
    "suggestions": [
      "That's a great question! Here's how I understand it...",
      "I had the same issue. You can solve it by...",
      "Actually, there's a better approach using..."
    ],
    "metadata": {
      "processingTime": 1200,
      "model": "gpt-4",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}
```

### Resposta do `/translate`:
```json
{
  "success": true,
  "data": {
    "translation": "Obrigado pela sua ajuda!",
    "detectedLanguage": "en",
    "confidence": 0.95,
    "alternatives": [
      "Obrigado pelo seu auxílio!",
      "Agradeço sua ajuda!",
      "Muito obrigado pela assistência!"
    ]
  }
}
```

## ✅ Checklist Final

- [ ] Webhook `/bavel/analyze` criado e testado
- [ ] Webhook `/bavel/translate` criado e testado
- [ ] Headers de segurança configurados
- [ ] Logging implementado
- [ ] Testes de conectividade passaram
- [ ] URLs dos webhooks atualizadas no `wrangler.toml`

Agora seus webhooks N8N estão prontos para receber as requisições do Cloudflare Worker! 🚀