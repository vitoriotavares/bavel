// Billing UI Management
class BillingUI {
    constructor() {
        this.isInitialized = false;
        this.currentSubscriptionData = null;
        this.currentUsageData = null;
        
        // Inject billing UI into the page
        this.injectBillingUI();
        this.setupEventListeners();
        this.initializeUI();
    }

    // Inject billing HTML and CSS into the page
    injectBillingUI() {
        // Inject CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = chrome.runtime.getURL('src/billing/billing-modal.css');
        document.head.appendChild(cssLink);

        // Inject HTML
        fetch(chrome.runtime.getURL('src/billing/billing-modal.html'))
            .then(response => response.text())
            .then(html => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                document.body.appendChild(tempDiv.firstElementChild);
                document.body.appendChild(tempDiv.lastElementChild);
                this.isInitialized = true;
                this.setupModalEventListeners();
            })
            .catch(error => {
                console.error('Error loading billing UI:', error);
            });
    }

    // Setup event listeners
    setupEventListeners() {
        // Listen for subscription updates
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'subscriptionUpdated') {
                this.handleSubscriptionUpdate(message.user);
                sendResponse({ success: true });
            }
            return true;
        });
    }

    // Setup modal-specific event listeners
    setupModalEventListeners() {
        // Close modal events
        document.getElementById('closeBillingModal')?.addEventListener('click', () => {
            this.hideBillingModal();
        });

        document.getElementById('billingOverlay')?.addEventListener('click', () => {
            this.hideBillingModal();
        });

        // CTA button events
        document.getElementById('startTrialBtn')?.addEventListener('click', () => {
            this.startFreeTrial();
        });

        document.getElementById('upgradeToProBtn')?.addEventListener('click', () => {
            this.upgradeToProPlan();
        });

        document.getElementById('loginBtn')?.addEventListener('click', () => {
            this.openLoginPage();
        });

        // Warning events
        document.getElementById('dismissWarning')?.addEventListener('click', () => {
            this.hideUsageWarning();
        });

        document.getElementById('upgradeFromWarning')?.addEventListener('click', () => {
            this.hideUsageWarning();
            this.showBillingModal();
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideBillingModal();
                this.hideUsageWarning();
            }
        });
    }

    // Initialize UI with current data
    async initializeUI() {
        await this.refreshSubscriptionData();
        await this.refreshUsageData();
        this.updateUI();
    }

    // Refresh subscription data from background
    async refreshSubscriptionData() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getSubscriptionStatus'
            });

            if (response.success) {
                this.currentSubscriptionData = response.data;
            } else {
                console.error('Error getting subscription status:', response.error);
            }
        } catch (error) {
            console.error('Error refreshing subscription data:', error);
        }
    }

    // Refresh usage data from background
    async refreshUsageData() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getUsageStats'
            });

            if (response.success) {
                this.currentUsageData = response.data;
            } else {
                console.error('Error getting usage stats:', response.error);
            }
        } catch (error) {
            console.error('Error refreshing usage data:', error);
        }
    }

    // Update UI elements with current data
    updateUI() {
        if (!this.isInitialized) return;

        this.updateCurrentPlanInfo();
        this.updateUsageStats();
        this.updatePricingCards();
    }

    // Update current plan information
    updateCurrentPlanInfo() {
        const planNameEl = document.getElementById('currentPlanName');
        const trialInfoEl = document.getElementById('trialInfo');
        const trialDaysEl = document.getElementById('trialDays');

        if (!planNameEl) return;

        if (this.currentSubscriptionData) {
            const { plan, isTrialActive, daysUntilTrialExpires } = this.currentSubscriptionData;
            
            // Update plan name
            const planNames = {
                'free': 'Gratuito',
                'trial': 'Teste Grátis',
                'pro': 'Pro'
            };
            
            planNameEl.textContent = planNames[plan] || 'Gratuito';
            planNameEl.className = `plan-name ${plan}`;

            // Update trial info
            if (isTrialActive && trialInfoEl && trialDaysEl) {
                trialDaysEl.textContent = `${daysUntilTrialExpires} dia${daysUntilTrialExpires !== 1 ? 's' : ''}`;
                trialInfoEl.classList.remove('hidden');
            } else if (trialInfoEl) {
                trialInfoEl.classList.add('hidden');
            }
        }
    }

    // Update usage statistics display
    updateUsageStats() {
        const dailyUsageEl = document.getElementById('dailyUsage');
        const monthlyUsageEl = document.getElementById('monthlyUsage');
        const dailyProgressEl = document.getElementById('dailyProgress');
        const monthlyProgressEl = document.getElementById('monthlyProgress');

        if (!dailyUsageEl || !this.currentUsageData) return;

        const { daily, monthly } = this.currentUsageData;

        // Update daily usage
        if (daily.limit === -1) {
            dailyUsageEl.textContent = `${daily.used}/∞`;
            dailyProgressEl.style.width = '0%';
        } else {
            dailyUsageEl.textContent = `${daily.used}/${daily.limit}`;
            dailyProgressEl.style.width = `${daily.percentage}%`;
            
            // Update progress bar color based on usage
            dailyProgressEl.className = 'usage-progress';
            if (daily.percentage >= 90) {
                dailyProgressEl.classList.add('danger');
            } else if (daily.percentage >= 70) {
                dailyProgressEl.classList.add('warning');
            }
        }

        // Update monthly usage
        if (monthly.limit === -1) {
            monthlyUsageEl.textContent = `${monthly.used}/∞`;
            monthlyProgressEl.style.width = '0%';
        } else {
            monthlyUsageEl.textContent = `${monthly.used}/${monthly.limit}`;
            monthlyProgressEl.style.width = `${monthly.percentage}%`;
            
            // Update progress bar color based on usage
            monthlyProgressEl.className = 'usage-progress';
            if (monthly.percentage >= 90) {
                monthlyProgressEl.classList.add('danger');
            } else if (monthly.percentage >= 70) {
                monthlyProgressEl.classList.add('warning');
            }
        }
    }

    // Update pricing cards based on current subscription
    updatePricingCards() {
        const trialCard = document.getElementById('trialCard');
        const proCard = document.getElementById('proCard');
        
        if (!trialCard || !this.currentSubscriptionData) return;

        const { plan, isTrialActive } = this.currentSubscriptionData;

        // Hide trial card if already used trial or is pro
        if (plan === 'pro' || (plan === 'free' && this.currentSubscriptionData.trialStartedAt)) {
            trialCard.style.display = 'none';
            proCard.style.gridColumn = '1 / -1';
        } else {
            trialCard.style.display = 'block';
            proCard.style.gridColumn = 'auto';
        }

        // Update button text if currently in trial
        if (isTrialActive) {
            const upgradeBtn = document.getElementById('upgradeToProBtn');
            if (upgradeBtn) {
                upgradeBtn.textContent = 'Continuar com Pro';
            }
        }
    }

    // Show billing modal
    showBillingModal() {
        if (!this.isInitialized) {
            setTimeout(() => this.showBillingModal(), 100);
            return;
        }

        const modal = document.getElementById('billingModal');
        if (modal) {
            this.refreshSubscriptionData().then(() => {
                this.refreshUsageData().then(() => {
                    this.updateUI();
                    modal.classList.remove('hidden');
                    document.body.style.overflow = 'hidden';
                });
            });
        }
    }

    // Hide billing modal
    hideBillingModal() {
        const modal = document.getElementById('billingModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    }

    // Show usage warning
    showUsageWarning(message) {
        if (!this.isInitialized) return;

        const warning = document.getElementById('usageLimitWarning');
        const messageEl = document.getElementById('warningMessage');
        
        if (warning && messageEl) {
            messageEl.textContent = message;
            warning.classList.remove('hidden');
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                this.hideUsageWarning();
            }, 10000);
        }
    }

    // Hide usage warning
    hideUsageWarning() {
        const warning = document.getElementById('usageLimitWarning');
        if (warning) {
            warning.classList.add('hidden');
        }
    }

    // Start free trial
    async startFreeTrial() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'startFreeTrial'
            });

            if (response.success) {
                console.log('Trial started successfully');
                // Modal will be updated automatically when subscription changes
            } else {
                console.error('Error starting trial:', response.error);
            }
        } catch (error) {
            console.error('Error starting free trial:', error);
        }
    }

    // Upgrade to Pro plan
    async upgradeToProPlan() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'openUpgradePage'
            });

            if (response.success) {
                console.log('Upgrade page opened');
            } else {
                console.error('Error opening upgrade page:', response.error);
            }
        } catch (error) {
            console.error('Error upgrading to pro:', error);
        }
    }

    // Open login page
    async openLoginPage() {
        try {
            await chrome.runtime.sendMessage({
                action: 'openLoginPage'
            });
        } catch (error) {
            console.error('Error opening login page:', error);
        }
    }

    // Handle subscription updates
    handleSubscriptionUpdate(userData) {
        console.log('Subscription updated:', userData);
        this.refreshSubscriptionData().then(() => {
            this.refreshUsageData().then(() => {
                this.updateUI();
                
                // Show success message or update UI accordingly
                if (userData.paid) {
                    this.hideBillingModal();
                    this.hideUsageWarning();
                    // Could show a success notification here
                }
            });
        });
    }

    // Check if user should see upgrade prompts
    shouldPromptUpgrade() {
        if (!this.currentSubscriptionData || !this.currentUsageData) return false;
        
        const { plan } = this.currentSubscriptionData;
        const { daily, monthly } = this.currentUsageData;
        
        return plan === 'free' && (daily.percentage >= 80 || monthly.percentage >= 80);
    }

    // Get upgrade suggestion message
    getUpgradeSuggestionMessage() {
        if (!this.currentUsageData) return null;
        
        const { daily, monthly } = this.currentUsageData;
        
        if (daily.percentage >= 100) {
            return 'Você atingiu seu limite diário de traduções. Faça upgrade para continuar!';
        } else if (monthly.percentage >= 100) {
            return 'Você atingiu seu limite mensal de respostas. Faça upgrade para continuar!';
        } else if (daily.percentage >= 80 || monthly.percentage >= 80) {
            return 'Você está próximo dos seus limites. Considere fazer upgrade para uso ilimitado.';
        }
        
        return null;
    }
}

// Export for use in sidebar
if (typeof window !== 'undefined') {
    window.BillingUI = BillingUI;
}