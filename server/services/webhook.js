const axios = require('axios');

/**
 * Triggers the Make.com webhook with the exact payload provided.
 * Does not block main execution thread. If it fails, it logs the error.
 * 
 * @param {object} payload - The JSON body to send to the webhook
 * @param {string} [context] - Context name for console logging
 */
async function triggerWebhook(payload, context = 'generic') {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(`[Webhook] MAKE_WEBHOOK_URL environment variable is not configured. Webhook for "${context}" skipped.`);
    return;
  }

  try {
    console.log(`[Webhook] Triggering Make.com webhook for "${context}"...`);
    const response = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000 // 8s timeout to prevent hanging connections
    });
    console.log(`[Webhook] Success. Make.com responded with status: ${response.status}`);
  } catch (error) {
    console.error(`❌ [Webhook Error] Failed to send webhook for "${context}":`, error.message);
  }
}

/**
 * Convenience helper to send a welcome email webhook.
 * Sends exactly { name, email } as required.
 * 
 * @param {string} name - The user's name
 * @param {string} email - The user's email
 */
function sendWelcomeWebhook(name, email) {
  triggerWebhook({ name, email }, 'user_registration');
}

module.exports = {
  triggerWebhook,
  sendWelcomeWebhook
};
