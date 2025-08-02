// Global billing UI instance
let billingUI;

document.addEventListener('DOMContentLoaded', async function() {
    await i18n.init();
    updateUI();
    setupEventListeners();
    initializeBilling();
    initializeSidebar();
});

// Initialize billing system
function initializeBilling() {
    try {
        billingUI = new BillingUI();
        console.log('Billing UI initialized successfully');
        
        // Update header with subscription info
        updateHeaderWithSubscriptionInfo();
        
        // Set up periodic updates (every 30 seconds)
        setInterval(updateHeaderWithSubscriptionInfo, 30000);
    } catch (error) {
        console.error('Error initializing billing UI:', error);
    }
}

// Update header with subscription and usage information
async function updateHeaderWithSubscriptionInfo() {
    try {
        // Get subscription status
        const subscriptionResponse = await chrome.runtime.sendMessage({
            action: 'getSubscriptionStatus'
        });
        
        // Get usage stats
        const usageResponse = await chrome.runtime.sendMessage({
            action: 'getUsageStats'
        });
        
        if (subscriptionResponse.success && usageResponse.success) {
            const subscription = subscriptionResponse.data;
            const usage = usageResponse.data;
            
            updateHeaderPlanInfo(subscription, usage);
        }
    } catch (error) {
        console.error('Error updating header subscription info:', error);
    }
}

// Update header plan information
function updateHeaderPlanInfo(subscription, usage) {
    const planNameEl = document.getElementById('headerPlanName');
    const usageTextEl = document.getElementById('headerUsageText');
    const upgradeBtn = document.getElementById('upgradeBtn');
    const planBadge = document.getElementById('planBadge');
    
    if (!planNameEl) return;
    
    // Update plan name
    const planNames = {
        'free': 'Free',
        'trial': 'Trial',
        'pro': 'Pro'
    };
    
    planNameEl.textContent = planNames[subscription.plan] || 'Free';
    
    // Update plan badge styling
    planBadge.className = `plan-badge ${subscription.plan}`;
    
    // Update usage text
    if (usage.daily.limit === -1) {
        usageTextEl.textContent = '∞ hoje';
    } else {
        usageTextEl.textContent = `${usage.daily.used}/${usage.daily.limit} hoje`;
    }
    
    // Show/hide upgrade button
    if (subscription.plan === 'free' || (subscription.plan === 'trial' && subscription.daysUntilTrialExpires <= 2)) {
        upgradeBtn.classList.remove('hidden');
    } else {
        upgradeBtn.classList.add('hidden');
    }
    
    // Update usage color based on percentage
    if (usage.daily.percentage >= 90) {
        usageTextEl.className = 'usage-text danger';
    } else if (usage.daily.percentage >= 70) {
        usageTextEl.className = 'usage-text warning';
    } else {
        usageTextEl.className = 'usage-text';
    }
}

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
    
    // Billing-related event listeners
    document.getElementById('upgradeBtn')?.addEventListener('click', () => {
        if (billingUI) {
            billingUI.showBillingModal();
        }
    });
    
    // Setup modern language selector
    setupModernLanguageSelector();
    
    // Setup modern tabs
    setupModernTabs();
    
    // Setup copy translation button
    setupCopyTranslationButton();
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Sidebar received message:', message);
        
        if (message.action === "showLoading") {
            showLoadingScreen(message.data);
            sendResponse({ success: true });
        }
        
        if (message.action === "updateSidebar") {
            showAnalysisScreen(message.data);
            sendResponse({ success: true });
        }
        
        return true;
    });
}

function setupModernLanguageSelector() {
    const langOptions = document.querySelectorAll('.lang-option');
    const saveButton = document.getElementById('saveLanguage');
    const hiddenSelect = document.getElementById('nativeLanguage');
    
    langOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all options
            langOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Add selected class to clicked option
            option.classList.add('selected');
            
            // Update hidden select value for compatibility
            const selectedValue = option.getAttribute('data-value');
            hiddenSelect.value = selectedValue;
            
            // Enable save button
            saveButton.disabled = false;
        });
    });
}

