// Background Script de Debug - Versão Simplificada
console.log('🚀 Background script starting...');

// Teste básico de inicialização
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Extension installed');
  
  // Criar menu de contexto simples
  chrome.contextMenus.create({
    id: "bavel-test",
    title: "Teste Bavel",
    contexts: ["selection"]
  });
});

// Listener de menu de contexto
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('🖱️ Context menu clicked:', info.menuItemId);
  
  if (info.menuItemId === "bavel-test") {
    console.log('📝 Selected text:', info.selectionText);
    console.log('📄 Tab info:', { id: tab.id, url: tab.url });
    
    try {
      // Tentar abrir sidebar
      await chrome.sidePanel.open({ tabId: tab.id });
      console.log('✅ Sidebar opened successfully');
      
      // Primeiro, tentar injetar o content script manualmente
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content-debug.js']
        });
        console.log('✅ Content script injected manually');
        
        // Aguardar um pouco para o script carregar
        setTimeout(() => {
          // Tentar enviar mensagem para content script
          chrome.tabs.sendMessage(tab.id, {
            action: "testMessage",
            text: info.selectionText
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Message to content script failed:', chrome.runtime.lastError);
            } else {
              console.log('✅ Message to content script successful:', response);
            }
          });
        }, 500);
        
      } catch (injectError) {
        console.error('❌ Failed to inject content script:', injectError);
        
        // Tentar enviar mensagem mesmo assim
        chrome.tabs.sendMessage(tab.id, {
          action: "testMessage",
          text: info.selectionText
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Message to content script failed (no manual injection):', chrome.runtime.lastError);
          } else {
            console.log('✅ Message to content script successful (automatic injection worked):', response);
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Error opening sidebar:', error);
    }
  }
});

// Listener de mensagens
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message.action, 'from:', sender.tab?.id || 'popup/sidebar');
  
  try {
    switch (message.action) {
      case 'testMessage':
        sendResponse({ success: true, message: 'Background received test message' });
        break;
      
      case 'ping':
        sendResponse({ success: true, message: 'pong' });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action: ' + message.action });
    }
  } catch (error) {
    console.error('❌ Error in message handler:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return false; // Resposta síncrona
});

console.log('✅ Background script loaded successfully');