// Subscription Manager for Bavel Extension
// Integrates with ExtensionPay for handling billing and subscription management

class SubscriptionManager {
    constructor() {
        // ExtensionPay integration - You'll need to replace 'your-extension-id' with actual ID
        this.extpay = ExtPay('bavel-extension-id'); // Replace with your actual extension ID from ExtensionPay
        this.extpay.startBackground();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Cache for user data
        this.userCache = null;
        this.lastCacheUpdate = null;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    }

    setupEventListeners() {
        // Listen for successful payments
        this.extpay.onPaid.addListener((user) => {
            console.log('User successfully upgraded:', user);
            this.userCache = user;
            this.lastCacheUpdate = Date.now();
            this.broadcastSubscriptionUpdate(user);
        });

        // Listen for trial starts
        this.extpay.onTrialStarted.addListener((user) => {
            console.log('User started trial:', user);
            this.userCache = user;
            this.lastCacheUpdate = Date.now();
            this.broadcastSubscriptionUpdate(user);
        });
    }

    // Get current user subscription status
    async getUserStatus() {
        // Return cached data if fresh
        if (this.userCache && this.lastCacheUpdate && 
            (Date.now() - this.lastCacheUpdate) < this.CACHE_DURATION) {
            return this.userCache;
        }

        try {
            const user = await this.extpay.getUser();
            this.userCache = user;
            this.lastCacheUpdate = Date.now();
            return user;
        } catch (error) {
            console.error('Error fetching user status:', error);
            // Return basic free user structure on error
            return {
                paid: false,
                paidAt: null,
                installedAt: new Date(),
                trialStartedAt: null
            };
        }
    }

    // Check if user has active subscription
    async hasActiveSubscription() {
        const user = await this.getUserStatus();
        return user.paid || this.isTrialActive(user);
    }

    // Check if trial is active
    isTrialActive(user) {
        if (!user.trialStartedAt) return false;
        
        // Trial lasts 7 days
        const trialEndTime = new Date(user.trialStartedAt);
        trialEndTime.setDate(trialEndTime.getDate() + 7);
        
        return new Date() < trialEndTime;
    }

    // Get subscription plan type
    async getSubscriptionPlan() {
        const user = await this.getUserStatus();
        
        if (user.paid) {
            return 'pro';
        } else if (this.isTrialActive(user)) {
            return 'trial';
        } else {
            return 'free';
        }
    }

    // Open payment page
    async openUpgradePage() {
        try {
            await this.extpay.openPaymentPage();
        } catch (error) {
            console.error('Error opening payment page:', error);
        }
    }

    // Start free trial
    async startFreeTrial() {
        try {
            await this.extpay.openTrialPage('7 days');
        } catch (error) {
            console.error('Error starting trial:', error);
        }
    }

    // Open login page for existing customers
    async openLoginPage() {
        try {
            await this.extpay.openLoginPage();
        } catch (error) {
            console.error('Error opening login page:', error);
        }
    }

    // Get available plans
    async getAvailablePlans() {
        try {
            return await this.extpay.getPlans();
        } catch (error) {
            console.error('Error fetching plans:', error);
            return [];
        }
    }

    // Broadcast subscription updates to all extension components
    broadcastSubscriptionUpdate(user) {
        // Send message to all tabs and extension components
        chrome.runtime.sendMessage({
            action: 'subscriptionUpdated',
            user: user
        }).catch(() => {
            // Ignore errors if no listeners
        });

        // Also send to all tabs if needed
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'subscriptionUpdated',
                    user: user
                }).catch(() => {
                    // Ignore errors for tabs that don't have content script
                });
            });
        });
    }

    // Force refresh user data
    async refreshUserStatus() {
        this.userCache = null;
        this.lastCacheUpdate = null;
        return await this.getUserStatus();
    }

    // Get days until trial expires (if in trial)
    async getDaysUntilTrialExpires() {
        const user = await this.getUserStatus();
        if (!user.trialStartedAt) return null;

        const trialEndTime = new Date(user.trialStartedAt);
        trialEndTime.setDate(trialEndTime.getDate() + 7);
        
        const now = new Date();
        const diffTime = trialEndTime - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return Math.max(0, diffDays);
    }

    // Get subscription status for UI display
    async getSubscriptionStatusForUI() {
        const user = await this.getUserStatus();
        const plan = await this.getSubscriptionPlan();
        
        const status = {
            plan: plan,
            isPaid: user.paid,
            isTrialActive: this.isTrialActive(user),
            paidAt: user.paidAt,
            trialStartedAt: user.trialStartedAt,
            installedAt: user.installedAt
        };

        if (status.isTrialActive) {
            status.daysUntilTrialExpires = await this.getDaysUntilTrialExpires();
        }

        return status;
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubscriptionManager;
}