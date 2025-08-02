// Usage Tracker for Bavel Extension
// Tracks daily/monthly usage and enforces limits based on subscription plan

class UsageTracker {
    constructor() {
        this.limits = {
            free: {
                dailyTranslations: 10,
                monthlyResponses: 50
            },
            trial: {
                dailyTranslations: -1, // unlimited during trial
                monthlyResponses: -1
            },
            pro: {
                dailyTranslations: -1, // unlimited for pro
                monthlyResponses: -1
            }
        };
    }

    // Get current usage data from storage
    async getCurrentUsage() {
        const result = await chrome.storage.sync.get(['bavel_usage']);
        const today = this.getTodayString();
        const thisMonth = this.getThisMonthString();
        
        const defaultUsage = {
            daily: {
                date: today,
                translations: 0
            },
            monthly: {
                month: thisMonth,
                responses: 0
            },
            lastReset: Date.now()
        };

        const usage = result.bavel_usage || defaultUsage;
        
        // Reset daily counter if it's a new day
        if (usage.daily.date !== today) {
            usage.daily = {
                date: today,
                translations: 0
            };
        }
        
        // Reset monthly counter if it's a new month
        if (usage.monthly.month !== thisMonth) {
            usage.monthly = {
                month: thisMonth,
                responses: 0
            };
        }

        return usage;
    }

    // Save usage data to storage
    async saveUsage(usage) {
        await chrome.storage.sync.set({ bavel_usage: usage });
    }

    // Get today's date string (YYYY-MM-DD)
    getTodayString() {
        return new Date().toISOString().split('T')[0];
    }

    // Get this month's string (YYYY-MM)
    getThisMonthString() {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    // Check if user can make a translation request
    async canMakeTranslation(subscriptionPlan = 'free') {
        const usage = await this.getCurrentUsage();
        const limit = this.limits[subscriptionPlan]?.dailyTranslations || this.limits.free.dailyTranslations;
        
        // -1 means unlimited
        if (limit === -1) return true;
        
        return usage.daily.translations < limit;
    }

    // Check if user can generate response suggestions
    async canGenerateResponse(subscriptionPlan = 'free') {
        const usage = await this.getCurrentUsage();
        const limit = this.limits[subscriptionPlan]?.monthlyResponses || this.limits.free.monthlyResponses;
        
        // -1 means unlimited
        if (limit === -1) return true;
        
        return usage.monthly.responses < limit;
    }

    // Record a translation usage
    async recordTranslation() {
        const usage = await this.getCurrentUsage();
        usage.daily.translations += 1;
        await this.saveUsage(usage);
        
        console.log(`Translation recorded. Daily count: ${usage.daily.translations}`);
        return usage.daily.translations;
    }

    // Record a response generation usage
    async recordResponse() {
        const usage = await this.getCurrentUsage();
        usage.monthly.responses += 1;
        await this.saveUsage(usage);
        
        console.log(`Response recorded. Monthly count: ${usage.monthly.responses}`);
        return usage.monthly.responses;
    }

    // Get usage statistics for UI display
    async getUsageStats(subscriptionPlan = 'free') {
        const usage = await this.getCurrentUsage();
        const limits = this.limits[subscriptionPlan] || this.limits.free;
        
        return {
            daily: {
                used: usage.daily.translations,
                limit: limits.dailyTranslations,
                remaining: limits.dailyTranslations === -1 ? -1 : Math.max(0, limits.dailyTranslations - usage.daily.translations),
                percentage: limits.dailyTranslations === -1 ? 0 : Math.min(100, (usage.daily.translations / limits.dailyTranslations) * 100)
            },
            monthly: {
                used: usage.monthly.responses,
                limit: limits.monthlyResponses,
                remaining: limits.monthlyResponses === -1 ? -1 : Math.max(0, limits.monthlyResponses - usage.monthly.responses),
                percentage: limits.monthlyResponses === -1 ? 0 : Math.min(100, (usage.monthly.responses / limits.monthlyResponses) * 100)
            },
            plan: subscriptionPlan
        };
    }

    // Check if user is approaching limits (80% threshold)
    async isApproachingLimits(subscriptionPlan = 'free') {
        const stats = await this.getUsageStats(subscriptionPlan);
        
        return {
            daily: stats.daily.limit !== -1 && stats.daily.percentage >= 80,
            monthly: stats.monthly.limit !== -1 && stats.monthly.percentage >= 80
        };
    }

    // Get user-friendly usage description
    async getUsageDescription(subscriptionPlan = 'free') {
        const stats = await this.getUsageStats(subscriptionPlan);
        
        let descriptions = [];
        
        if (stats.daily.limit === -1) {
            descriptions.push('Traduções ilimitadas hoje');
        } else {
            descriptions.push(`${stats.daily.used}/${stats.daily.limit} traduções hoje`);
        }
        
        if (stats.monthly.limit === -1) {
            descriptions.push('Respostas ilimitadas este mês');
        } else {
            descriptions.push(`${stats.monthly.used}/${stats.monthly.limit} respostas este mês`);
        }
        
        return descriptions;
    }

    // Reset usage (mainly for testing)
    async resetUsage() {
        await chrome.storage.sync.remove(['bavel_usage']);
        console.log('Usage data reset');
    }

    // Get upgrade suggestion based on usage patterns
    async getUpgradeSuggestion(subscriptionPlan = 'free') {
        if (subscriptionPlan !== 'free') return null;
        
        const stats = await this.getUsageStats(subscriptionPlan);
        const approaching = await this.isApproachingLimits(subscriptionPlan);
        
        if (stats.daily.percentage >= 100 || stats.monthly.percentage >= 100) {
            return {
                urgency: 'high',
                message: 'Você atingiu seus limites! Faça upgrade para continuar usando o Bavel.',
                cta: 'Fazer Upgrade Agora'
            };
        } else if (approaching.daily || approaching.monthly) {
            return {
                urgency: 'medium',
                message: 'Você está próximo dos seus limites. Considere fazer upgrade para uso ilimitado.',
                cta: 'Ver Planos Pro'
            };
        }
        
        return null;
    }

    // Format usage for logging
    formatUsageForLog(usage) {
        return `Daily: ${usage.daily.translations} translations (${usage.daily.date}), Monthly: ${usage.monthly.responses} responses (${usage.monthly.month})`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UsageTracker;
}