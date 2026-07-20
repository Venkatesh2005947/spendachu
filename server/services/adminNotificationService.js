/**
 * SpendAchu Admin Notification Service
 * =====================================
 * Centralized, non-blocking notification recording and asynchronous delivery service.
 * Supports Make.com custom webhooks, event_key deduplication, sensitive data sanitization,
 * 3-attempt retry handling, and admin management queries.
 */

const { db } = require('./dbConnector');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Supported severity levels
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

// Supported statuses
const STATUSES = ['pending', 'sent', 'failed', 'read', 'dismissed'];

// Sensitive keys to strictly redact
const SENSITIVE_KEYS = [
  'password', 'password_hash', 'pass', 'pwd',
  'token', 'jwt', 'authorization', 'bearer',
  'apikey', 'api_key', 'secret', 'webhook_secret',
  'base64', 'imagedata', 'receipt_image', 'raw_image',
  'creditcard', 'cvv', 'card_number'
];

/**
 * Main function to record and attempt delivery of an admin notification.
 * GUARANTEED NON-BLOCKING: Catches all errors internally.
 */
async function notifyAdmin({
  eventType,
  severity = 'low',
  title,
  message,
  userId = null,
  metadata = {},
  eventKey = null,
  requestId = null
}) {
  try {
    if (!eventType || !title || !message) {
      console.warn('⚠️ Admin notification missing required fields (eventType, title, or message)');
      return null;
    }

    // Validate severity
    const validSeverity = SEVERITIES.includes(severity) ? severity : 'low';

    // Generate safe correlation ID if not provided
    const safeRequestId = requestId || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Sanitize metadata & messages
    const safeMetadata = sanitizeData({
      ...metadata,
      requestId: safeRequestId
    });
    const safeTitle = sanitizeText(title);
    const safeMessage = sanitizeText(message);

    // Generate deterministic event_key if not provided
    const safeEventKey = eventKey || generateEventKey(eventType, userId, safeMessage);

    const notificationId = `an_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const createdAt = Date.now();
    const metadataStr = JSON.stringify(safeMetadata);

    // Insert record idempotently into database
    await new Promise((resolve) => {
      db.run(
        `INSERT INTO admin_notifications (
          id, event_key, event_type, severity, title, message, user_id, metadata, status, attempt_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
        ON CONFLICT(event_key) DO NOTHING`,
        [
          notificationId,
          safeEventKey,
          eventType,
          validSeverity,
          safeTitle,
          safeMessage,
          userId,
          metadataStr,
          createdAt
        ],
        function (err) {
          if (err) {
            console.error('⚠️ Error inserting admin notification into DB:', err.message);
          }
          resolve(true);
        }
      );
    });

    // Deliver to Make.com webhook asynchronously (Non-blocking setImmediate)
    setImmediate(() => {
      deliverWebhook(notificationId).catch(err => {
        console.error(`⚠️ Webhook delivery background error for ${notificationId}:`, err.message);
      });
    });

    return notificationId;
  } catch (err) {
    // Fail silently to never break user operations
    console.error('⚠️ Non-blocking Admin Notification Service exception:', err.message);
    return null;
  }
}

/**
 * Deliver webhook payload to Make.com asynchronously with retries.
 */
async function deliverWebhook(notificationId, maxAttempts = 3) {
  const notification = await getNotificationByIdInternal(notificationId);
  if (!notification) return false;

  const webhookUrl = process.env.ADMIN_NOTIFICATION_WEBHOOK_URL;
  const webhookSecret = process.env.ADMIN_NOTIFICATION_WEBHOOK_SECRET || 'spendachu-admin-webhook-secret';

  // If no webhook URL is configured, mark as sent/logged locally
  if (!webhookUrl || webhookUrl.trim() === '') {
    await updateNotificationStatus(notificationId, 'sent', notification.attempt_count + 1, null, Date.now());
    return true;
  }

  const payload = JSON.stringify({
    id: notification.id,
    eventKey: notification.event_key,
    eventType: notification.event_type,
    severity: notification.severity,
    title: notification.title,
    message: notification.message,
    userId: notification.user_id,
    metadata: safeParseJSON(notification.metadata),
    createdAt: new Date(Number(notification.created_at)).toISOString()
  });

  let currentAttempt = notification.attempt_count;
  let lastError = null;
  let delivered = false;

  while (currentAttempt < maxAttempts && !delivered) {
    currentAttempt++;
    try {
      await sendHttpRequest(webhookUrl, webhookSecret, payload);
      delivered = true;
    } catch (err) {
      lastError = err.message || 'HTTP post failed';
      console.warn(`⚠️ Admin webhook attempt ${currentAttempt}/${maxAttempts} failed for ${notificationId}: ${lastError}`);
      if (currentAttempt < maxAttempts) {
        // Exponential backoff delay (500ms, 1500ms)
        await new Promise(r => setTimeout(r, currentAttempt * 500));
      }
    }
  }

  if (delivered) {
    await updateNotificationStatus(notificationId, 'sent', currentAttempt, null, Date.now());
    return true;
  } else {
    await updateNotificationStatus(notificationId, 'failed', currentAttempt, lastError, null);
    return false;
  }
}

/**
 * Send HTTP/HTTPS request to Make.com Custom Webhook
 */
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
          'User-Agent': 'SpendAchu-Admin-Notifier/1.0'
        },
        timeout: 5000
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            reject(new Error(`Webhook endpoint returned HTTP status ${res.statusCode}: ${body.substring(0, 100)}`));
          }
        });
      });

      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Webhook HTTP request timed out after 5 seconds'));
      });

      req.write(payload);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// -----------------------------------------------------------------------------
// Admin Query & Update Operations
// -----------------------------------------------------------------------------

async function getAdminNotifications({ page = 1, limit = 20, severity, status, eventType, search }) {
  return new Promise((resolve, reject) => {
    let whereClauses = [];
    let params = [];

    if (severity && SEVERITIES.includes(severity)) {
      whereClauses.push(`severity = ?`);
      params.push(severity);
    }
    if (status && STATUSES.includes(status)) {
      whereClauses.push(`status = ?`);
      params.push(status);
    }
    if (eventType) {
      whereClauses.push(`event_type = ?`);
      params.push(eventType);
    }
    if (search && search.trim() !== '') {
      whereClauses.push(`(title LIKE ? OR message LIKE ? OR user_id LIKE ?)`);
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    // Count query
    db.get(`SELECT COUNT(*) as total FROM admin_notifications ${whereSql}`, params, (err, countRow) => {
      if (err) return reject(err);
      const total = countRow ? countRow.total : 0;

      // Data query
      const dataSql = `
        SELECT * FROM admin_notifications 
        ${whereSql} 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      const queryParams = [...params, parseInt(limit), offset];

      db.all(dataSql, queryParams, (err, rows) => {
        if (err) return reject(err);

        const mapped = (rows || []).map(r => ({
          id: r.id,
          eventKey: r.event_key,
          eventType: r.event_type,
          severity: r.severity,
          title: r.title,
          message: r.message,
          userId: r.user_id,
          metadata: safeParseJSON(r.metadata),
          status: r.status,
          attemptCount: r.attempt_count,
          lastError: r.last_error,
          createdAt: Number(r.created_at),
          sentAt: r.sent_at ? Number(r.sent_at) : null,
          readAt: r.read_at ? Number(r.read_at) : null
        }));

        resolve({
          notifications: mapped,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit)) || 1
          }
        });
      });
    });
  });
}

