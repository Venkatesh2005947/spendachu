require('dotenv').config();
const dns = require('dns');
const https = require('https');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Helper to send email using Brevo HTTPS REST API
const sendEmailViaBrevo = (apiKey, category, message, senderEmail, senderName, createdAt) => {
  const recipientEmail = process.env.ADMIN_EMAIL || "spendachu@gmail.com";
  return new Promise((resolve, reject) => {
    const emailData = JSON.stringify({
      sender: {
        name: "SpendAchu App",
        email: "spendachu@gmail.com"
      },
      to: [
        {
          email: recipientEmail,
          name: "SpendAchu Admin"
        }
      ],
      replyTo: {
        email: senderEmail,
        name: senderName
      },
      subject: `SpendAchu Feedback [${category.toUpperCase()}] - ${senderName}`,
      textContent: `Feedback Received!\n\nUser: ${senderName}\nEmail: ${senderEmail}\nCategory: ${category}\nSubmitted At: ${new Date(createdAt).toLocaleString()}\n\nMessage:\n----------------------------------------\n${message}\n----------------------------------------\n`
    });

    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(emailData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Brevo API returned status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(emailData);
    req.end();
  });
};

// Helper to send email using Resend HTTPS REST API
const sendEmailViaResend = (apiKey, category, message, senderEmail, senderName, createdAt) => {
  const recipientEmail = process.env.ADMIN_EMAIL || "spendachu@gmail.com";
  return new Promise((resolve, reject) => {
    const emailData = JSON.stringify({
      from: "SpendAchu App <onboarding@resend.dev>",
      to: [recipientEmail],
      reply_to: senderEmail,
      subject: `SpendAchu Feedback [${category.toUpperCase()}] - ${senderName}`,
      text: `Feedback Received!\n\nUser: ${senderName}\nEmail: ${senderEmail}\nCategory: ${category}\nSubmitted At: ${new Date(createdAt).toLocaleString()}\n\nMessage:\n----------------------------------------\n${message}\n----------------------------------------\n`
    });

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Resend API returned status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(emailData);
    req.end();
  });
};




// Helper to query self-hosted PaddleOCR service for receipt processing
const http = require('http');
const PADDLE_OCR_URL = process.env.PADDLE_OCR_URL || 'http://localhost:8100';
const OCR_SERVICE_TOKEN = process.env.OCR_SERVICE_TOKEN || 'spendachu-ocr-secret-2024';

/**
 * Send receipt image to PaddleOCR FastAPI service via multipart/form-data.
 * Returns structured receipt JSON matching ReceiptPreview expected format.
 *
 * @param {string} base64Data - Base64-encoded image data
 * @param {string} mimeType   - MIME type (e.g. image/jpeg)
 * @returns {Promise<object>}  Parsed receipt data
 */
const queryPaddleOCR = (base64Data, mimeType) => {
  return new Promise((resolve, reject) => {
    // Convert base64 to Buffer for multipart upload
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Determine file extension from mimeType
    const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/jpg': 'jpg' };
    const ext = extMap[mimeType] || 'jpg';

    // Build multipart/form-data body
    const boundary = '----SpendAchuOCR' + Date.now();
    const CRLF = "\r\n";

    const header = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="receipt.${ext}"`,
      `Content-Type: ${mimeType}`,
      '',
      '',
    ].join(CRLF);

    const footer = `${CRLF}--${boundary}--${CRLF}`;

    const headerBuffer = Buffer.from(header, 'utf-8');
    const footerBuffer = Buffer.from(footer, 'utf-8');
    const bodyBuffer = Buffer.concat([headerBuffer, imageBuffer, footerBuffer]);

    // Parse the OCR service URL
    const url = new URL(PADDLE_OCR_URL);
    const isHttps = url.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: '/process-receipt',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
        'x-ocr-token': OCR_SERVICE_TOKEN,
      },
    };

    console.log(`📤 [PaddleOCR] Sending receipt image (${imageBuffer.length} bytes) to ${PADDLE_OCR_URL}/process-receipt`);

    const req = requestModule.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(body);
            console.log(`✅ [PaddleOCR] Receipt processed successfully: merchant=${result.merchant}, amount=${result.amount}`);
            resolve(result);
          } catch (parseErr) {
            console.error('❌ [PaddleOCR] Failed to parse response:', body.substring(0, 200));
            reject(new Error('OCR service returned an unreadable response. Please try again.'));
          }
        } else {
          console.error(`❌ [PaddleOCR] HTTP ${res.statusCode}:`, body.substring(0, 300));
          let friendlyMsg = `Receipt scanning failed (HTTP ${res.statusCode}).`;
          if (res.statusCode === 400) friendlyMsg = 'Image was rejected by OCR service. Try a clearer photo.';
          if (res.statusCode === 401) friendlyMsg = 'OCR service authentication failed. Check OCR_SERVICE_TOKEN.';
          if (res.statusCode === 503) friendlyMsg = 'OCR service is still starting up. Please wait a moment and try again.';
          reject(new Error(friendlyMsg));
        }
      });
    });

    // 90-second timeout to handle PaddleOCR cold starts and large images
    req.setTimeout(90000, () => {
      req.destroy(new Error('Receipt scanning timed out. The OCR service may be starting up — please try again.'));
    });

    req.on('error', (e) => {
      console.error('❌ [PaddleOCR] Connection error:', e.message);
      if (e.code === 'ECONNREFUSED') {
        reject(new Error('OCR service is not running. Please start the PaddleOCR service.'));
      } else {
        reject(new Error('Could not connect to OCR service: ' + e.message));
      }
    });

    req.write(bodyBuffer);
    req.end();
  });
};



const createMailTransporter = async (host, port, user, pass) => {
  if (host.toLowerCase().includes('gmail.com')) {
    console.log('ℹ️ [SMTP Diagnostics] Gmail SMTP detected. Configuring via service: "gmail" for maximum reliability.');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  let resolvedHost = host;
  try {
    resolvedHost = await new Promise((resolve, reject) => {
      // If host looks like an IP address, don't perform lookup
      if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host)) {
        return resolve(host);
      }
      dns.lookup(host, { family: 4 }, (err, address) => {
        if (err) reject(err);
        else resolve(address);
      });
    });
    console.log(`ℹ️ [Email DNS] Resolved ${host} to IPv4: ${resolvedHost}`);
  } catch (err) {
    console.warn(`⚠️ [Email DNS] Failed to resolve ${host} to IPv4: ${err.message}. Falling back to original host.`);
  }

  return nodemailer.createTransport({
    host: resolvedHost,
    port: port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
      servername: host // Crucial for TLS validation against original domain
    }
  });
};
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const nodemailer = require('nodemailer');
const { sendWelcomeWebhook } = require('./services/webhook');
const { db } = require('./services/dbConnector');
const { evaluateAchievements } = require('./services/achievementEngine');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'secret_spendachu_9923';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const { calculateFinancialHealthScore, getScoreHistory } = require('./services/financialHealthEngine');
const {
  notifyAdmin,
  getAdminNotifications,
  getNotificationById,
  markAsRead,
  dismissNotification,
  retryNotificationDelivery
} = require('./services/adminNotificationService');
const {
  generateWeeklyReport,
  dispatchWeeklyReportEmail,
  getWeeklyReportsHistory
} = require('./services/weeklyReportEngine');
const {
  getInactiveUsersRequiringReminders,
  processAndDispatchInactiveReminders,
  resetUserLoginState,
  updateReminderPreference
} = require('./services/inactiveUserReminderService');


// JWT Authentication Middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Session expired or invalid.' });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'Authorization header missing.' });
  }
}

// Admin Authorization Middleware
function requireAdmin(req, res, next) {
  const adminEmail = (process.env.ADMIN_EMAIL || 'spendachu@gmail.com').toLowerCase();
  const isUserAdmin = req.user && (
    (req.user.email && req.user.email.toLowerCase() === adminEmail) ||
    req.user.is_admin === 1 ||
    req.user.is_admin === true
  );

  if (isUserAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: Admin privileges required.' });
  }
}

// Helper to seed default budgets
const DEFAULT_BUDGETS = {
  global: 30000,
  Food: 8000,
  Transport: 3000,
  Rent: 10000,
  Shopping: 4000,
  Bills: 3000,
  Entertainment: 2000,
  Others: 2000
};

// ==========================================================================
// Authentication Endpoints
// ==========================================================================

// Register User
app.post('/api/register', (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const passwordHash = bcrypt.hashSync(password, 10);

  const regTime = Date.now();
  db.run(
    `INSERT INTO users (id, name, email, password_hash, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, name, normalizedEmail, passwordHash, regTime, regTime],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'An account with this email already exists.' });
        }
        return res.status(500).json({ error: 'Failed to create account.' });
      }

      // Seed default budgets
      db.run(
        `INSERT INTO budgets (user_id, data) VALUES (?, ?)`,
        [userId, JSON.stringify(DEFAULT_BUDGETS)],
        (budgetErr) => {
          if (budgetErr) console.error('Failed to seed budgets:', budgetErr);
          
          // Trigger the welcome email webhook asynchronously without blocking registration success
          sendWelcomeWebhook(name, normalizedEmail);

          // Record admin notification for user registration
          notifyAdmin({
            eventType: 'new_user_registration',
            severity: 'low',
            title: 'New User Registered 🎉',
            message: `User ${name} (${normalizedEmail}) has created an account.`,
            userId: userId,
            metadata: { email: normalizedEmail, name }
          });

          res.status(201).json({ name, email: normalizedEmail });
        }
      );
    }
  );
});

