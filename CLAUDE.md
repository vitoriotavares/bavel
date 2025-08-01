# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bavel is a Chrome extension that helps users practice languages by providing contextual translations and response suggestions for posts on sites like Reddit, StackOverflow, and blogs. The extension uses AI-powered analysis to provide intelligent translations and conversation starters.

## Extension Architecture

### Manifest V3 Structure
- **Background Script**: `src/background/background.js` - Service worker handling API calls, context menus, and message routing
- **Content Script**: `src/content/content.js` - Injected into web pages to extract context and handle text selection
- **Sidebar Interface**: `src/sidebar/sidebar.html|js|css` - Main user interface using Chrome's Side Panel API
- **Popup Interface**: `src/popup/popup.html` - Extension action popup
- **Internationalization**: `src/i18n/translations.js` - Multi-language support system

### Key Components

#### Background Script (`src/background/background.js`)
- Manages context menu creation and updates based on user language
- Handles N8N API integration with endpoints:
  - `https://n8n.ai-shield.online/webhook/bavel/analyze` - Text analysis
  - `https://n8n.ai-shield.online/webhook/bavel/translate` - Translation service
- Implements offline fallback functionality with mock translation and language detection
- Routes messages between content script and sidebar

#### Content Script (`src/content/content.js`)
- Extracts rich page context including site type detection (StackOverflow, Reddit, GitHub, etc.)
- Captures surrounding HTML and page metadata
- Performs intelligent text selection and context analysis
- Supports automatic site-specific optimizations

#### Sidebar Interface (`src/sidebar/sidebar.js`)
- Multi-screen architecture: Welcome → Loading → Analysis → Settings
- Animated loading states with step-by-step progress indicators
- Real-time translation with alternatives display
- Response suggestion system with click-to-insert functionality

## Development Workflow

### Installation and Setup
```bash
# 1. Setup security infrastructure
# Follow security-setup.md guide

# 2. Load extension in Chrome
# Open chrome://extensions/
# Enable "Developer mode"
# Click "Load unpacked"
# Select the bavel/ directory

# 3. Configure security client
# Update src/security/security-client.js with your URLs and keys
```

### Security Configuration
```bash
# Deploy Cloudflare Worker
cd cloudflare-worker
wrangler deploy --env production

# Test security configuration
# In extension console:
validateSecurityConfig();
```

### No Build Process
This extension uses vanilla JavaScript with no build step required. All files are directly loaded by Chrome.

### Testing Extension
- Test on different websites (Reddit, StackOverflow, GitHub, Medium)
- Verify context menu appears on text selection
- Test sidebar functionality and secure API integration
- Check internationalization across all supported languages
- Verify security features (rate limiting, authentication)
- Test offline fallback functionality

### Debugging
```javascript
// Background script logs
console.log('Making secure API request:', data);
console.log('Secure API Response:', result.success);

// Security client logs
console.log('Security client config:', client.environment);
console.log('Rate limit status:', { remainingIP, remainingKey });

// Content script logs  
console.log('Page context extracted:', context);
console.log('Sending to background:', data);

// Sidebar logs
console.log('Sidebar received message:', message);
```

### Security Testing
```javascript
// Test connection
const client = new BavelSecurityClient();
client.testConnection().then(console.log);

// Check rate limit status
client.checkRateLimitStatus().then(console.log);

// Validate configuration
validateSecurityConfig();
```

## Security Architecture

### Cloudflare Security Layer
The extension now uses a secure Cloudflare Worker as a proxy between the Chrome extension and N8N:

- **Cloudflare Worker**: `cloudflare-worker/worker.js` - Security proxy with authentication, rate limiting, and DDoS protection
- **Security Client**: `src/security/security-client.js` - Handles HMAC signatures, API key authentication, and secure requests
- **Configuration**: `security-setup.md` - Complete setup guide for security infrastructure

### Security Features
- **API Key Authentication**: Validates requests using secure API keys
- **HMAC Signatures**: All requests signed with HMAC-SHA256 for integrity
- **Rate Limiting**: Multi-level rate limiting (IP, API key, global)
- **DDoS Protection**: Automatic detection and blocking of suspicious patterns
- **Input Sanitization**: Comprehensive cleaning of user input
- **Security Headers**: Full suite of security headers including CSP, HSTS
- **Request Logging**: Detailed security event logging and alerting

