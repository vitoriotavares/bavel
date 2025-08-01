# Endpoint para Workflow N8N - Bavel Extension

## 🔌 Especificação do Endpoint

### **POST `/bavel/analyze`**

## 📥 Parâmetros de Entrada (Request Body)

```json
{
  "action": "analyze",
  "selectedText": "texto selecionado pelo usuário",
  "userLanguage": "pt",
  "pageContext": {
    "url": "https://stackoverflow.com/questions/123",
    "title": "How to implement async/await in JavaScript?",
    "description": "meta description da página",
    "siteType": "stackoverflow",
    "mainContent": "contexto principal da página...",
    "surroundingHTML": {
      "tagName": "DIV",
      "className": "question-body",
      "textContent": "contexto ao redor do texto..."
    },
    "headings": ["H1 title", "H2 subtitle"],
    "metadata": {
      "keywords": "javascript, async, await",
      "author": "user123",
      "publishDate": "2024-01-01"
    }
  },
  "preferences": {
    "responseStyle": "formal", // formal, casual, technical
    "responseLength": "medium", // short, medium, long
    "includeExamples": true,
    "tone": "helpful" // helpful, critical, neutral
  }
}
```

### **POST `/bavel/translate`** (Para traduzir resposta do usuário)

```json
{
  "action": "translate",
  "text": "User's response to be translated",
  "sourceLanguage": "en", // detectado automaticamente
  "targetLanguage": "pt",
  "context": "casual conversation" // opcional
}
```

## 📤 Parâmetros de Saída (Response)

### Resposta Completa para `/analyze`:
```json
{
  "success": true,
  "data": {
    "detectedLanguage": "en",
    "confidence": 0.95,
    "translation": {
      "text": "tradução do texto selecionado",
      "originalLanguage": "en",
      "targetLanguage": "pt"
    },
    "context": {
      "summary": "Este texto é uma pergunta técnica sobre JavaScript...",
      "category": "technical-question",
      "difficulty": "intermediate",
      "topic": "JavaScript async programming",
      "sentiment": "neutral-seeking-help"
    },
    "suggestions": [
      {
        "text": "That's a great question! Here's how I understand it...",
        "type": "supportive",
        "tone": "helpful",
        "confidence": 0.9
      },
      {
        "text": "I had the same issue. You can solve it by...",
        "type": "solution-oriented",
        "tone": "collaborative", 
        "confidence": 0.85
      },
      {
        "text": "Actually, there's a better approach using...",
        "type": "alternative-suggestion",
        "tone": "constructive",
        "confidence": 0.8
      }
    ],
    "relatedTopics": [
      "Promise handling",
      "Error management",
      "JavaScript best practices"
    ],
    "examples": [
      {
        "title": "Basic async/await example",
        "code": "async function example() { ... }",
        "explanation": "This shows how to..."
      }
    ]
  },
  "metadata": {
    "processingTime": 1.2,
    "model": "gpt-4",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Resposta para `/translate`:
```json
{
  "success": true,
  "data": {
    "translation": "Tradução do texto",
    "detectedLanguage": "en",
    "confidence": 0.98,
    "alternatives": [
      "Tradução alternativa 1",
      "Tradução alternativa 2"
    ]
  }
}
```

## ⚙️ Workflow N8N - Estrutura Sugerida

### **Nodes Necessários:**

1. **Webhook Node** (Trigger)
   - Method: POST
   - Path: `/bavel/analyze`
   - Response Mode: Wait for Response

2. **Function Node** (Validation)
   ```javascript
   // Validar parâmetros obrigatórios
   const required = ['selectedText', 'userLanguage'];
   const missing = required.filter(field => !$json[field]);
   
   if (missing.length > 0) {
     return [{
       json: {
         success: false,
         error: `Missing required fields: ${missing.join(', ')}`
       }
     }];
   }
   
   return [$json];
   ```

3. **OpenAI Node** (ou similar)
   - Model: GPT-4 ou Claude
   - System Prompt: Contexto específico do Bavel
   - User Message: Template com parâmetros

4. **Code Node** (Processing)
   ```javascript
   // Processar resposta da IA e estruturar JSON
   const aiResponse = $json.choices[0].message.content;
   
   return [{
     json: {
       success: true,
       data: {
         translation: extractTranslation(aiResponse),
         context: extractContext(aiResponse),
         suggestions: extractSuggestions(aiResponse)
       }
     }
   }];
   ```

5. **Respond to Webhook Node**
   - Response format: JSON

## 🎯 Prompts Sugeridos para IA

### Prompt Principal:
```
Você é um assistente especializado em ajudar pessoas a praticar idiomas através de respostas contextuais.

