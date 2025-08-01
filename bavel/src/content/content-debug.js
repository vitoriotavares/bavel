// Content Script de Debug - Versão Simplificada
console.log('🌐 Content script loaded on:', window.location.href);

// Listener para mensagens do background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content script received message:', message.action);
  
  try {
    switch (message.action) {
      case 'testMessage':
        console.log('✅ Test message received:', message.text);
        sendResponse({ success: true, message: 'Content script processed test message' });
        break;
        
      default:
        console.log('❓ Unknown action:', message.action);
        sendResponse({ success: false, error: 'Unknown action: ' + message.action });
    }
  } catch (error) {
    console.error('❌ Error in content script message handler:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return false; // Resposta síncrona
});

// Teste de comunicação com background
setTimeout(() => {
  console.log('🧪 Testing communication with background...');
  
  chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Ping failed:', chrome.runtime.lastError);
    } else {
      console.log('✅ Ping successful:', response);
    }
  });
}, 1000);

console.log('✅ Content script initialized');