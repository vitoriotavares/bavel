# Bavel Extension - Status da Integração N8N

## ✅ Implementado

### 🔗 Endpoints Configurados
- **Analyze**: `https://n8n.ai-shield.online/webhook/bavel/analyze`
- **Translate**: `https://n8n.ai-shield.online/webhook/bavel/translate`

### 🧠 Extração de Contexto Rico
A extensão agora extrai contexto completo da página:

```javascript
{
  url: "https://stackoverflow.com/questions/123",
  title: "How to implement async/await in JavaScript?",
  description: "Meta description da página",
  siteType: "stackoverflow", // Auto-detectado
  mainContent: "Conteúdo principal extraído...",
  surroundingHTML: {
    tagName: "DIV",
    className: "question-body",
    textContent: "Contexto ao redor do texto...",
    previousSibling: "Texto anterior...",
    nextSibling: "Próximo texto..."
  },
  headings: [
    { level: 1, text: "Main Title", id: "title" },
    { level: 2, text: "Subtitle", id: "subtitle" }
  ],
  metadata: {
    author: "user123",
    publishDate: "2024-01-01",
    language: "en"
  }
}
```

### 🎯 Sites Suportados (Auto-detecção)
- **StackOverflow** → `stackoverflow`
- **Reddit** → `reddit` 
- **GitHub** → `github`
- **Medium/Dev.to** → `blog`
- **Hacker News** → `forum`
- **Sites genéricos** → `generic`

### 🔄 Fluxo Completo
1. **Usuário seleciona texto** → Content script captura
2. **Extração de contexto** → Página é analisada automaticamente
3. **Envio para N8N** → Payload rico com contexto completo
4. **Processamento IA** → N8N processa com LLM
5. **Resposta contextual** → Sugestões inteligentes baseadas no contexto
6. **Fallback offline** → Se API falhar, usa modo offline

## 🧪 Como Testar

### 1. Recarregar Extensão
```
chrome://extensions/ → Recarregar
```

### 2. Testar em Site Real
- Vá para StackOverflow/Reddit
- Selecione texto de uma pergunta/post
- Clique direito → "Opinar com Bavel"
- Verifique console do background script

### 3. Verificar Logs
```javascript
// No console do background script:
console.log('Calling N8N API:', endpoint, requestBody);
console.log('N8N API Response:', result);
```

### 4. Payload de Exemplo
```json
{
  "action": "analyze",
  "selectedText": "How do I implement async/await properly?",
  "userLanguage": "pt",
  "pageContext": {
    "url": "https://stackoverflow.com/questions/123",
    "title": "JavaScript async programming question",
    "siteType": "stackoverflow",
    "mainContent": "I'm having trouble with async/await...",
    "surroundingHTML": {
      "tagName": "DIV",
      "className": "question-body",
      "textContent": "Full question context here..."
    }
  },
  "preferences": {
    "responseStyle": "helpful",
    "responseLength": "medium",
    "includeExamples": true,
    "tone": "constructive"
  }
}
```

## 🚀 Próximos Passos

### Para N8N Workflow:
1. **Webhook Node** configurado para receber payload rico
2. **OpenAI/Claude Node** com prompt que usa contexto da página
3. **Response formatting** seguindo especificação da API
4. **Error handling** para casos edge

### Exemplo de Prompt para IA:
```
Você está ajudando alguém a praticar idiomas respondendo em contexto.

CONTEXTO DA PÁGINA:
- Site: {{$json.pageContext.siteType}}
- Título: {{$json.pageContext.title}}
- Tipo de conteúdo: {{$json.pageContext.mainContent}}
- Estrutura: {{$json.pageContext.surroundingHTML.textContent}}

TEXTO SELECIONADO:
"{{$json.selectedText}}"

IDIOMA DO USUÁRIO: {{$json.userLanguage}}

TAREFA:
1. Traduza o texto selecionado para {{$json.userLanguage}}
2. Explique o contexto da discussão
3. Sugira 3-5 respostas apropriadas no idioma original
4. Respostas devem ser adequadas ao tipo de site e contexto

Responda em JSON seguindo a especificação da API.
```

## ⚠️ Importante

- **API URLs** estão hardcoded no background.js
- **Fallback offline** funciona se N8N estiver indisponível  
- **Rate limiting** pode ser necessário dependendo do uso
- **CORS** deve estar configurado no N8N
- **Logging** habilitado para debug (remover em produção)

## 🔍 Debug

### Console do Background Script:
```javascript
// Ver requisições
console.log('Calling N8N API:', endpoint, requestBody);

// Ver respostas
console.log('N8N API Response:', result);

// Ver fallbacks
console.log('API Error, falling back to offline mode:', error);
```

### Console da Página (Content Script):
```javascript
// Ver contexto extraído
console.log('Page context extracted:', pageContext);
```

---
*Status: Pronto para teste com N8N workflow configurado*