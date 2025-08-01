document.addEventListener('DOMContentLoaded', async function() {
    await i18n.init();
    updateUI();
    setupEventListeners();
    initializeSidebar();
});

async function initializeSidebar() {
    const result = await chrome.storage.sync.get(['userLanguage', 'isFirstTime']);
    
    if (!result.userLanguage || result.isFirstTime !== false) {
        showWelcomeScreen();
    } else {
        showIdleScreen();
    }
}

function setupEventListeners() {
    document.getElementById('saveLanguage').addEventListener('click', saveUserLanguage);
    document.getElementById('settingsBtn').addEventListener('click', showSettings);
    document.getElementById('changeLanguageBtn').addEventListener('click', showSettings);
    document.getElementById('translateResponse').addEventListener('click', translateUserResponse);
    document.getElementById('copyResponse').addEventListener('click', copyResponseToClipboard);
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "updateSidebar") {
            showAnalysisScreen(message.data);
        }
    });
}

async function checkUserLanguage() {
    const result = await chrome.storage.sync.get(['userLanguage']);
    if (result.userLanguage) {
        document.getElementById('nativeLanguage').value = result.userLanguage;
        i18n.setLanguage(result.userLanguage);
        updateUI();
    }
}

async function saveUserLanguage() {
    const selectedLanguage = document.getElementById('nativeLanguage').value;
    
    await chrome.storage.sync.set({ 
        userLanguage: selectedLanguage,
        isFirstTime: false
    });
    
    i18n.setLanguage(selectedLanguage);
    updateUI();
    
    showMessage(i18n.t('languageConfigured'), 'success');
    
    setTimeout(() => {
        showIdleScreen();
    }, 1500);
}

function showWelcomeScreen() {
    hideAllScreens();
    document.getElementById('welcomeScreen').classList.remove('hidden');
}

function showAnalysisScreen(data) {
    hideAllScreens();
    
    document.getElementById('originalText').textContent = data.originalText;
    document.getElementById('translationText').textContent = data.translation || 'Carregando tradução...';
    document.getElementById('contextText').textContent = data.context || 'Carregando contexto...';
    
    document.getElementById('detectedLanguage').textContent = detectLanguageFromText(data.originalText);
    document.getElementById('wordCount').textContent = `${data.originalText.split(' ').length} ${i18n.t('words')}`;
    
    displaySuggestions(data.suggestions || []);
    
    document.getElementById('analysisScreen').classList.remove('hidden');
}

function showLoadingScreen() {
    hideAllScreens();
    document.getElementById('loadingScreen').classList.remove('hidden');
}

function hideAllScreens() {
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('idleScreen').classList.add('hidden');
    document.getElementById('analysisScreen').classList.add('hidden');
    document.getElementById('loadingScreen').classList.add('hidden');
}

function displaySuggestions(suggestions) {
    const suggestionsList = document.getElementById('suggestionsList');
    suggestionsList.innerHTML = '';
    
    suggestions.forEach((suggestion, index) => {
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'suggestion-item';
        suggestionElement.textContent = suggestion;
        suggestionElement.addEventListener('click', () => selectSuggestion(suggestion, suggestionElement));
        suggestionsList.appendChild(suggestionElement);
    });
}

function selectSuggestion(suggestion, element) {
    document.querySelectorAll('.suggestion-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    element.classList.add('selected');
    
    const responseTextarea = document.getElementById('userResponse');
    const currentText = responseTextarea.value;
    
    if (currentText.trim()) {
        responseTextarea.value = currentText + ' ' + suggestion;
    } else {
        responseTextarea.value = suggestion;
    }
    
    responseTextarea.focus();
}

async function translateUserResponse() {
    const userResponse = document.getElementById('userResponse').value.trim();
    
    if (!userResponse) {
        showMessage('Escreva uma resposta primeiro', 'error');
        return;
    }
    
    const translationDiv = document.getElementById('responseTranslation');
    translationDiv.innerHTML = '<div class="loading-spinner" style="width: 16px; height: 16px; margin: 8px auto;"></div>';
    translationDiv.classList.remove('hidden');
    
    try {
        const result = await chrome.storage.sync.get(['userLanguage']);
        const userLanguage = result.userLanguage || 'pt';
        
        const response = await chrome.runtime.sendMessage({
            action: "analyzeWithAPI",
            data: {
                selectedText: userResponse,
                userLanguage: userLanguage,
                action: 'translate'
            }
        });
        
        if (response.success && response.data.translation) {
            translationDiv.innerHTML = `
                <strong>Tradução:</strong><br>
                ${response.data.translation}
            `;
        } else {
            translationDiv.innerHTML = '<em>Não foi possível traduzir no momento</em>';
        }
    } catch (error) {
        console.error('Erro ao traduzir:', error);
        translationDiv.innerHTML = '<em>Erro ao traduzir</em>';
    }
}

function copyResponseToClipboard() {
    const userResponse = document.getElementById('userResponse').value.trim();
    
    if (!userResponse) {
        showMessage('Nenhuma resposta para copiar', 'error');
        return;
    }
    
    navigator.clipboard.writeText(userResponse).then(() => {
        showMessage('Resposta copiada!', 'success');
    }).catch(() => {
        showMessage('Erro ao copiar', 'error');
    });
}

function detectLanguageFromText(text) {
    const patterns = {
        'EN': /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi,
        'ES': /\b(el|la|y|o|pero|en|de|con|por|para)\b/gi,
        'FR': /\b(le|la|et|ou|mais|dans|de|avec|pour)\b/gi,
        'PT': /\b(o|a|e|ou|mas|em|de|com|para|por)\b/gi,
        'DE': /\b(der|die|das|und|oder|aber|in|auf|mit|für)\b/gi,
        'IT': /\b(il|la|e|o|ma|in|di|con|per)\b/gi
    };
    
    let maxMatches = 0;
    let detectedLang = 'EN';
    
    for (const [lang, pattern] of Object.entries(patterns)) {
        const matches = (text.match(pattern) || []).length;
        if (matches > maxMatches) {
            maxMatches = matches;
            detectedLang = lang;
        }
    }
    
    return detectedLang;
}

async function showSettings() {
    await checkUserLanguage();
    showWelcomeScreen();
}

function updateUI() {
    // Atualizar textos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = i18n.t(key);
    });
    
    // Atualizar placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = i18n.t(key);
    });
    
    // Atualizar títulos
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = i18n.t(key);
    });
    
    // Atualizar opções do select
    const languageSelect = document.getElementById('nativeLanguage');
    if (languageSelect) {
        languageSelect.querySelectorAll('option').forEach(option => {
            const key = option.getAttribute('data-i18n');
            if (key) {
                option.textContent = i18n.t(key);
            }
        });
    }
    
    // Atualizar contadores de palavras
    const wordCountElement = document.getElementById('wordCount');
    if (wordCountElement && wordCountElement.textContent) {
        const count = wordCountElement.textContent.match(/\d+/);
        if (count) {
            wordCountElement.textContent = `${count[0]} ${i18n.t('words')}`;
        }
    }
}

function showIdleScreen() {
    hideAllScreens();
    document.getElementById('idleScreen').classList.remove('hidden');
}

function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        background-color: ${type === 'success' ? '#10b981' : '#ef4444'};
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}