// Failed login attempts tracker
const failedLoginMap = new Map();

// Login User
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  db.get(
    `SELECT * FROM users WHERE email = ?`,
    [normalizedEmail],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Server error during login.' });
      }
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        const currentFails = (failedLoginMap.get(normalizedEmail) || 0) + 1;
        failedLoginMap.set(normalizedEmail, currentFails);
        if (currentFails >= 3) {
          notifyAdmin({
            eventType: 'repeated_login_failures',
            severity: 'high',
            title: 'Security Alert: Repeated Login Failures 🔐',
            message: `Multiple failed login attempts (${currentFails}) detected for ${normalizedEmail}.`,
            metadata: { email: normalizedEmail, attempts: currentFails }
          });
        }
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      failedLoginMap.delete(normalizedEmail);

      // Reset inactivity tracking and update last_login timestamp immediately
      resetUserLoginState(user.id);

      const sessionToken = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(200).json({
        user: { name: user.name, email: user.email },
        token: sessionToken
      });
    }
  );
});

// Verify Session
app.get('/api/verify', authenticateJWT, (req, res) => {
  res.status(200).json({
    user: { name: req.user.name, email: req.user.email }
  });
});

// Reset Password
app.post('/api/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.run(
    `UPDATE users SET password_hash = ? WHERE email = ?`,
    [passwordHash, email.toLowerCase().trim()],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to reset password.' });
      }
      if (this.changes === 0) {
        return res.status(400).json({ error: 'No account found with this email.' });
      }
      res.status(200).json({ success: true });
    }
  );
});

// Check if Email Exists
app.post('/api/check-email', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  db.get(`SELECT id FROM users WHERE email = ?`, [normalizedEmail], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }
    res.status(200).json({ exists: true });
  });
});





// Get Expenses
// Scan Receipt and Extract Details via self-hosted PaddleOCR
app.post('/api/expenses/scan-receipt', authenticateJWT, (req, res) => {
  const { image, mimeType } = req.body;
  if (!image || !mimeType) {
    return res.status(400).json({ error: 'Image and mimeType are required.' });
  }

  queryPaddleOCR(image, mimeType)
    .then(result => {
      res.json(result);
    })
    .catch(err => {
      // Full error already logged inside queryPaddleOCR; just send a clean message
      console.error('❌ [PaddleOCR Scan Error]:', err.message);
      res.status(500).json({ error: err.message });
    });
});