CONTEXTO DA PÁGINA:
- Site: {{$json.pageContext.siteType}}
- Título: {{$json.pageContext.title}}
- URL: {{$json.pageContext.url}}

TEXTO SELECIONADO:
"{{$json.selectedText}}"

IDIOMA DO USUÁRIO: {{$json.userLanguage}}

TAREFA:
1. Traduza o texto para {{$json.userLanguage}}
2. Forneça contexto sobre o que está sendo discutido
3. Sugira 3-5 respostas apropriadas no idioma original
4. As respostas devem ser educadas, construtivas e adequadas ao contexto

FORMATO DE RESPOSTA (JSON):
{
  "translation": "tradução aqui",
  "context": "explicação do contexto",
  "suggestions": ["resposta 1", "resposta 2", "resposta 3"]
}
```

## 🔧 Headers Necessários

```javascript
// Request Headers esperados
{
  "Content-Type": "application/json",
  "User-Agent": "Bavel-Extension/1.0.0",
  "X-Extension-Version": "1.0.0"
}

// Response Headers
{
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
}
```

## 📊 Rate Limiting & Error Handling

```json
{
  "rateLimit": {
    "maxRequests": 100,
    "windowMs": 900000, // 15 minutos
    "message": "Too many requests, please try again later"
  },
  "errors": {
    "400": "Invalid request parameters",
    "429": "Rate limit exceeded", 
    "500": "Internal server error",
    "503": "AI service unavailable"
  }
}
```

## 📚 Implementação no Background Script

### Atualizar handleAPIRequest:
```javascript
async function handleAPIRequest(data) {
  const { selectedText, userLanguage, action, pageContext } = data;
  
  const requestBody = {
    action: action || 'analyze',
    selectedText,
    userLanguage,
    pageContext: pageContext || {},
    preferences: {
      responseStyle: 'helpful',
      responseLength: 'medium',
      includeExamples: true,
      tone: 'constructive'
    }
  };
  
  try {
    const response = await fetch('YOUR_N8N_WEBHOOK_URL', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Bavel-Extension/1.0.0',
        'X-Extension-Version': '1.0.0'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'API request failed');
    }
    
    return {
      translation: result.data.translation?.text || result.data.translation,
      context: result.data.context?.summary || result.data.context,
      suggestions: result.data.suggestions?.map(s => 
        typeof s === 'string' ? s : s.text
      ) || [],
      detectedLanguage: result.data.detectedLanguage
    };
    
  } catch (error) {
    console.error('API Error:', error);
    // Fallback para modo offline
    return {
      translation: await mockTranslate(selectedText, userLanguage),
      context: generateContext(selectedText, detectLanguage(selectedText)),
      suggestions: generateSuggestions(selectedText, detectLanguage(selectedText), userLanguage)
    };
  }
}
```

## 🧪 Exemplo de Teste

```bash
curl -X POST "YOUR_N8N_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Bavel-Extension/1.0.0" \
  -d '{
    "action": "analyze",
    "selectedText": "How do I implement async/await properly?",
    "userLanguage": "pt",
    "pageContext": {
      "url": "https://stackoverflow.com/questions/123",
      "title": "JavaScript async programming",
      "siteType": "stackoverflow"
    }
  }'
```

## 🔄 Próximos Passos

1. **Configurar Webhook** no N8N
2. **Implementar validação** de parâmetros
3. **Configurar OpenAI Node** com prompts específicos
4. **Testar endpoint** com dados reais
5. **Atualizar background.js** com URL real
6. **Implementar rate limiting** se necessário
7. **Adicionar logging** para debug

---

*Documentação criada para Bavel Extension v1.0.0*