### API Integration

#### Secure Endpoint Structure
- **Production**: `https://bavel-security-proxy.your-domain.workers.dev`
- **Development**: `https://bavel-security-proxy-dev.your-domain.workers.dev`

#### Authentication Headers
```javascript
{
  'Content-Type': 'application/json',
  'X-Bavel-API-Key': 'your-api-key',
  'X-Bavel-Signature': 'hmac-sha256-signature',
  'X-Bavel-Timestamp': 'unix-timestamp'
}
```

### Payload Structure
```javascript
{
  action: 'analyze', // or 'translate'
  selectedText: 'user selected text',
  userLanguage: 'pt', // user's native language
  pageContext: {
    url, title, siteType, mainContent, surroundingHTML, headings, metadata
  }
}
```

### Security Configuration

#### Required Setup
1. **Deploy Cloudflare Worker** using provided configuration
2. **Configure API Keys** in security client
3. **Set HMAC Secret** for request signing
4. **Update URLs** to point to your Cloudflare Worker

#### Rate Limiting
- **IP-based**: 50 requests per 15 minutes
- **API Key-based**: 100 requests per 15 minutes
- **Global**: 1000 requests per 15 minutes
- **DDoS Protection**: Automatic blocking of suspicious patterns

### Offline Fallback
The extension includes comprehensive offline functionality with:
- Language detection using regex patterns
- Mock translation system with common phrases
- Context generation based on text analysis
- Generic response suggestions by language
- Graceful degradation when security layer is unavailable

## Internationalization System

### Supported Languages
- Portuguese (pt) - default
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)

### Adding Translations
Update `src/i18n/translations.js` with new language keys following the existing structure.

## Storage Architecture

### Chrome Storage (Sync)
- `userLanguage`: User's selected native language
- `isFirstTime`: Boolean for welcome screen display

## Site-Specific Optimizations

The extension includes intelligent site detection for:
- **StackOverflow**: Enhanced technical context extraction
- **Reddit**: Discussion thread awareness
- **GitHub**: Issue/discussion context
- **Medium/Blogs**: Article context analysis
- **Forums**: Thread and discussion detection

## Message Flow Architecture

```
User selects text → Content Script extracts context → Background Script calls API → 
Sidebar displays loading → API response processed → Analysis screen populated
```

## Code Style Conventions

- Use vanilla JavaScript (ES6+)
- Async/await for asynchronous operations
- Comprehensive error handling with fallbacks
- Console logging for debugging
- CSS classes follow kebab-case
- Function names use camelCase
- File structure follows Chrome extension conventions

## Extension Permissions

- `contextMenus`: Right-click menu integration
- `activeTab`: Access to current tab
- `storage`: User preferences persistence  
- `sidePanel`: Chrome Side Panel API
- `<all_urls>`: Universal site compatibility (required for secure API communication)

## Security Files

- `cloudflare-worker/worker.js`: Main security proxy implementation
- `cloudflare-worker/wrangler.toml`: Cloudflare Worker configuration
- `src/security/security-client.js`: Client-side security implementation
- `security-setup.md`: Complete security setup guide
- `bavel/docs/security-architecture.md`: Detailed security architecture documentation

## Security Considerations

- **Authentication**: All API requests authenticated with API keys and HMAC signatures
- **Rate Limiting**: Multi-layer protection against abuse
- **Input Sanitization**: Comprehensive cleaning of user input to prevent injection attacks
- **HTTPS Only**: All communication encrypted in transit
- **Security Headers**: Full suite of security headers including CSP and HSTS
- **Logging**: Comprehensive security event logging for monitoring
- **Key Rotation**: Support for periodic API key and HMAC secret rotation

## Performance Considerations

- Rich context extraction limited to 1000 characters
- Lazy loading of UI components
- Efficient language detection using regex patterns
- Minimal DOM manipulation
- Proper cleanup of event listeners and intervals
- Cloudflare edge caching for improved response times
- Request retry with exponential backoff
- Graceful degradation to offline mode