app.get('/api/expenses', authenticateJWT, (req, res) => {
  db.all(
    `SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch expenses.' });
      
      const formatted = rows.map(r => ({
        id: r.id,
        user_id: r.user_id,
        date: r.date,
        amount: r.amount,
        category: r.category,
        paymentMethod: r.payment_method, // Map db column to camelCase property
        description: r.description,
        created_at: r.created_at,
        merchant: r.merchant,
        time: r.time,
        tax: r.tax,
        notes: r.notes
      }));
      res.status(200).json(formatted);
    }
  );
});

// ── Duplicate Detection Helper ──────────────────────────────────────────────
/**
 * Normalize a merchant name for fuzzy comparison:
 *  - Lowercase
 *  - Strip trailing generic words (restaurant, outlet, store, shop, cafe, etc.)
 *  - Collapse extra whitespace
 */
const normalizeMerchant = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(restaurant|restaurants|outlet|outlets|store|stores|shop|shops|cafe|cafes|bar|bars|hotel|hotels|express|point|center|centre|branch|velachery|anna\s*nagar|t\.?nagar|adyar|tambaram|porur)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Returns the best matching duplicate for the incoming expense, or null.
 * @param {object} db      - SQLite db instance
 * @param {string} userId
 * @param {object} incoming - { amount, date, merchant, time }
 * @returns Promise<{ confidence: 'exact'|'possible', existing: object }|null>
 */
const findDuplicate = (db, userId, incoming) => {
  return new Promise((resolve, reject) => {
    const inAmt  = parseFloat(incoming.amount);
    const inDate = incoming.date;
    const inMerchantNorm = normalizeMerchant(incoming.merchant);
    const inTime = incoming.time || null;

    // Fetch same-date expenses for this user
    db.all(
      `SELECT * FROM expenses
       WHERE user_id = ? AND date = ?
       ORDER BY created_at DESC`,
      [userId, inDate],
      (err, rows) => {
        if (err) return reject(err);

        let bestMatch = null;

        for (const row of rows) {
          // Amount must match exactly
          if (Math.abs(parseFloat(row.amount) - inAmt) > 0.001) continue;

          const existingMerchantNorm = normalizeMerchant(row.merchant);
          let merchantMatch = false;

          if (inMerchantNorm && existingMerchantNorm) {
            // Exact match after normalization
            if (inMerchantNorm === existingMerchantNorm) {
              merchantMatch = true;
            }
            // Prefix match: one starts with the other (handles "KFC" vs "KFC Velachery")
            else if (
              inMerchantNorm.startsWith(existingMerchantNorm) ||
              existingMerchantNorm.startsWith(inMerchantNorm)
            ) {
              merchantMatch = true;
            }
          }

          // Determine confidence
          let confidence = null;
          if (merchantMatch) {
            // Time bonus: if both have time and they match → exact, else still exact (merchant+amount+date)
            if (inTime && row.time && inTime === row.time) {
              confidence = 'exact';
            } else {
              confidence = 'exact';
            }
          } else if (!incoming.merchant && !row.merchant) {
            // No merchant on either side — amount + date match is "possible"
            confidence = 'possible';
          } else {
            // One has merchant, the other does not, or they differ significantly
            confidence = 'possible';
          }

          if (confidence) {
            bestMatch = {
              confidence,
              existing: {
                id: row.id,
                date: row.date,
                amount: row.amount,
                category: row.category,
                paymentMethod: row.payment_method,
                description: row.description,
                merchant: row.merchant,
                time: row.time,
                tax: row.tax,
                notes: row.notes
              }
            };
            // Prefer exact over possible; take first match found
            if (confidence === 'exact') break;
          }
        }

        resolve(bestMatch);
      }
    );
  });
};
// ────────────────────────────────────────────────────────────────────────────

// Add Expense
app.post('/api/expenses', authenticateJWT, async (req, res) => {
  const { date, amount, category, paymentMethod, description, merchant, time, tax, notes, forceCreate } = req.body;
  const amtFloat = parseFloat(amount);
  const taxFloat = tax ? parseFloat(tax) : 0;

  if (isNaN(amtFloat) || amtFloat <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  // ── Duplicate check (skip when forceCreate is explicitly true) ──
  if (!forceCreate) {
    try {
      const dup = await findDuplicate(db, req.user.id, {
        amount: amtFloat,
        date: date || new Date().toISOString().split('T')[0],
        merchant,
        time
      });

      if (dup) {
        console.log(`⚠️  [Duplicate] user=${req.user.id} confidence=${dup.confidence} amount=${amtFloat} date=${date} merchant="${merchant}"`);
        notifyAdmin({
          eventType: 'duplicate_expense_blocked',
          severity: 'low',
          title: 'Duplicate Expense Blocked 🛑',
          message: `Duplicate expense of ₹${amtFloat} (${category}) flagged.`,
          userId: req.user.id,
          metadata: { amount: amtFloat, category, confidence: dup.confidence }
        });
        return res.status(409).json({
          duplicate: true,
          confidence: dup.confidence,
          existing: dup.existing
        });
      }
    } catch (dupErr) {
      // Non-fatal: log and continue with the save
      console.error('⚠️  [Duplicate check error]:', dupErr.message);
    }
  }

  if (amtFloat >= 50000) {
    notifyAdmin({
      eventType: 'high_or_critical_expense_anomaly',
      severity: 'critical',
      title: 'Critical Expense Anomaly Alert 🚨',
      message: `Unusual large expense entry of ₹${amtFloat.toLocaleString()} logged under ${category}.`,
      userId: req.user.id,
      metadata: { amount: amtFloat, category, date }
    });
  }
  // ───────────────────────────────────────────────────────────────

  const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  db.run(
    `INSERT INTO expenses (id, user_id, date, amount, category, payment_method, description, created_at, merchant, time, tax, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      expenseId,
      req.user.id,
      date || new Date().toISOString().split('T')[0],
      amtFloat,
      category || 'Others',
      paymentMethod || 'Cash',
      description || '',
      Date.now(),
      merchant || null,
      time || null,
      isNaN(taxFloat) ? null : taxFloat,
      notes || null
    ],
    async function (err) {
      if (err) {
        console.error('Failed to add expense:', err);
        return res.status(500).json({ error: 'Failed to add expense.' });
      }

      // Track streak days, budget limits, and counts
      const rulesToEvaluate = ['expense_count', 'streak_days', 'under_budget_count'];
      if (req.body.isScanned) {
        rulesToEvaluate.push('scanned_count');
      }

      try {
        const unlocked = await evaluateAchievements(req.user.id, rulesToEvaluate);
        res.status(201).json({ id: expenseId, unlockedAchievements: unlocked });
      } catch (achErr) {
        console.error('Non-fatal achievements check error:', achErr);
        res.status(201).json({ id: expenseId, unlockedAchievements: [] });
      }
    }
  );
});

