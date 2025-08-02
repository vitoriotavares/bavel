# ExtensionPay Setup Guide - Bavel Extension

Este guia te ajudará a configurar a monetização da extensão Bavel usando ExtensionPay + Stripe.

## 📋 Pré-requisitos

1. **Conta Stripe**: Crie uma conta em [stripe.com](https://stripe.com)
2. **ExtensionPay Account**: Registre-se em [extensionpay.com](https://extensionpay.com)
3. **Extension ID**: Sua extensão deve estar publicada na Chrome Web Store (ou usar um ID fixo para desenvolvimento)

## 🔧 Passo 1: Configurar ExtensionPay

### 1.1 Criar Nova Extensão no ExtensionPay
1. Acesse [extensionpay.com](https://extensionpay.com) e faça login
2. Clique em "Add Extension"
3. Insira os dados da sua extensão:
   - **Extension Name**: Bavel
   - **Extension ID**: [SEU_EXTENSION_ID_AQUI]
   - **Chrome Web Store URL**: URL da sua extensão na loja

### 1.2 Conectar com Stripe
1. No dashboard do ExtensionPay, vá para sua extensão
2. Clique em "Connect Stripe Account"
3. Faça login na sua conta Stripe e autorize a conexão
4. Anote seu **Extension ID** do ExtensionPay (diferente do Chrome Extension ID)

## 🛠 Passo 2: Configurar a Extensão

### 2.1 Atualizar Extension ID
Edite o arquivo `src/billing/subscription-manager.js`:

```javascript
// Linha 13: Substitua 'bavel-extension-id' pelo seu Extension ID do ExtensionPay
this.extpay = ExtPay('SEU_EXTENSION_ID_DO_EXTENSIONPAY');
```

### 2.2 Configurar Planos de Preços

No dashboard do ExtensionPay:

1. **Plano Free Trial (7 dias)**:
   - Type: Trial
   - Duration: 7 days
   - Price: $0.00

2. **Plano Pro Monthly**:
   - Type: Subscription
   - Price: $4.99
   - Interval: Monthly
   - Name: "Pro Monthly"

3. **Plano Pro Yearly** (opcional):
   - Type: Subscription
   - Price: $39.99
   - Interval: Yearly
   - Name: "Pro Yearly"

## 📦 Passo 3: Testar a Implementação

### 3.1 Desenvolvimento Local
1. Carregue a extensão no Chrome (modo desenvolvedor)
2. Teste o fluxo de upgrade:
   ```javascript
   // No console da extensão
   chrome.runtime.sendMessage({action: 'getSubscriptionStatus'});
   ```

### 3.2 Testar Fluxo de Pagamento
1. Clique no botão "Upgrade" na sidebar
2. Verifique se o modal de billing aparece
3. Teste o botão "Iniciar Teste Grátis"
4. Teste o botão "Fazer Upgrade Agora"

### 3.3 Verificar Logs
Monitore os logs no console da extensão:
```javascript
// Background script logs
console.log('Billing system initialized successfully');
console.log('Subscription updated:', userData);

// Sidebar logs
console.log('Billing UI initialized successfully');
```

## 🚀 Passo 4: Deploy para Produção

### 4.1 Ambiente de Produção
1. No ExtensionPay, configure o ambiente de produção
2. Ative o modo "Live" no Stripe
3. Atualize as chaves de API se necessário

### 4.2 Publicar na Chrome Web Store
1. Crie um ZIP da extensão:
   ```bash
   cd bavel
   zip -r bavel-extension.zip . -x "*.git*" "node_modules/*" "*.DS_Store"
   ```

2. Upload no Chrome Web Store Developer Dashboard
3. Aguarde aprovação (pode levar alguns dias)

## 🔍 Debugging Comum

### Problema: ExtensionPay não inicializa
```javascript
// Verifique se o Extension ID está correto
console.log('Extension ID:', chrome.runtime.id);

// Verifique logs de erro
chrome.runtime.onMessage.addListener((message) => {
    console.log('Message received:', message);
});
```

### Problema: Storage permission
Certifique-se que `"storage"` está nas permissions do manifest.json:
```json
{
  "permissions": [
    "storage",
    // ... outras permissions
  ]
}
```

### Problema: Content script não carrega
Verifique se o content script do ExtensionPay está configurado:
```json
{
  "content_scripts": [
    {
      "matches": ["https://extensionpay.com/*"],
      "js": ["src/lib/extpay.js"],
      "run_at": "document_start"
    }
  ]
}
```

## 📊 Monitoramento

### Dashboard ExtensionPay
- **Revenue**: Receita total e por período
- **Subscriptions**: Usuários ativos por plano
- **Churn Rate**: Taxa de cancelamento
- **Conversion**: Taxa de conversão free → paid

### Analytics Recomendados
```javascript
// Rastrear eventos importantes
analytics.track('trial_started', {
    extension_id: 'bavel',
    user_id: user.id
});

analytics.track('subscription_created', {
    plan: 'pro_monthly',
    amount: 4.99
});
```

## 💰 Estrutura de Custos

### ExtensionPay Fees
- **5% + Stripe fees** para transações processadas
- **Sem taxas mensais fixas**
- **Sem custo de setup**

### Projeção de Receita (Exemplo)
- 1000 usuários gratuitos
- 5% conversion rate = 50 usuários pagos
- 50 × $4.99 = $249.50/mês
- Menos fees (≈15%) = $212/mês líquido

## 🔐 Segurança

### Validação Server-side
O ExtensionPay já inclui validação server-side, mas você pode adicionar verificações extras:

```javascript
// Verificar assinatura válida antes de processar requests
if (!user.paid && dailyUsage >= FREE_LIMIT) {
    throw new Error('Upgrade required');
}
```

### Rate Limiting
O sistema já inclui rate limiting baseado no plano, mas monitore para evitar abusos.

## 📞 Suporte

- **ExtensionPay Support**: support@extensionpay.com
- **Stripe Support**: Através do dashboard Stripe
- **Documentação**: [ExtensionPay Docs](https://extensionpay.com/docs)

---

## ✅ Checklist Final

- [ ] ExtensionPay account criada e configurada
- [ ] Stripe account conectada
- [ ] Extension ID atualizado no código
- [ ] Planos de preço configurados
- [ ] Content script do ExtensionPay adicionado
- [ ] Fluxo de upgrade testado
- [ ] Logs de debugging verificados
- [ ] Extension publicada na Chrome Web Store
- [ ] Analytics e monitoramento configurados

**🎉 Sua extensão está pronta para gerar receita!**