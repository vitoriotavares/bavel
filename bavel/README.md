# 🗣️ Bavel - Chrome Extension

**Pratique idiomas de forma inteligente respondendo a posts em sites como Reddit, StackOverflow e blogs.**

## 🎯 O que é o Bavel?

Bavel é uma extensão do Chrome que ajuda você a praticar idiomas através de respostas contextuais. Selecione qualquer texto em inglês (ou outros idiomas), receba tradução e contexto em português, e gere respostas apropriadas para participar de discussões internacionais.

### ✨ Principais Funcionalidades

- 🌐 **Tradução Inteligente** - IA contextualiza e traduz textos
- 💡 **Sugestões de Resposta** - Opções personalizadas baseadas no contexto
- 🎨 **Interface Multilíngue** - 6 idiomas suportados
- ⚡ **Loading Animado** - Feedback visual durante processamento
- 🔄 **Alternativas de Tradução** - Múltiplas opções para escolher
- 📱 **Design Responsivo** - Interface moderna e intuitiva

## 🚀 Instalação Rápida

1. **Clone ou baixe** este repositório
2. **Abra** `chrome://extensions/` no Chrome
3. **Ative** o "Modo do desenvolvedor"
4. **Clique** "Carregar sem compactação"
5. **Selecione** a pasta `bavel/`
6. **Pronto!** 🎉

## 📖 Como Usar

### 1. Configuração Inicial
- Configure seu idioma nativo (Português, English, Español, etc.)
- A interface se adapta automaticamente

### 2. Uso Básico
- Vá para Reddit, StackOverflow, ou qualquer site
- **Selecione** um texto interessante
- **Clique direito** → "Opinar com Bavel"
- **Aguarde** a análise da IA
- **Escreva** sua resposta baseada nas sugestões
- **Copie** e cole no site original

### 3. Funcionalidades Avançadas
- **Traduza** suas respostas para verificar
- **Escolha** entre alternativas de tradução
- **Use** sugestões como inspiração
- **Pratique** regularmente para melhorar

## 🏗️ Arquitetura Técnica

### Estrutura do Projeto
```
bavel/
├── manifest.json           # Configuração da extensão
├── src/
│   ├── background/         # Service worker
│   ├── content/           # Scripts injetados
│   ├── sidebar/           # Interface principal
│   ├── popup/             # Popup da extensão
│   └── i18n/              # Sistema de traduções
├── assets/                 # Recursos estáticos
└── docs/                  # Documentação completa
```

### Tecnologias Utilizadas
- **Manifest V3** - Padrão atual do Chrome
- **Vanilla JavaScript** - Performance e simplicidade
- **N8N Integration** - Workflow automation
- **Side Panel API** - Interface nativa do Chrome
- **Chrome Storage API** - Persistência de configurações

## 🌐 Integração com IA

### APIs Configuradas
- **Analyze Endpoint** - Análise completa com contexto rico
- **Translate Endpoint** - Tradução com alternativas
- **Fallback Offline** - Funciona sem internet

### Processamento Inteligente
1. **Extração de Contexto** - Analisa página e conteúdo
2. **Detecção de Site** - Otimizado para StackOverflow, Reddit, etc.
3. **Análise de IA** - GPT-4 processa contexto completo
4. **Geração de Sugestões** - Respostas personalizadas
5. **Tradução Avançada** - Múltiplas alternativas

## 🌍 Suporte Multilíngue

### Idiomas da Interface
- 🇧🇷 **Português** - Idioma padrão
- 🇺🇸 **English** - Fully supported
- 🇪🇸 **Español** - Totalmente compatible
- 🇫🇷 **Français** - Entièrement pris en charge
- 🇩🇪 **Deutsch** - Vollständig unterstützt
- 🇮🇹 **Italiano** - Completamente supportato

### Detecção Automática
A extensão detecta automaticamente o idioma dos textos e se adapta conforme necessário.

## 📊 Status do Desenvolvimento