// Update Expense
app.put('/api/expenses/:id', authenticateJWT, (req, res) => {
  const { date, amount, category, paymentMethod, description, merchant, time, tax, notes } = req.body;
  const amtFloat = parseFloat(amount);
  const taxFloat = tax ? parseFloat(tax) : 0;

  if (isNaN(amtFloat) || amtFloat <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  db.run(
    `UPDATE expenses SET date = ?, amount = ?, category = ?, payment_method = ?, description = ?, merchant = ?, time = ?, tax = ?, notes = ? 
     WHERE id = ? AND user_id = ?`,
    [
      date, 
      amtFloat, 
      category, 
      paymentMethod, 
      description || '', 
      merchant || null,
      time || null,
      isNaN(taxFloat) ? null : taxFloat,
      notes || null,
      req.params.id, 
      req.user.id
    ],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to update expense.' });
      res.status(200).json({ success: true });
    }
  );
});

// Soft Delete Expense (Move to Trash)
app.delete('/api/expenses/:id', authenticateJWT, (req, res) => {
  db.get(
    `SELECT * FROM expenses WHERE id = ? AND user_id = ?`,
    [req.params.id, req.user.id],
    (err, expense) => {
      if (err || !expense) return res.status(400).json({ error: 'Expense not found.' });

      db.serialize(() => {
        // 1. Insert into trash table
        db.run(
          `INSERT INTO trash (id, user_id, type, item, deleted_at) VALUES (?, ?, ?, ?, ?)`,
          [expense.id, req.user.id, 'expense', JSON.stringify(expense), Date.now()]
        );
        // 2. Delete from active expenses
        db.run(
          `DELETE FROM expenses WHERE id = ? AND user_id = ?`,
          [req.params.id, req.user.id],
          function (delErr) {
            if (delErr) return res.status(500).json({ error: 'Failed to delete expense.' });
            res.status(200).json({ success: true });
          }
        );
      });
    }
  );
});

// Clear All Expenses
app.post('/api/expenses/clear', authenticateJWT, (req, res) => {
  db.run(
    `DELETE FROM expenses WHERE user_id = ?`,
    [req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to clear expenses.' });
      res.status(200).json({ success: true });
    }
  );
});

// ==========================================================================
// Saving Endpoints
// ==========================================================================

// Get Savings
app.get('/api/savings', authenticateJWT, (req, res) => {
  db.all(
    `SELECT * FROM savings WHERE user_id = ? ORDER BY date DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch savings.' });
      res.status(200).json(rows);
    }
  );
});

// Add Saving
app.post('/api/savings', authenticateJWT, (req, res) => {
  const { amount, description } = req.body;
  const amtFloat = parseFloat(amount);

  if (isNaN(amtFloat) || amtFloat <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  const savingId = `sav_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  db.run(
    `INSERT INTO savings (id, user_id, date, amount, description, created_at) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [savingId, req.user.id, new Date().toISOString().split('T')[0], amtFloat, description || '', Date.now()],
    async function (err) {
      if (err) return res.status(500).json({ error: 'Failed to add saving.' });
      
      try {
        const unlocked = await evaluateAchievements(req.user.id, ['saved_amount']);
        res.status(201).json({ id: savingId, unlockedAchievements: unlocked });
      } catch (achErr) {
        console.error('Non-fatal achievements check error:', achErr);
        res.status(201).json({ id: savingId, unlockedAchievements: [] });
      }
    }
  );
});

// Soft Delete Saving (Move to Trash)
app.delete('/api/savings/:id', authenticateJWT, (req, res) => {
  db.get(
    `SELECT * FROM savings WHERE id = ? AND user_id = ?`,
    [req.params.id, req.user.id],
    (err, saving) => {
      if (err || !saving) return res.status(400).json({ error: 'Saving not found.' });

      db.serialize(() => {
        // 1. Insert into trash table
        db.run(
          `INSERT INTO trash (id, user_id, type, item, deleted_at) VALUES (?, ?, ?, ?, ?)`,
          [saving.id, req.user.id, 'saving', JSON.stringify(saving), Date.now()]
        );
        // 2. Delete from active savings
        db.run(
          `DELETE FROM savings WHERE id = ? AND user_id = ?`,
          [req.params.id, req.user.id],
          function (delErr) {
            if (delErr) return res.status(500).json({ error: 'Failed to delete saving.' });
            res.status(200).json({ success: true });
          }
        );
      });
    }
  );
});

// Clear All Savings
app.post('/api/savings/clear', authenticateJWT, (req, res) => {
  db.run(
    `DELETE FROM savings WHERE user_id = ?`,
    [req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to clear savings.' });
      res.status(200).json({ success: true });
    }
  );
});

// ==========================================================================
// Financial Goals Endpoints
// ==========================================================================

// Get Goals
app.get('/api/goals', authenticateJWT, (req, res) => {
  db.all(
    `SELECT * FROM financial_goals WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch financial goals.' });
      const formatted = rows.map(r => ({
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        targetAmount: r.target_amount,
        savedAmount: r.saved_amount,
        deadline: r.deadline,
        category: r.category,
        priority: r.priority,
        notes: r.notes,
        status: r.status,
        createdAt: r.created_at
      }));
      res.status(200).json(formatted);
    }
  );
});

