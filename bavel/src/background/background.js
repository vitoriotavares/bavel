chrome.runtime.onInstalled.addListener(async () => {
  // Definir título do menu baseado no idioma do usuário
  const result = await chrome.storage.sync.get(['userLanguage']);
  const userLang = result.userLanguage || 'pt';
  
  const contextMenuTitles = {
    'pt': 'Opinar com Bavel',
    'en': 'Comment with Bavel',
    'es': 'Opinar con Bavel',
    'fr': 'Commenter avec Bavel',
    'de': 'Mit Bavel kommentieren',
    'it': 'Commenta con Bavel'
  };
  
  chrome.contextMenus.create({
    id: "bavel-analyze",
    title: contextMenuTitles[userLang] || contextMenuTitles['pt'],
    contexts: ["selection"]
  });
});

// Atualizar menu quando idioma muda
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.userLanguage) {
    updateContextMenu(changes.userLanguage.newValue);
  }
});

function updateContextMenu(userLang) {
  const contextMenuTitles = {
    'pt': 'Opinar com Bavel',
    'en': 'Comment with Bavel',
    'es': 'Opinar con Bavel',
    'fr': 'Commenter avec Bavel',
    'de': 'Mit Bavel kommentieren',
    'it': 'Commenta con Bavel'
  };
  
  chrome.contextMenus.update('bavel-analyze', {
    title: contextMenuTitles[userLang] || contextMenuTitles['pt']
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "bavel-analyze" && info.selectionText) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
      
      chrome.tabs.sendMessage(tab.id, {
        action: "analyzeText",
        selectedText: info.selectionText,
        pageUrl: tab.url,
        pageTitle: tab.title
      });
    } catch (error) {
      console.error("Erro ao abrir sidebar:", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getSelectedText") {
    sendResponse({ success: true });
  }
  
  if (message.action === "analyzeWithAPI") {
    handleAPIRequest(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleAPIRequest(data) {
  const { selectedText, userLanguage, action } = data;
  
  // Lógica offline/mock - sem API externa
  try {
    if (action === 'translate') {
      return {
        translation: await mockTranslate(selectedText, userLanguage)
      };
    }
    
    const detectedLang = detectLanguage(selectedText);
    const translation = await mockTranslate(selectedText, userLanguage);
    const context = generateContext(selectedText, detectedLang);
    const suggestions = generateSuggestions(selectedText, detectedLang, userLanguage);
    
    return {
      translation,
      context,
      suggestions,
      detectedLanguage: detectedLang
    };
  } catch (error) {
    console.error('Erro no processamento:', error);
    return {
      translation: "Não foi possível traduzir",
      context: "Não foi possível gerar contexto",
      suggestions: ["Interessante!", "Concordo.", "Discordo."]
    };
  }
}

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

async function mockTranslate(text, targetLang) {
  // Simulação de tradução - em produção usar Google Translate API ou similar
  const translations = {
    'pt': {
      'Hello world': 'Olá mundo',
      'How are you?': 'Como você está?',
      'Thank you': 'Obrigado',
      'Good morning': 'Bom dia',
      'What is your opinion?': 'Qual é sua opinião?',
      'I think': 'Eu acho',
      'I agree': 'Eu concordo',
      'I disagree': 'Eu discordo'
    },
    'en': {
      'Olá mundo': 'Hello world',
      'Como você está?': 'How are you?',
      'Obrigado': 'Thank you',
      'Bom dia': 'Good morning',
      'Qual é sua opinião?': 'What is your opinion?',
      'Eu acho': 'I think',
      'Eu concordo': 'I agree',
      'Eu discordo': 'I disagree'
    }
  };
  
  // Busca tradução exata
  if (translations[targetLang] && translations[targetLang][text]) {
    return translations[targetLang][text];
  }
  
  // Tradução palavra por palavra (simplificada)
  const words = text.split(' ');
  const translatedWords = words.map(word => {
    const cleanWord = word.toLowerCase().replace(/[.,!?]/g, '');
    if (translations[targetLang] && translations[targetLang][cleanWord]) {
      return translations[targetLang][cleanWord];
    }
    return word; // Mantém palavra original se não encontrar
  });
  
  return translatedWords.join(' ');
}

function generateContext(text, detectedLang) {
  const contexts = {
    'en': 'Este texto está em inglês. Pode ser de um fórum, artigo técnico ou discussão online.',
    'es': 'Este texto está em espanhol. Pode ser de uma discussão, notícia ou post em redes sociais.',
    'fr': 'Este texto está em francês. Pode ser de um artigo, fórum ou conversa online.',
    'pt': 'Este texto está em português. Pode ser de uma discussão, artigo ou post.',
    'de': 'Este texto está em alemão. Pode ser de um fórum técnico, artigo ou discussão.',
    'it': 'Este texto está em italiano. Pode ser de uma discussão, artigo ou post online.'
  };
  
  let context = contexts[detectedLang] || 'Texto em idioma não identificado.';
  
  // Adiciona contexto baseado no conteúdo
  if (text.includes('?')) {
    context += ' Parece ser uma pergunta que busca opinião ou resposta.';
  }
  if (text.includes('!')) {
    context += ' O tom parece ser enfático ou exclamativo.';
  }
  if (text.length > 200) {
    context += ' É um texto longo, provavelmente uma explicação detalhada.';
  }
  
  return context;
}

function generateSuggestions(text, detectedLang, userLang) {
  const suggestions = {
    'en': {
      'pt': [
        'That\'s an interesting point!',
        'I agree with your perspective.',
        'I have a different opinion on this.',
        'Could you elaborate more?',
        'Thanks for sharing this information.'
      ]
    },
    'es': {
      'pt': [
        '¡Muy interesante tu punto de vista!',
        'Estoy de acuerdo contigo.',
        'Tengo una opinión diferente sobre esto.',
        '¿Podrías explicar más?',
        'Gracias por compartir esta información.'
      ]
    },
    'fr': {
      'pt': [
        'C\'est un point de vue intéressant!',
        'Je suis d\'accord avec vous.',
        'J\'ai une opinion différente sur cela.',
        'Pourriez-vous expliquer davantage?',
        'Merci de partager cette information.'
      ]
    }
  };
  
  // Sugestões genéricas se não encontrar específicas
  const genericSuggestions = {
    'en': ['Interesting!', 'I agree.', 'I disagree.', 'Tell me more.', 'Thanks!'],
    'es': ['¡Interesante!', 'Estoy de acuerdo.', 'No estoy de acuerdo.', 'Cuéntame más.', '¡Gracias!'],
    'fr': ['Intéressant!', 'Je suis d\'accord.', 'Je ne suis pas d\'accord.', 'Dites-moi plus.', 'Merci!'],
    'de': ['Interessant!', 'Ich stimme zu.', 'Ich stimme nicht zu.', 'Erzähl mir mehr.', 'Danke!'],
    'it': ['Interessante!', 'Sono d\'accordo.', 'Non sono d\'accordo.', 'Dimmi di più.', 'Grazie!']
  };
  
  return suggestions[detectedLang]?.[userLang] || genericSuggestions[detectedLang] || genericSuggestions['en'];
}