### ✅ Implementado
- [x] Arquitetura completa da extensão
- [x] Sistema de internacionalização
- [x] Integração com N8N/IA
- [x] Extração de contexto rico
- [x] Interface responsiva completa
- [x] Sistema de loading animado
- [x] Tradução com alternativas
- [x] Fallback offline
- [x] Documentação completa

### 🔄 Em Desenvolvimento
- [ ] Publicação na Chrome Web Store
- [ ] Métricas e analytics
- [ ] Testes automatizados
- [ ] Otimizações de performance

## 📚 Documentação

### Documentos Disponíveis
- [`project-specification.md`](docs/project-specification.md) - Especificação técnica completa
- [`user-guide.md`](docs/user-guide.md) - Guia completo do usuário
- [`architecture-overview.md`](docs/architecture-overview.md) - Visão geral da arquitetura
- [`api-specification.md`](docs/api-specification.md) - Documentação das APIs
- [`integration-status.md`](docs/integration-status.md) - Status da integração N8N

### Casos de Uso Documentados
- **Estudante de Programação** - Participar do StackOverflow
- **Profissional Tech** - Responder issues no GitHub
- **Entusiasta de Idiomas** - Participar de discussões no Reddit

## 🧪 Para Desenvolvedores

### Configuração do Ambiente
```bash
# Clone o repositório
git clone [repository-url]
cd bavel

# Carregue no Chrome
# chrome://extensions/ > Modo desenvolvedor > Carregar sem compactação
```

### Debug e Logs
```javascript
// Console do Background Script
console.log('Calling N8N API:', endpoint, payload);

// Console do Content Script
console.log('Page context extracted:', context);

// Console da Sidebar
console.log('Sidebar received message:', message);
```

### Estrutura de Componentes
- **Background** - Service worker, APIs, roteamento
- **Content** - Injeção, extração de contexto, detecção
- **Sidebar** - Interface, UX, estados, animações
- **I18n** - Traduções, localização, suporte multilíngue

## 🎯 Filosofia do Projeto

### Objetivos Principais
1. **Facilitar** a prática de idiomas
2. **Contextualizar** traduções e respostas
3. **Encorajar** participação em discussões internacionais
4. **Aprender** através da prática real

### Princípios de Design
- **Simplicidade** - Interface limpa e intuitiva
- **Performance** - Carregamento rápido e responsivo
- **Acessibilidade** - Funciona para todos os níveis
- **Privacidade** - Mínimo de dados coletados

## 🤝 Contribuição

### Como Contribuir
1. **Reporte bugs** através de issues
2. **Sugira melhorias** de funcionalidade
3. **Documente** casos de uso interessantes
4. **Teste** em diferentes sites e idiomas

### Roadmap Futuro
- Suporte a mais LLMs (Claude, Llama)
- Histórico de traduções
- Configurações avançadas
- Modo offline expandido
- Analytics de aprendizado

## 📞 Suporte

### Problemas Comuns
- Verifique se a extensão está ativa
- Recarregue a página se necessário
- Consulte os logs do console
- Verifique conexão com internet

### Documentação Adicional
- Todos os fluxos estão documentados em `/docs/`
- Exemplos de API em `api-specification.md`
- Guia completo em `user-guide.md`

## 📄 Licença

[Licença a ser definida]

## 🏆 Créditos

**Desenvolvido com IA avançada para educação de idiomas.**

- **Conceito:** Prática contextual de idiomas
- **Tecnologia:** Chrome Extensions + N8N + IA
- **Design:** Interface moderna e responsiva
- **Documentação:** Completa e detalhada

---

## 🎉 Comece Agora!

1. **Instale** a extensão
2. **Configure** seu idioma
3. **Vá** para o Reddit ou StackOverflow
4. **Selecione** um texto interessante
5. **Pratique** e aprenda!

**Happy learning!** 🌟

---

*Bavel v1.0.0 - Desenvolvido em Agosto 2025*