// Add Goal
app.post('/api/goals', authenticateJWT, (req, res) => {
  const { name, targetAmount, savedAmount, deadline, category, priority, notes, allowExceed } = req.body;
  const target = parseFloat(targetAmount);
  const saved = parseFloat(savedAmount || 0);

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Goal name is required.' });
  }
  if (isNaN(target) || target <= 0) {
    return res.status(400).json({ error: 'Target amount must be greater than zero.' });
  }
  if (isNaN(saved) || saved < 0) {
    return res.status(400).json({ error: 'Saved amount cannot be negative.' });
  }
  if (saved > target && !allowExceed) {
    return res.status(400).json({ error: 'Saved amount cannot exceed target amount.' });
  }
  if (!deadline) {
    return res.status(400).json({ error: 'Deadline is required.' });
  }

  const status = saved >= target ? 'completed' : 'active';
  const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  db.run(
    `INSERT INTO financial_goals (id, user_id, name, target_amount, saved_amount, deadline, category, priority, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goalId,
      req.user.id,
      name.trim(),
      target,
      saved,
      deadline,
      category || 'Others',
      priority || 'medium',
      notes || '',
      status,
      Date.now()
    ],
    async function (err) {
      if (err) {
        console.error('Failed to create goal:', err);
        return res.status(500).json({ error: 'Failed to create goal.' });
      }

      const rules = ['goal_created_count'];
      if (status === 'completed') {
        rules.push('goal_completed_count');
      }

      let unlocked = [];
      try {
        unlocked = await evaluateAchievements(req.user.id, rules);
      } catch (achErr) {
        console.error('Non-fatal achievements check error:', achErr);
      }

      res.status(201).json({
        id: goalId,
        user_id: req.user.id,
        name: name.trim(),
        targetAmount: target,
        savedAmount: saved,
        deadline,
        category: category || 'Others',
        priority: priority || 'medium',
        notes: notes || '',
        status,
        createdAt: Date.now(),
        unlockedAchievements: unlocked
      });
    }
  );
});

// Update Goal
app.put('/api/goals/:id', authenticateJWT, (req, res) => {
  const { name, targetAmount, savedAmount, deadline, category, priority, notes, status, allowExceed } = req.body;
  const target = parseFloat(targetAmount);
  const saved = parseFloat(savedAmount);

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Goal name is required.' });
  }
  if (isNaN(target) || target <= 0) {
    return res.status(400).json({ error: 'Target amount must be greater than zero.' });
  }
  if (isNaN(saved) || saved < 0) {
    return res.status(400).json({ error: 'Saved amount cannot be negative.' });
  }
  if (saved > target && !allowExceed) {
    return res.status(400).json({ error: 'Saved amount cannot exceed target amount.' });
  }
  if (!deadline) {
    return res.status(400).json({ error: 'Deadline is required.' });
  }

  // Determine status automatically if saved >= target, otherwise preserve status or use active
  let finalStatus = status || 'active';
  if (saved >= target) {
    finalStatus = 'completed';
  }

  db.run(
    `UPDATE financial_goals
     SET name = ?, target_amount = ?, saved_amount = ?, deadline = ?, category = ?, priority = ?, notes = ?, status = ?
     WHERE id = ? AND user_id = ?`,
    [
      name.trim(),
      target,
      saved,
      deadline,
      category || 'Others',
      priority || 'medium',
      notes || '',
      finalStatus,
      req.params.id,
      req.user.id
    ],
    async function (err) {
      if (err) {
        console.error('Failed to update goal:', err);
        return res.status(500).json({ error: 'Failed to update goal.' });
      }

      const rules = [];
      if (finalStatus === 'completed') {
        rules.push('goal_completed_count');
      }

      let unlocked = [];
      if (rules.length > 0) {
        try {
          unlocked = await evaluateAchievements(req.user.id, rules);
        } catch (achErr) {
          console.error('Non-fatal achievements check error:', achErr);
        }
      }

      res.status(200).json({
        id: req.params.id,
        name: name.trim(),
        targetAmount: target,
        savedAmount: saved,
        deadline,
        category: category || 'Others',
        priority: priority || 'medium',
        notes: notes || '',
        status: finalStatus,
        unlockedAchievements: unlocked
      });
    }
  );
});

// Add Savings to Goal
app.post('/api/goals/:id/add-savings', authenticateJWT, (req, res) => {
  const { amount, allowExceed } = req.body;
  const savingAmt = parseFloat(amount);

  if (isNaN(savingAmt) || savingAmt <= 0) {
    return res.status(400).json({ error: 'Saving amount must be greater than zero.' });
  }

  db.get(
    `SELECT * FROM financial_goals WHERE id = ? AND user_id = ?`,
    [req.params.id, req.user.id],
    (err, goal) => {
      if (err) return res.status(500).json({ error: 'Database error fetching goal.' });
      if (!goal) return res.status(404).json({ error: 'Goal not found.' });

      const newSaved = goal.saved_amount + savingAmt;
      if (newSaved > goal.target_amount && !allowExceed) {
        return res.status(400).json({ error: 'Saved amount cannot exceed target amount.' });
      }

      const newStatus = newSaved >= goal.target_amount ? 'completed' : goal.status;

      db.run(
        `UPDATE financial_goals SET saved_amount = ?, status = ? WHERE id = ? AND user_id = ?`,
        [newSaved, newStatus, req.params.id, req.user.id],
        async function (updateErr) {
          if (updateErr) return res.status(500).json({ error: 'Failed to add savings to goal.' });
          
          const isNewlyCompleted = newStatus === 'completed' && goal.status !== 'completed';
          let unlocked = [];
          if (isNewlyCompleted) {
            try {
              unlocked = await evaluateAchievements(req.user.id, ['goal_completed_count']);
            } catch (achErr) {
              console.error('Non-fatal achievements check error:', achErr);
            }
          }

          res.status(200).json({
            success: true,
            id: req.params.id,
            savedAmount: newSaved,
            status: newStatus,
            completed: isNewlyCompleted,
            unlockedAchievements: unlocked
          });
        }
      );
    }
  );
});

// Delete Goal
app.delete('/api/goals/:id', authenticateJWT, (req, res) => {
  db.run(
    `DELETE FROM financial_goals WHERE id = ? AND user_id = ?`,
    [req.params.id, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to delete goal.' });
      res.status(200).json({ success: true });
    }
  );
});

// ==========================================================================
// Financial Health Score Endpoints
// ==========================================================================

// Get Current Financial Health Score & Recommendations
app.get('/api/financial-health', authenticateJWT, async (req, res) => {
  try {
    const result = await calculateFinancialHealthScore(req.user.id);
    res.status(200).json(result);
  } catch (err) {
    console.error('Error calculating financial health score:', err);
    res.status(500).json({ error: 'Failed to calculate Financial Health Score.' });
  }
});

// Get Financial Health Score History
app.get('/api/financial-health/history', authenticateJWT, async (req, res) => {
  try {
    const history = await getScoreHistory(req.user.id);
    res.status(200).json(history);
  } catch (err) {
    console.error('Error fetching financial health score history:', err);
    res.status(500).json({ error: 'Failed to fetch score history.' });
  }
});

// ==========================================================================
// Admin Notification System Endpoints
// ==========================================================================

// GET /api/admin/notifications - Get paginated & filtered notifications
app.get('/api/admin/notifications', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const result = await getAdminNotifications(req.query);
    res.status(200).json(result);
  } catch (err) {
    console.error('Error fetching admin notifications:', err);
    res.status(500).json({ error: 'Failed to fetch admin notifications.' });
  }
});

// GET /api/admin/notifications/:id - Get single notification details
app.get('/api/admin/notifications/:id', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.status(200).json(notification);
  } catch (err) {
    console.error('Error fetching admin notification:', err);
    res.status(500).json({ error: 'Failed to fetch notification.' });
  }
});

// PATCH /api/admin/notifications/:id/read - Mark notification as read
app.patch('/api/admin/notifications/:id/read', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const success = await markAsRead(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

// PATCH /api/admin/notifications/:id/dismiss - Dismiss notification
app.patch('/api/admin/notifications/:id/dismiss', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const success = await dismissNotification(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error dismissing notification:', err);
    res.status(500).json({ error: 'Failed to dismiss notification.' });
  }
});

// POST /api/admin/notifications/:id/retry - Retry failed delivery
app.post('/api/admin/notifications/:id/retry', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const success = await retryNotificationDelivery(req.params.id);
    res.status(200).json({ success, message: success ? 'Webhook delivery succeeded.' : 'Delivery retry failed.' });
  } catch (err) {
    console.error('Error retrying notification delivery:', err);
    res.status(500).json({ error: 'Failed to retry notification delivery.' });
  }
});

// ==========================================================================
// Weekly Admin Analytics Report Endpoints
// ==========================================================================

// GET /api/admin/weekly-report - Generate or fetch weekly report
app.get('/api/admin/weekly-report', async (req, res) => {
  try {
    // Authorization check: Admin JWT OR secret header for automated triggers
    const secretHeader = req.headers['x-report-secret'] || req.headers['x-admin-webhook-secret'];
    const expectedSecret = process.env.ADMIN_NOTIFICATION_WEBHOOK_SECRET || 'spendachu-admin-webhook-secret';
    let isAuthorized = secretHeader && secretHeader === expectedSecret;

    if (!isAuthorized) {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const adminEmail = (process.env.ADMIN_EMAIL || 'spendachu@gmail.com').toLowerCase();
          if (decoded.email && decoded.email.toLowerCase() === adminEmail) {
            isAuthorized = true;
          }
        } catch (e) {}
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Valid Admin JWT or X-Report-Secret header required.' });
    }

    const { weekKey, forceRegenerate, dispatch } = req.query;
    const report = await generateWeeklyReport(weekKey || null, forceRegenerate === 'true');

    if (dispatch === 'true') {
      dispatchWeeklyReportEmail(report).catch(err => console.error('Background email dispatch error:', err));
    }

    res.status(200).json(report);
  } catch (err) {
    console.error('Error generating weekly admin report:', err);
    res.status(500).json({ error: 'Failed to generate weekly report.' });
  }
});

// GET /api/admin/weekly-report/history - Get historical weekly reports
app.get('/api/admin/weekly-report/history', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const history = await getWeeklyReportsHistory();
    res.status(200).json(history);
  } catch (err) {
    console.error('Error fetching weekly report history:', err);
    res.status(500).json({ error: 'Failed to fetch weekly report history.' });
  }
});

// ==========================================================================
// Inactive User Reminder Endpoints
// ==========================================================================

// GET /api/admin/inactive-users - Fetch inactive users requiring reminders
app.get('/api/admin/inactive-users', async (req, res) => {
  try {
    const secretHeader = req.headers['x-report-secret'] || req.headers['x-admin-webhook-secret'];
    const expectedSecret = process.env.ADMIN_NOTIFICATION_WEBHOOK_SECRET || 'spendachu-admin-webhook-secret';
    let isAuthorized = secretHeader && secretHeader === expectedSecret;

    if (!isAuthorized) {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const adminEmail = (process.env.ADMIN_EMAIL || 'spendachu@gmail.com').toLowerCase();
          if (decoded.email && decoded.email.toLowerCase() === adminEmail) {
            isAuthorized = true;
          }
        } catch (e) {}
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Valid Admin JWT or secret header required.' });
    }

    const inactiveUsers = await getInactiveUsersRequiringReminders();
    res.status(200).json(inactiveUsers);
  } catch (err) {
    console.error('Error fetching inactive users:', err);
    res.status(500).json({ error: 'Failed to fetch inactive users.' });
  }
});

// POST /api/admin/inactive-users/process - Trigger Make.com webhook dispatch for inactive users
app.post('/api/admin/inactive-users/process', async (req, res) => {
  try {
    const secretHeader = req.headers['x-report-secret'] || req.headers['x-admin-webhook-secret'];
    const expectedSecret = process.env.ADMIN_NOTIFICATION_WEBHOOK_SECRET || 'spendachu-admin-webhook-secret';
    let isAuthorized = secretHeader && secretHeader === expectedSecret;

    if (!isAuthorized) {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const adminEmail = (process.env.ADMIN_EMAIL || 'spendachu@gmail.com').toLowerCase();
          if (decoded.email && decoded.email.toLowerCase() === adminEmail) {
            isAuthorized = true;
          }
        } catch (e) {}
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Valid Admin JWT or secret header required.' });
    }

    const result = await processAndDispatchInactiveReminders();
    res.status(200).json(result);
  } catch (err) {
    console.error('Error processing inactive user reminders:', err);
    res.status(500).json({ error: 'Failed to process inactive user reminders.' });
  }
});

// GET /api/user/settings - Fetch current user settings (e.g. reminder preferences)
app.get('/api/user/settings', authenticateJWT, (req, res) => {
  db.get(
    `SELECT inactive_reminders_enabled FROM users WHERE id = ?`,
    [req.user.id],
    (err, userRow) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch user settings.' });
      res.status(200).json({
        inactiveRemindersEnabled: userRow ? (userRow.inactive_reminders_enabled !== 0) : true
      });
    }
  );
});

// PATCH /api/user/settings/reminders - Toggle user's reminder opt-in/opt-out
app.patch('/api/user/settings/reminders', authenticateJWT, async (req, res) => {
  try {
    const { enabled } = req.body;
    const success = await updateReminderPreference(req.user.id, !!enabled);
    res.status(200).json({ success, inactiveRemindersEnabled: !!enabled });
  } catch (err) {
    console.error('Error updating reminder settings:', err);
    res.status(500).json({ error: 'Failed to update reminder settings.' });
  }
});



// ==========================================================================
// Recently Deleted (Trash) Endpoints
// ==========================================================================

// Get Trash
app.get('/api/trash', authenticateJWT, (req, res) => {
  db.all(
    `SELECT * FROM trash WHERE user_id = ? ORDER BY deleted_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch trash.' });
      
      const parsedRows = rows.map(r => ({
        id: r.id,
        type: r.type,
        deletedAt: r.deleted_at,
        item: JSON.parse(r.item)
      }));
      res.status(200).json(parsedRows);
    }
  );
});

