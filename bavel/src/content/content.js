let selectedText = '';

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  selectedText = selection.toString().trim();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeText") {
    const textToAnalyze = message.selectedText || selectedText;
    
    if (textToAnalyze) {
      // Usar async/await properly
      (async () => {
        try {
          // Obter idioma do usuário
          const result = await chrome.storage.sync.get(['userLanguage']);
          const userLanguage = result.userLanguage || 'pt';
          
          // Extrair contexto rico da página
          const pageContext = extractPageContext(textToAnalyze);
          
          console.log('Sending to background:', {
            selectedText: textToAnalyze,
            userLanguage,
            pageContext
          });
          
          // Mostrar loading na sidebar imediatamente
          try {
            await chrome.runtime.sendMessage({
              action: "showLoading",
              data: {
                originalText: textToAnalyze
              }
            });
          } catch (loadingError) {
            console.log('Loading display failed (sidebar may not be open):', loadingError);
          }
          
          const response = await chrome.runtime.sendMessage({
            action: "analyzeWithAPI",
            data: {
              action: "analyze", // Campo necessário para o N8N
              selectedText: textToAnalyze,
              userLanguage: userLanguage,
              pageUrl: message.pageUrl,
              pageTitle: message.pageTitle,
              pageContext: pageContext
            }
          }).catch(error => {
            console.error('Failed to send analyzeWithAPI message:', error);
            return { success: false, error: error.message };
          });
          
          console.log('Response from background:', response);
          
          if (response && response.success) {
            // Enviar dados para sidebar via background script
            console.log('Sending update to sidebar via background');
            try {
              await chrome.runtime.sendMessage({
                action: "updateSidebar",
                data: {
                  originalText: textToAnalyze,
                  translation: response.data.translation,
                  context: response.data.context,
                  suggestions: response.data.suggestions,
                  pageInfo: {
                    url: message.pageUrl,
                    title: message.pageTitle
                  }
                }
              }).catch(sidebarError => {
                console.log('Sidebar update message failed:', sidebarError);
              });
            } catch (sidebarError) {
              console.log('Sidebar update failed (sidebar may not be open):', sidebarError);
            }
          }
          
          sendResponse({ success: true });
        } catch (error) {
          console.error('Erro ao processar texto:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      
      return true; // Indica que sendResponse será chamado assincronamente
    }
    
    sendResponse({ success: true });
  }
  
  return true;
});

function extractPageContext(selectedText) {
  try {
    const context = {
      url: window.location.href,
      title: document.title,
      description: getMetaContent('description'),
      keywords: getMetaContent('keywords'),
      siteType: detectSiteType(),
      mainContent: extractMainContent(),
      surroundingHTML: getSurroundingHTML(selectedText),
      headings: extractHeadings(),
      metadata: {
        author: getMetaContent('author'),
        publishDate: getMetaContent('article:published_time') || getMetaContent('datePublished'),
        language: document.documentElement.lang || 'en'
      }
    };
    
    return context;
  } catch (error) {
    console.error('Erro ao extrair contexto:', error);
    return {
      url: window.location.href,
      title: document.title,
      siteType: 'generic'
    };
  }
}

function getMetaContent(name) {
  const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  return meta ? meta.content : null;
}

function detectSiteType() {
  const hostname = window.location.hostname.toLowerCase();
  const title = document.title.toLowerCase();
  const url = window.location.href.toLowerCase();
  
  // Sites específicos
  if (hostname.includes('stackoverflow.com')) return 'stackoverflow';
  if (hostname.includes('reddit.com')) return 'reddit';
  if (hostname.includes('github.com')) return 'github';
  if (hostname.includes('medium.com')) return 'blog';
  if (hostname.includes('dev.to')) return 'blog';
  if (hostname.includes('hackernews') || hostname.includes('news.ycombinator')) return 'forum';
  
  // Padrões gerais
  if (url.includes('/questions/') || url.includes('/question/')) return 'qa-site';
  if (url.includes('/blog/') || title.includes('blog')) return 'blog';
  if (url.includes('/forum/') || url.includes('/discussion/')) return 'forum';
  if (url.includes('/docs/') || url.includes('/documentation/')) return 'documentation';
  
  // Estrutura da página
  if (document.querySelector('article')) return 'article';
  if (document.querySelector('.post, .question, .thread')) return 'discussion';
  
  return 'generic';
}

function extractMainContent() {
  const selectors = [
    'main', 'article', '[role="main"]',
    '.content', '.post', '.question', '.answer',
    '#content', '#main', '#post', '.main-content',
    '.post-content', '.article-content', '.question-body'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return sanitizeText(element.textContent).substring(0, 1000);
    }
  }
  
  // Fallback: maior bloco de texto
  const paragraphs = Array.from(document.querySelectorAll('p'));
  if (paragraphs.length > 0) {
    const longestP = paragraphs.reduce((a, b) => 
      a.textContent.length > b.textContent.length ? a : b
    );
    return sanitizeText(longestP.textContent).substring(0, 1000);
  }
  
  return sanitizeText(document.body.textContent).substring(0, 500);
}

function getSurroundingHTML(selectedText) {
  try {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    // Encontrar elemento pai mais próximo
    const parentElement = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container;
    
    if (!parentElement) return null;
    
    return {
      tagName: parentElement.tagName,
      className: parentElement.className,
      id: parentElement.id,
      textContent: sanitizeText(parentElement.textContent).substring(0, 500),
      // Contexto dos elementos vizinhos
      previousSibling: parentElement.previousElementSibling?.textContent?.substring(0, 200) || null,
      nextSibling: parentElement.nextElementSibling?.textContent?.substring(0, 200) || null
    };
  } catch (error) {
    console.error('Erro ao extrair HTML ao redor:', error);
    return null;
  }
}

function extractHeadings() {
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  return headings.map(h => ({
    level: parseInt(h.tagName.charAt(1)),
    text: sanitizeText(h.textContent),
    id: h.id || null
  })).filter(h => h.text.length > 0).slice(0, 10); // Limitar a 10
}

function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ') // Normalizar espaços
    .replace(/[\r\n\t]/g, ' ') // Remover quebras de linha
    .trim();
}

function detectLanguage(text) {
  const patterns = {
    'en': /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi,
    'es': /\b(el|la|y|o|pero|en|de|con|por|para)\b/gi,
    'fr': /\b(le|la|et|ou|mais|dans|de|avec|pour)\b/gi,
    'pt': /\b(o|a|e|ou|mas|em|de|com|para|por)\b/gi
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