async function checkUserLanguage() {
    const result = await chrome.storage.sync.get(['userLanguage']);
    if (result.userLanguage) {
        // Update hidden select
        document.getElementById('nativeLanguage').value = result.userLanguage;
        
        // Update modern selector
        const selectedOption = document.querySelector(`.lang-option[data-value="${result.userLanguage}"]`);
        if (selectedOption) {
            document.querySelectorAll('.lang-option').forEach(opt => opt.classList.remove('selected'));
            selectedOption.classList.add('selected');
            document.getElementById('saveLanguage').disabled = false;
        }
        
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
    
    // Preencher dados nos novos elementos
    document.getElementById('originalText').textContent = data.originalText;
    document.getElementById('translationText').textContent = data.translation || 'Carregando tradução...';
    document.getElementById('contextText').textContent = data.context || 'Carregando contexto...';
    
    // Atualizar header moderno com informações de idioma
    const detectedLang = detectLanguageFromText(data.originalText);
    const detectedLanguageElement = document.getElementById('detectedLanguage');
    detectedLanguageElement.textContent = detectedLang;
    detectedLanguageElement.className = 'lang-badge';
    
    // Atualizar badge do idioma nativo
    updateNativeLanguageBadge();
    
    // Atualizar contador de palavras
    const wordCount = data.originalText.split(' ').length;
    document.getElementById('wordCount').textContent = `${wordCount} ${i18n.t('words')}`;
    
    // Preencher sugestões
    displaySuggestions(data.suggestions || []);
    
    // Garantir que a primeira tab (Translation) está ativa
    setActiveTab('translation');
    
    document.getElementById('analysisScreen').classList.remove('hidden');
}

function showLoadingScreen(data) {
    hideAllScreens();
    
    // Atualizar texto de loading se fornecido
    if (data && data.originalText) {
        const loadingText = document.querySelector('#loadingScreen .loading-main-text');
        if (loadingText) {
            loadingText.textContent = `${i18n.t('analyzing')} "${data.originalText.substring(0, 50)}${data.originalText.length > 50 ? '...' : ''}"`;
        }
    }
    
    // Resetar steps
    const steps = document.querySelectorAll('.loading-step');
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index === 0) step.classList.add('active');
    });
    
    // Animar steps
    animateLoadingSteps();
    
    document.getElementById('loadingScreen').classList.remove('hidden');
}

function animateLoadingSteps() {
    const steps = document.querySelectorAll('.loading-step');
    let currentStep = 0;
    
    const interval = setInterval(() => {
        if (currentStep < steps.length) {
            // Marcar step atual como completed
            if (currentStep > 0) {
                steps[currentStep - 1].classList.remove('active');
                steps[currentStep - 1].classList.add('completed');
            }
            
            // Ativar próximo step
            if (currentStep < steps.length) {
                steps[currentStep].classList.add('active');
            }
            
            currentStep++;
        }
        
        // Parar quando todos os steps estiverem completos
        if (currentStep > steps.length) {
            clearInterval(interval);
        }
    }, 1000); // 1 segundo entre cada step
    
    // Limpar interval quando sair da tela de loading
    window.loadingInterval = interval;
}