// Restore Item from Trash
app.post('/api/trash/restore/:id', authenticateJWT, (req, res) => {
  db.get(
    `SELECT * FROM trash WHERE id = ? AND user_id = ?`,
    [req.params.id, req.user.id],
    (err, row) => {
      if (err || !row) return res.status(400).json({ error: 'Item not found in trash.' });

      const item = JSON.parse(row.item);
      db.serialize(() => {
        if (row.type === 'expense') {
          db.run(
            `INSERT INTO expenses (id, user_id, date, amount, category, payment_method, description, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.id, req.user.id, item.date, item.amount, item.category, item.payment_method, item.description, item.created_at]
          );
        } else if (row.type === 'saving') {
          db.run(
            `INSERT INTO savings (id, user_id, date, amount, description, created_at) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [item.id, req.user.id, item.date, item.amount, item.description, item.created_at]
          );
        }

        db.run(
          `DELETE FROM trash WHERE id = ? AND user_id = ?`,
          [req.params.id, req.user.id],
          (delErr) => {
            if (delErr) return res.status(500).json({ error: 'Failed to restore item.' });
            res.status(200).json({ success: true });
          }
        );
      });
    }
  );
});

// Permanent Delete from Trash
app.delete('/api/trash/permanent/:id', authenticateJWT, (req, res) => {
  db.run(
    `DELETE FROM trash WHERE id = ? AND user_id = ?`,
    [req.params.id, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to permanently delete item.' });
      res.status(200).json({ success: true });
    }
  );
});

