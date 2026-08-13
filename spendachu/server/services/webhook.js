const axios = require('axios');
const nodemailer = require('nodemailer');

const DEFAULT_MAKE_WEBHOOK = 'https://hook.us2.make.com/fituzs53nv15rjq3th8dbwbdwgmtjjbi';

/**
 * Triggers the Make.com webhook with the exact payload provided.
 * Does not block main execution thread. If it fails, it logs the error.
 * 
 * @param {object} payload - The JSON body to send to the webhook
 * @param {string} [context] - Context name for console logging
 */
async function triggerWebhook(payload, context = 'generic') {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL || DEFAULT_MAKE_WEBHOOK;

  try {
    console.log(`[Webhook] Triggering Make.com webhook for "${context}" to ${webhookUrl}...`);
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
 * Sends a direct welcome email via SMTP as a dual-channel / backup mechanism.
 * 
 * @param {string} name 
 * @param {string} email 
 */
async function sendDirectWelcomeEmail(name, email) {
  const mailHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const mailPort = parseInt(process.env.SMTP_PORT || '587');
  const mailUser = process.env.SMTP_USER || 'spendachu@gmail.com';
  const mailPass = process.env.SMTP_PASS || 'iusq dkvm gcow heqn';

  if (!mailUser || !mailPass) return;

  try {
    const transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailPort === 465,
      auth: { user: mailUser, pass: mailPass },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: `"SpendAchu" <${mailUser}>`,
      to: email,
      subject: `Welcome to SpendAchu, ${name}! 🎉`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0284c7; margin: 0; font-size: 24px;">SpendAchu</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Smart Expense & Savings Companion</p>
          </div>
          <h2 style="color: #0f172a; font-size: 20px;">Welcome aboard, ${name}! 🎉</h2>
          <p style="color: #334155; line-height: 1.6; font-size: 15px;">
            Thank you for creating an account with SpendAchu! We're excited to have you on board.
          </p>
          <p style="color: #334155; line-height: 1.6; font-size: 15px;">
            With SpendAchu, you can:
          </p>
          <ul style="color: #334155; line-height: 1.8; font-size: 14px;">
            <li>📊 Easily log and categorize your daily expenses</li>
            <li>💳 Set custom category budget limits</li>
            <li>🐷 Track your savings and backup funds</li>
            <li>🤖 Ask financial questions to your AI assistant</li>
          </ul>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
          <p style="color: #64748b; font-size: 13px; text-align: center;">
            Have questions or feedback? Reply directly to this email or reach us at <a href="mailto:spendachu@gmail.com" style="color: #0284c7; text-decoration: none; font-weight: bold;">spendachu@gmail.com</a>.
          </p>
        </div>
      `
    });
    console.log(`✉️ [Welcome Email] Direct email successfully sent to ${email}`);
  } catch (err) {
    console.error(`❌ [Welcome Email Error] Direct SMTP failed for ${email}:`, err.message);
  }
}

/**
 * Convenience helper to send a welcome email webhook & direct SMTP email.
 * 
 * @param {string} name - The user's name
 * @param {string} email - The user's email
 */
function sendWelcomeWebhook(name, email) {
  // 1. Trigger Make.com Webhook
  triggerWebhook({ name, email }, 'user_registration');

  // 2. Dual-dispatch via direct SMTP (guarantees welcome email delivery)
  sendDirectWelcomeEmail(name, email).catch(err => console.warn('Welcome direct email background error:', err.message));
}

module.exports = {
  triggerWebhook,
  sendWelcomeWebhook
};