async function getNotificationById(id) {
  const r = await getNotificationByIdInternal(id);
  if (!r) return null;
  return {
    id: r.id,
    eventKey: r.event_key,
    eventType: r.event_type,
    severity: r.severity,
    title: r.title,
    message: r.message,
    userId: r.user_id,
    metadata: safeParseJSON(r.metadata),
    status: r.status,
    attemptCount: r.attempt_count,
    lastError: r.last_error,
    createdAt: Number(r.created_at),
    sentAt: r.sent_at ? Number(r.sent_at) : null,
    readAt: r.read_at ? Number(r.read_at) : null
  };
}

async function markAsRead(id) {
  const readAt = Date.now();
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE admin_notifications SET status = 'read', read_at = ? WHERE id = ?`,
      [readAt, id],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

async function dismissNotification(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE admin_notifications SET status = 'dismissed' WHERE id = ?`,
      [id],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

async function retryNotificationDelivery(id) {
  return deliverWebhook(id, 3);
}

// -----------------------------------------------------------------------------
// Internal Helpers
// -----------------------------------------------------------------------------

function getNotificationByIdInternal(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM admin_notifications WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function updateNotificationStatus(id, status, attemptCount, lastError = null, sentAt = null) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE admin_notifications 
       SET status = ?, attempt_count = ?, last_error = ?, sent_at = COALESCE(?, sent_at)
       WHERE id = ?`,
      [status, attemptCount, lastError, sentAt, id],
      (err) => {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  // Redact potential Bearer tokens or secret patterns
  let cleaned = text.replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, 'Bearer [REDACTED]');
  cleaned = cleaned.replace(/sk-[A-Za-z0-9]{20,}/gi, 'sk-[REDACTED]');
  return cleaned;
}

function sanitizeData(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item));
  }

  const sanitized = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeData(val);
    } else if (typeof val === 'string' && val.length > 500 && val.includes('data:image')) {
      sanitized[key] = '[IMAGE_DATA_REDACTED]';
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

function generateEventKey(eventType, userId, message) {
  // Deduplicate identical events per hour bucket
  const hourBucket = new Date().toISOString().substring(0, 13); // e.g. "2026-07-20T22"
  const hash = crypto.createHash('md5').update(`${eventType}_${userId || 'anon'}_${message}_${hourBucket}`).digest('hex').substring(0, 8);
  return `${eventType}_${userId || 'sys'}_${hourBucket}_${hash}`;
}

function safeParseJSON(jsonStr) {
  if (!jsonStr) return {};
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return {};
  }
}

module.exports = {
  notifyAdmin,
  getAdminNotifications,
  getNotificationById,
  markAsRead,
  dismissNotification,
  retryNotificationDelivery,
  sanitizeData
};