// Clear All Trash
app.delete('/api/trash/clear', authenticateJWT, (req, res) => {
  db.run(
    `DELETE FROM trash WHERE user_id = ?`,
    [req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to empty trash.' });
      res.status(200).json({ success: true });
    }
  );
});

// ==========================================================================
// Budget Endpoints
// ==========================================================================

// Get Budgets
app.get('/api/budgets', authenticateJWT, (req, res) => {
  db.get(
    `SELECT * FROM budgets WHERE user_id = ?`,
    [req.user.id],
    (err, budget) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch budgets.' });
      if (!budget) {
        // If not found, insert default budgets and return them
        db.run(
          `INSERT INTO budgets (user_id, data) VALUES (?, ?)`,
          [req.user.id, JSON.stringify(DEFAULT_BUDGETS)],
          (insertErr) => {
            if (insertErr) return res.status(500).json({ error: 'Failed to create budget configuration.' });
            res.status(200).json(DEFAULT_BUDGETS);
          }
        );
      } else {
        res.status(200).json(JSON.parse(budget.data));
      }
    }
  );
});

// Update Budgets
app.post('/api/budgets', authenticateJWT, (req, res) => {
  db.run(
    `UPDATE budgets SET data = ? WHERE user_id = ?`,
    [JSON.stringify(req.body), req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to update budgets.' });
      res.status(200).json(req.body);
    }
  );
});

// ==========================================================================
// Achievements Endpoints
// ==========================================================================

// Get achievements list and user progress
app.get('/api/achievements', authenticateJWT, (req, res) => {
  db.all(
    `SELECT a.*, ua.unlocked_at, ua.progress, ua.seen
     FROM achievements a
     LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
     WHERE a.active = 1
     ORDER BY a.category, a.points`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch achievements.' });
      
      let totalPoints = 0;
      const formatted = rows.map(r => {
        const unlocked = r.unlocked_at && r.unlocked_at > 0;
        if (unlocked) {
          totalPoints += r.points;
        }
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          category: r.category,
          icon: r.icon,
          ruleType: r.rule_type,
          ruleValue: r.rule_value,
          points: r.points,
          unlocked: !!unlocked,
          unlockedAt: r.unlocked_at || null,
          progress: r.progress || 0,
          seen: r.seen === 1
        };
      });

      res.status(200).json({
        achievements: formatted,
        totalPoints
      });
    }
  );
});

// Mark achievements as seen
app.post('/api/achievements/seen', authenticateJWT, (req, res) => {
  const { achievementIds } = req.body;
  if (!achievementIds || !Array.isArray(achievementIds) || achievementIds.length === 0) {
    return res.status(400).json({ error: 'Valid achievementIds array is required.' });
  }

  // Create placeholders like (?, ?, ?)
  const placeholders = achievementIds.map(() => '?').join(',');
  db.run(
    `UPDATE user_achievements 
     SET seen = 1 
     WHERE user_id = ? AND achievement_id IN (${placeholders})`,
    [req.user.id, ...achievementIds],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to mark achievements as seen.' });
      res.status(200).json({ success: true });
    }
  );
});

// ==========================================================================
// Feedback Endpoints
// ==========================================================================