function hideAllScreens() {
    // Limpar loading interval se existir
    if (window.loadingInterval) {
        clearInterval(window.loadingInterval);
        window.loadingInterval = null;
    }
    
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
            // Update header info after successful request
            updateHeaderWithSubscriptionInfo();
            
            let translationHTML = `
                <div class="translation-result">
                    <strong>${i18n.t('translationLabel')}</strong>
                    <div class="translation-text">${response.data.translation}</div>
            `;
            
            // Mostrar confiança se disponível
            if (response.data.confidence) {
                const confidencePercent = Math.round(response.data.confidence * 100);
                translationHTML += `
                    <div class="translation-confidence">
                        <small>${i18n.t('confidence')}: ${confidencePercent}%</small>
                    </div>
                `;
            }
            
            // Mostrar alternativas se disponíveis
            if (response.data.alternatives && response.data.alternatives.length > 0) {
                translationHTML += `
                    <div class="translation-alternatives">
                        <strong>${i18n.t('alternatives')}:</strong>
                        <div class="alternatives-list">
                `;
                
                response.data.alternatives.forEach((alt, index) => {
                    translationHTML += `
                        <div class="alternative-item" onclick="selectAlternative('${alt.replace(/'/g, "\\'")}')">
                            ${index + 1}. ${alt}
                        </div>
                    `;
                });
                
                translationHTML += `
                        </div>
                    </div>
                `;
            }
            
            translationHTML += '</div>';
            translationDiv.innerHTML = translationHTML;
        } else {
            // Check if it's a billing-related error
            if (response.needsUpgrade) {
                translationDiv.innerHTML = `
                    <div class="upgrade-prompt">
                        <p><em>${response.error}</em></p>
                        <button class="upgrade-prompt-btn" onclick="billingUI?.showBillingModal()">
                            Ver Planos
                        </button>
                    </div>
                `;
                
                // Also show the usage warning
                if (billingUI) {
                    billingUI.showUsageWarning(response.error);
                }
            } else {
                translationDiv.innerHTML = '<em>Não foi possível traduzir no momento</em>';
            }
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

// Função global para seleção de alternativas
window.selectAlternative = function(alternativeText) {
    const responseTextarea = document.getElementById('userResponse');
    responseTextarea.value = alternativeText;
    responseTextarea.focus();
    
    // Esconder a tradução após seleção
    const translationDiv = document.getElementById('responseTranslation');
    translationDiv.classList.add('hidden');
    
    showMessage(i18n.t('alternativeSelected'), 'success');
};

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

// Modern Tabs Functionality
function setupModernTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Show corresponding tab content
            const targetContent = document.getElementById(targetTab + 'Tab');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// Modern Copy Translation Functionality
function setupCopyTranslationButton() {
    const copyTranslationBtn = document.getElementById('copyTranslation');
    if (copyTranslationBtn) {
        copyTranslationBtn.addEventListener('click', copyTranslationToClipboard);
    }
}

function copyTranslationToClipboard() {
    const translationText = document.getElementById('translationText').textContent.trim();
    
    if (!translationText || translationText === 'Carregando tradução...') {
        showMessage('Nenhuma tradução disponível para copiar', 'error');
        return;
    }
    
    navigator.clipboard.writeText(translationText).then(() => {
        showMessage('Tradução copiada!', 'success');
        
        // Add visual feedback to button
        const copyBtn = document.getElementById('copyTranslation');
        const originalColor = copyBtn.style.color;
        copyBtn.style.color = '#34a853';
        setTimeout(() => {
            copyBtn.style.color = originalColor;
        }, 1000);
    }).catch(() => {
        showMessage('Erro ao copiar tradução', 'error');
    });
}

// Helper function to update native language badge
async function updateNativeLanguageBadge() {
    const result = await chrome.storage.sync.get(['userLanguage']);
    const userLanguage = result.userLanguage || 'pt';
    
    // Map language codes to display names
    const languageNames = {
        'pt': 'Português',
        'en': 'English',
        'es': 'Español',
        'fr': 'Français',
        'de': 'Deutsch',
        'it': 'Italiano'
    };
    
    const nativeLangBadge = document.querySelector('.native-lang');
    if (nativeLangBadge) {
        nativeLangBadge.textContent = languageNames[userLanguage] || userLanguage.toUpperCase();
    }
}

// Helper function to set active tab
function setActiveTab(tabName) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Remove active class from all
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Set active tab
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(tabName + 'Tab');
    
    if (activeButton) activeButton.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
}