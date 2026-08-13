/**
 * SpendAchu Inactive User Reminder Service
 * =========================================
 * Evaluates authenticated user inactivity thresholds (7, 14, 30 days).
 * Prevents sending duplicate stage reminders.
 * Dispatches non-blocking Make.com webhook emails.
 * Resets reminder tracking immediately when user logs back in.
 */

const { db } = require('./dbConnector');
const https = require('https');
const http = require('http');

/**
 * Returns a list of inactive users requiring reminders.
 * EXCLUDES all sensitive financial data, passwords, and tokens.
 */
async function getInactiveUsersRequiringReminders() {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    const msInDay = 1000 * 60 * 60 * 24;

    db.all(
      `SELECT id, name, email, last_login, created_at, last_inactive_reminder_sent, inactive_reminder_count, inactive_reminders_enabled, last_reminder_stage 
       FROM users 
       WHERE COALESCE(inactive_reminders_enabled, 1) = 1`,
      [],
      (err, rows) => {
        if (err) return reject(err);

        const eligibleUsers = [];

        for (const user of rows || []) {
          // Determine effective last login timestamp
          let lastLoginTs = user.last_login;
          if (!lastLoginTs) {
            if (user.created_at) {
              lastLoginTs = user.created_at;
            } else if (user.id && user.id.startsWith('usr_')) {
              const parts = user.id.split('_');
              lastLoginTs = parseInt(parts[1]);
            }
          }

          if (!lastLoginTs) continue;

          const inactiveDays = Math.floor((now - lastLoginTs) / msInDay);
          if (inactiveDays < 7) continue;

          // Determine target stage
          let targetStage = null;
          if (inactiveDays >= 30) {
            targetStage = '30_days';
          } else if (inactiveDays >= 14) {
            targetStage = '14_days';
          } else if (inactiveDays >= 7) {
            targetStage = '7_days';
          }

          if (!targetStage) continue;

          // Prevent sending duplicate reminder for the exact same stage
          if (user.last_reminder_stage === targetStage) {
            continue;
          }

          eligibleUsers.push({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            inactiveDays,
            reminderStage: targetStage
          });
        }

        resolve(eligibleUsers);
      }
    );
  });
}

/**
 * Process and dispatch webhooks for inactive users requiring reminders.
 * Non-blocking: catches all errors internally.
 */
async function processAndDispatchInactiveReminders() {
  try {
    const inactiveUsers = await getInactiveUsersRequiringReminders();
    if (inactiveUsers.length === 0) {
      return { processedCount: 0, users: [] };
    }

    const webhookUrl = process.env.ADMIN_NOTIFICATION_WEBHOOK_URL;
    const webhookSecret = process.env.ADMIN_NOTIFICATION_WEBHOOK_SECRET || 'spendachu-admin-webhook-secret';
    const now = Date.now();

    const results = [];

    for (const u of inactiveUsers) {
      const payload = JSON.stringify({
        eventType: 'inactive_user_reminder',
        reminderStage: u.reminderStage,
        user: {
          userName: u.userName,
          userEmail: u.userEmail,
          inactiveDays: u.inactiveDays,
          reminderStage: u.reminderStage
        },
        dispatchedAt: new Date(now).toISOString()
      });

      let delivered = false;
      if (webhookUrl && webhookUrl.trim() !== '') {
        try {
          await sendHttpRequest(webhookUrl, webhookSecret, payload);
          delivered = true;
        } catch (err) {
          console.warn(`⚠️ Inactive reminder webhook failed for ${u.userEmail}: ${err.message}`);
        }
      }

      // Update database status for this user
      await new Promise((resolve) => {
        db.run(
          `UPDATE users 
           SET last_inactive_reminder_sent = ?, 
               inactive_reminder_count = COALESCE(inactive_reminder_count, 0) + 1, 
               last_reminder_stage = ? 
           WHERE id = ?`,
          [now, u.reminderStage, u.userId],
          () => resolve(true)
        );
      });

      results.push({
        ...u,
        delivered
      });
    }

    return {
      processedCount: results.length,
      users: results
    };
  } catch (err) {
    console.error('⚠️ Inactive user reminder service exception:', err.message);
    return { processedCount: 0, error: err.message };
  }
}

/**
 * Reset inactivity reminder state when user logs back in.
 */
function resetUserLoginState(userId) {
  return new Promise((resolve) => {
    const now = Date.now();
    db.run(
      `UPDATE users 
       SET last_login = ?, last_reminder_stage = NULL, inactive_reminder_count = 0 
       WHERE id = ?`,
      [now, userId],
      (err) => {
        if (err) console.error('⚠️ Failed to update user last_login:', err.message);
        resolve(true);
      }
    );
  });
}

/**
 * Update user's reminder opt-out / opt-in preference.
 */
function updateReminderPreference(userId, enabled) {
  return new Promise((resolve, reject) => {
    const val = enabled ? 1 : 0;
    db.run(
      `UPDATE users SET inactive_reminders_enabled = ? WHERE id = ?`,
      [val, userId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

function sendHttpRequest(urlStr, secretHeader, payload) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(urlStr);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Admin-Webhook-Secret': secretHeader,
          'User-Agent': 'SpendAchu-Inactive-User-Notifier/1.0'
        },
        timeout: 6000
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            reject(new Error(`Webhook HTTP status ${res.statusCode}`));
          }
        });
      });

      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Webhook request timed out'));
      });

      req.write(payload);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  getInactiveUsersRequiringReminders,
  processAndDispatchInactiveReminders,
  resetUserLoginState,
  updateReminderPreference
};