// Submit Feedback and Send Email to spendachu@gmail.com
app.post('/api/feedback', authenticateJWT, (req, res) => {
  const { category, message } = req.body;
  if (!category || !message) {
    return res.status(400).json({ error: 'Category and message are required.' });
  }

  const feedbackId = `fed_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const email = req.user.email;
  const userId = req.user.id;
  const createdAt = Date.now();

  // 1. Save to SQLite database with initial pending status
  db.run(
    `INSERT INTO feedbacks (id, user_id, email, category, message, delivery_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [feedbackId, userId, email, category, message, 'pending', createdAt],
    async function (err) {
      if (err) {
        console.error('Failed to save feedback to database:', err);
        return res.status(500).json({ error: 'Failed to record feedback.' });
      }

      // 2. Perform email dispatch synchronously to report status to the client
      const resendApiKey = process.env.RESEND_API_KEY;
      const brevoApiKey = process.env.BREVO_API_KEY;
      let sent = false;
      let lastError = '';

      // Try Resend API first if configured
      if (resendApiKey) {
        try {
          await sendEmailViaResend(resendApiKey, category, message, email, req.user.name, createdAt);
          console.log(`[Email] Feedback mail sent successfully via Resend HTTPS API`);
          db.run(
            `UPDATE feedbacks SET delivery_status = ?, delivery_error = null WHERE id = ?`,
            ['sent', feedbackId]
          );
          sent = true;
        } catch (resendErr) {
          console.error('❌ [Email Diagnostics] Failed to deliver via Resend API:', resendErr.message);
          lastError = `Resend: ${resendErr.message}`;
        }
      }

      // Try Brevo API if configured
      if (!sent && brevoApiKey) {
        try {
          await sendEmailViaBrevo(brevoApiKey, category, message, email, req.user.name, createdAt);
          console.log(`[Email] Feedback mail sent successfully via Brevo HTTPS API`);
          db.run(
            `UPDATE feedbacks SET delivery_status = ?, delivery_error = null WHERE id = ?`,
            ['sent', feedbackId]
          );
          sent = true;
        } catch (brevoErr) {
          console.error('❌ [Email Diagnostics] Failed to deliver via Brevo API:', brevoErr.message);
          lastError = `Brevo: ${brevoErr.message}`;
        }
      }

      if (!sent) {
        let mailHost = process.env.SMTP_HOST || '';
        let mailPort = parseInt(process.env.SMTP_PORT || '587');
        let mailUser = process.env.SMTP_USER || '';
        let mailPass = process.env.SMTP_PASS || '';
        let isLocalMock = false;

        // Automatically spin up Ethereal Mail testing environment if credentials are not configured
        if (!mailHost || !mailUser || !mailPass) {
          try {
            console.log('ℹ️ [Feedback Diagnostics] SMTP credentials not set. Creating temporary Ethereal test account...');
            const testAccount = await nodemailer.createTestAccount();
            mailHost = 'smtp.ethereal.email';
            mailPort = 587;
            mailUser = testAccount.user;
            mailPass = testAccount.pass;
            isLocalMock = true;
          } catch (etherealErr) {
            console.error('⚠️ [Feedback Diagnostics] Failed to create Ethereal test account:', etherealErr.message);
            lastError = lastError ? `${lastError} | Ethereal: ${etherealErr.message}` : etherealErr.message;
          }
        }

        const mailOptions = {
          from: `"SpendAchu App" <${mailUser || 'noreply@spendachu.com'}>`,
          to: process.env.ADMIN_EMAIL || 'spendachu@gmail.com',
          subject: `SpendAchu Feedback [${category.toUpperCase()}] - ${req.user.name}`,
          text: `Feedback Received!\n\nUser: ${req.user.name}\nEmail: ${email}\nCategory: ${category}\nSubmitted At: ${new Date(createdAt).toLocaleString()}\n\nMessage:\n----------------------------------------\n${message}\n----------------------------------------\n`
        };

        if (mailHost && mailUser && mailPass) {
          try {
            const transporter = await createMailTransporter(mailHost, mailPort, mailUser, mailPass);
            const info = await transporter.sendMail(mailOptions);
            const status = isLocalMock ? 'simulated' : 'sent';
            
            db.run(
              `UPDATE feedbacks SET delivery_status = ?, delivery_error = ? WHERE id = ?`,
              [status, isLocalMock ? `Preview URL: ${nodemailer.getTestMessageUrl(info)}` : null, feedbackId]
            );

            if (isLocalMock) {
              const previewUrl = nodemailer.getTestMessageUrl(info);
              console.log('\n=================== MOCK EMAIL SENT ===================');
              console.log(`To: ${mailOptions.to}`);
              console.log(`Subject: ${mailOptions.subject}`);
              console.log(`Preview URL: ${previewUrl}`);
              console.log('=======================================================\n');
            } else {
              console.log(`[Email] Feedback mail sent successfully to spendachu@gmail.com from ${email}`);
            }
            sent = true;
          } catch (mailErr) {
            console.error('❌ [Email Diagnostics] Failed to deliver feedback email:', mailErr.message);
            lastError = lastError ? `${lastError} | SMTP: ${mailErr.message}` : mailErr.message;
          }
        }
      }

      if (sent) {
        res.status(201).json({ success: true, message: 'Feedback submitted and email sent successfully.' });
      } else {
        db.run(
          `UPDATE feedbacks SET delivery_status = ?, delivery_error = ? WHERE id = ?`,
          ['failed', lastError || 'Unknown dispatch error', feedbackId]
        );
        res.status(500).json({ error: `Failed to deliver email: ${lastError}` });
      }
    }
  );
});


// Clean up old trash records automatically on server startup
setInterval(() => {
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - THIRTY_DAYS;
  db.run(`DELETE FROM trash WHERE deleted_at < ?`, [cutoff], (err) => {
    if (err) console.error('Failed to auto-purge trash:', err);
  });
}, 24 * 60 * 60 * 1000); // Once every 24 hours

// Serve static frontend files in production
app.use(express.static(path.join(__dirname, '../dist')));

// Wildcard fallback route to support SPA client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start server after initializing database
const { initializeDatabase } = require('./services/dbConnector');

initializeDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server listening on host 0.0.0.0:${PORT}`);
    checkSMTPSetup();
  });
}).catch(err => {
  console.error("❌ FAILED to initialize database and run migrations. Aborting server startup.", err);
  process.exit(1);
});

// Verify email service connection on startup
async function checkSMTPSetup() {
  const resendApiKey = process.env.RESEND_API_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;

  if (resendApiKey) {
    console.log('✅ [Email] Resend API Key detected. Emails will be sent via Resend HTTPS API (port 443).');
    return;
  }
  if (brevoApiKey) {
    console.log('✅ [Email] Brevo API Key detected. Emails will be sent via Brevo HTTPS API (port 443).');
    return;
  }

  const mailHost = process.env.SMTP_HOST;
  const mailUser = process.env.SMTP_USER;
  const mailPass = process.env.SMTP_PASS;
  
  if (mailHost && mailUser && mailPass) {
    console.log('⚠️ [Email] WARNING: Only SMTP credentials detected (no Resend/Brevo API key).');
    console.log('⚠️ [Email] Cloud hosts like Render.com block outbound SMTP ports (25/465/587).');
    console.log('⚠️ [Email] Emails will likely fail with "Connection timeout" on Render.');
    console.log('⚠️ [Email] FIX: Set RESEND_API_KEY env variable. Get a free key at https://resend.com');
    
    const mailPort = parseInt(process.env.SMTP_PORT || '587');
    try {
      const testTransporter = await createMailTransporter(mailHost, mailPort, mailUser, mailPass);
      testTransporter.verify((err) => {
        if (err) {
          console.error('⚠️ [SMTP Diagnostics] Connection verification failed on boot:', err.message);
        } else {
          console.log('✅ [SMTP Diagnostics] Connection verified successfully. Ready to send emails.');
        }
      });
    } catch (err) {
      console.error('⚠️ [SMTP Diagnostics] Transporter verification setup failed on boot:', err.message);
    }
  } else {
    console.log('ℹ️ [Email] No email credentials detected. Operating in mock/testing fallback mode.');
    console.log('ℹ️ [Email] To enable email delivery, set RESEND_API_KEY env variable.');
  }
}
