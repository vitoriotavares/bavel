let selectedText = '';

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  selectedText = selection.toString().trim();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeText") {
    const textToAnalyze = message.selectedText || selectedText;
    
    if (textToAnalyze) {
      chrome.storage.sync.get(['userLanguage'], async (result) => {
        const userLanguage = result.userLanguage || 'pt';
        
        try {
          const response = await chrome.runtime.sendMessage({
            action: "analyzeWithAPI",
            data: {
              selectedText: textToAnalyze,
              userLanguage: userLanguage,
              pageUrl: message.pageUrl,
              pageTitle: message.pageTitle
            }
          });
          
          if (response.success) {
            chrome.runtime.sendMessage({
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
            });
          }
        } catch (error) {
          console.error('Erro ao processar texto:', error);
        }
      });
    }
    
    sendResponse({ success: true });
  }
  
  return true;
});

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