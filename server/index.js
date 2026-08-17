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




// ── Receipt Scanning via Gemini Vision API ───────────────────────────────────
const getGeminiApiKey = () => process.env.FINANCIAL_ASSISTANT_API_KEY || process.env.GEMINI_API_KEY || '';

/**
 * Scan a receipt image using Gemini Vision API.
 * Tries models in order: gemini-1.5-flash, gemini-2.0-flash, gemini-1.5-flash-latest
 *
 * @param {string} base64Data - Base64-encoded image data
 * @param {string} mimeType   - MIME type (e.g. image/jpeg)
 * @returns {Promise<object>}  Parsed receipt data
 */
const scanReceiptWithGemini = (base64Data, mimeType) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return Promise.reject(new Error('Gemini API key not configured. Please set GEMINI_API_KEY or FINANCIAL_ASSISTANT_API_KEY in Render environment variables.'));
  }

  const prompt = `You are a receipt data extractor. Analyze this receipt image and extract structured information.

Return ONLY a valid JSON object with exactly these fields (no markdown, no explanation):
{
  "merchant": "Store or restaurant name (string, or null if not found)",
  "amount": <total amount as a number, or null if not found>,
  "date": "YYYY-MM-DD format (or today's date if not found)",
  "time": "HH:MM in 24h format (or null if not found)",
  "category": "One of: Food, Transport, Rent, Shopping, Bills, Entertainment, Others",
  "paymentMethod": "One of: Cash, GPay, UPI, Card, Bank Transfer",
  "tax": <tax amount as number or null>,
  "notes": "brief description of what was purchased (or null)",
  "confidence": {
    "merchant": true or false,
    "amount": true or false,
    "date": true or false,
    "time": true or false
  }
}

For confidence: set false if the value was unclear, estimated, or not found on the receipt.
For category: infer from the merchant name or items purchased.
For paymentMethod: look for payment type on receipt, default to Cash if unclear.
Today's date is ${new Date().toISOString().split('T')[0]}.`;

  const requestBody = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Data
          }
        }
      ]
    }],
    generationConfig: {
      maxOutputTokens: 512,
      temperature: 0.1
    }
  });

  const modelsToTry = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];

  const attemptModelScan = (modelIndex) => {
    if (modelIndex >= modelsToTry.length) {
      return Promise.reject(new Error('Could not process receipt with available AI models. Please try again.'));
    }

    const modelName = modelsToTry[modelIndex];
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      console.log(`📤 [Gemini Receipt] Attempting scan with model "${modelName}"...`);

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              console.error(`❌ [Gemini Receipt] Model "${modelName}" HTTP ${res.statusCode}:`, body.substring(0, 200));
              if (res.statusCode === 404 || res.statusCode === 400) {
                // Try next model if 404 or bad request
                return attemptModelScan(modelIndex + 1).then(resolve).catch(reject);
              }
              return reject(new Error(`Receipt scanning failed. Please try again. (HTTP ${res.statusCode})`));
            }

            const parsed = JSON.parse(body);
            const rawText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const cleaned = rawText
              .replace(/```json/gi, '')
              .replace(/```/g, '')
              .trim();

            const result = JSON.parse(cleaned);
            console.log(`✅ [Gemini Receipt] Successfully extracted with "${modelName}": merchant=${result.merchant}, amount=${result.amount}`);
            resolve(result);
          } catch (parseErr) {
            console.error('❌ [Gemini Receipt] Failed to parse response:', body.substring(0, 200));
            reject(new Error('Could not read the receipt clearly. Please try a clearer photo.'));
          }
        });
      });

      req.setTimeout(30000, () => {
        req.destroy(new Error('Receipt scanning timed out. Please try again.'));
      });

      req.on('error', (e) => {
        console.error('❌ [Gemini Receipt] Connection error:', e.message);
        reject(new Error('Could not connect to scanning service. Please try again.'));
      });

      req.write(requestBody);
      req.end();
    });
  };

  return attemptModelScan(0);
};

/**
 * Call Gemini for any general question (not specific to financial data).
 * Used as a fallback when intent is unsupported.
 */
const callGeminiGeneral = (question, apiKey) => {
  return new Promise((resolve) => {
    if (!apiKey) {
      return resolve("Sorry, I need an API key to answer general questions. Please set FINANCIAL_ASSISTANT_API_KEY in Render.");
    }

    // Detect Tanglish
    const tanglishMarkers = /\b(evlo|evvalo|sollu|solla|kaatu|kaattu|panninen|pannen|panni|koduthen|vangichen|sela|selav|semippu|michi|pathi|enna|ippo|innikku|inniku|nethu|maasam|vaaram|lakshiyam|motham|jaasthi|kammi|theriyuma|purigiradha|epdi|naan|naanga|ungaluku)\b/i;
    const isTanglish = tanglishMarkers.test(question);

    const systemMsg = isTanglish
      ? `Nee SpendAchu app la oru friendly AI assistant. User Tanglish la (Tamil + English mixed) pesuvanga. Same style la answer pann — simple Tanglish use pannu, over-formal aagadhey. Short ah, helpful ah pesi. Any question kum answer pannu — finance, general knowledge, math, anything.`
      : `You are SpendAchu's friendly AI assistant. Answer the user's question helpfully and concisely. You can answer any question — finance, general knowledge, advice, math, anything. Be friendly and natural. Keep answers under 150 words.`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: `${systemMsg}\n\nUser: ${question}` }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(requestBody) }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          resolve(text?.trim() || "Sorry, I couldn't process that. Please try again!");
        } catch {
          resolve("Hmm, something went wrong. Please try again!");
        }
      });
    });

    req.setTimeout(15000, () => { req.destroy(); resolve("Taking too long to respond. Please try again!"); });
    req.on('error', () => resolve("Couldn't connect right now. Please try again!"));
    req.write(requestBody);
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

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_spendachu_9923';

const allowedOrigins = [
  'https://spendachu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, server-to-server) or listed origins
    if (!origin || allowedOrigins.includes(origin) || (origin && origin.endsWith('.vercel.app'))) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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
const {
  runDailyBackup,
  listBackups
} = require('./services/backupService');
const financialAnalytics = require('./services/financialChatAnalyticsService');
const { resolveDateExpression, getCurrentMonthYear, getPreviousMonthYear } = require('./services/financialChatDateResolver');
const { sanitizeInput, classifyIntent, validateIntent, extractCategory, extractMerchant, getSuggestedQuestions } = require('./services/financialChatIntentClassifier');
const { formatResponse, getProviderStatus } = require('./services/financialChatAIProvider');
const rateLimiter = require('./services/financialChatRateLimiter');
const sessionService = require('./services/financialChatSessionService');

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

          const sessionToken = jwt.sign(
            { id: userId, email: normalizedEmail, name: name },
            JWT_SECRET,
            { expiresIn: '30d' }
          );

          res.status(201).json({
            user: { name, email: normalizedEmail, has_seen_tutorial: false },
            token: sessionToken
          });
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
        user: { name: user.name, email: user.email, profile_picture: user.profile_picture || null, has_seen_tutorial: !!user.has_seen_tutorial },
        token: sessionToken
      });
    }
  );
});

// Verify Session
app.get('/api/verify', authenticateJWT, (req, res) => {
  db.get(`SELECT name, email, profile_picture, has_seen_tutorial FROM users WHERE email = ?`, [req.user.email], (err, user) => {
    if (err || !user) {
      return res.status(200).json({
        user: { name: req.user.name, email: req.user.email, has_seen_tutorial: false }
      });
    }
    res.status(200).json({
      user: { name: user.name, email: user.email, profile_picture: user.profile_picture || null, has_seen_tutorial: !!user.has_seen_tutorial }
    });
  });
});

// Complete Website Tutorial
app.post('/api/user/complete-tutorial', authenticateJWT, (req, res) => {
  db.run(
    `UPDATE users SET has_seen_tutorial = TRUE WHERE id = ?`,
    [req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update tutorial state.' });
      res.status(200).json({ success: true });
    }
  );
});

// Update Profile Picture
app.post('/api/user/profile-picture', authenticateJWT, (req, res) => {
  const { profile_picture } = req.body;
  db.run(
    `UPDATE users SET profile_picture = ? WHERE email = ?`,
    [profile_picture || null, req.user.email],
    function (err) {
      if (err) {
        console.error('Failed to update profile picture:', err);
        return res.status(500).json({ error: 'Failed to update profile picture.' });
      }
      res.status(200).json({ success: true, profile_picture: profile_picture || null });
    }
  );
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
// Scan Receipt and Extract Details via Gemini Vision
app.post('/api/expenses/scan-receipt', authenticateJWT, (req, res) => {
  const { image, mimeType } = req.body;
  if (!image || !mimeType) {
    return res.status(400).json({ error: 'Image and mimeType are required.' });
  }

  scanReceiptWithGemini(image, mimeType)
    .then(result => {
      res.json(result);
    })
    .catch(err => {
      console.error('❌ [Gemini Receipt Scan Error]:', err.message);
      res.status(500).json({ error: err.message });
    });
});

app.get('/api/expenses', authenticateJWT, (req, res) => {
  db.all(
    `SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC, id DESC`,
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

    notifyUser({
      userId: req.user.id,
      type: 'unusual_expense',
      title: 'Unusual Expense Detected 🚨',
      message: `A large transaction of ₹${amtFloat.toLocaleString()} under "${category}" was added.`,
      relatedId: expenseId,
      relatedPage: 'expenses',
      eventKey: `anom_usr_${req.user.id}_${Date.now()}`
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

      res.status(201).json({ id: expenseId });
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
    `SELECT * FROM savings WHERE user_id = ? ORDER BY date DESC, created_at DESC, id DESC`,
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
      
      res.status(201).json({ id: savingId });
    }
  );
});

// Update Saving
app.put('/api/savings/:id', authenticateJWT, (req, res) => {
  const { amount, description } = req.body;
  const amtFloat = parseFloat(amount);

  if (isNaN(amtFloat) || amtFloat <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  db.run(
    `UPDATE savings SET amount = ?, description = ? WHERE id = ? AND user_id = ?`,
    [amtFloat, description || '', req.params.id, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to update saving.' });
      if (this.changes === 0) return res.status(404).json({ error: 'Saving entry not found.' });
      res.status(200).json({ success: true });
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
  const { name, targetAmount, target_amount, savedAmount, saved_amount, deadline, category, priority, notes, allowExceed } = req.body;
  const rawTarget = targetAmount !== undefined ? targetAmount : target_amount;
  const rawSaved = savedAmount !== undefined ? savedAmount : saved_amount;
  
  const target = parseFloat(rawTarget);
  const saved = parseFloat(rawSaved || 0);

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
        createdAt: Date.now()
      });
    }
  );
});

// Update Goal
app.put('/api/goals/:id', authenticateJWT, (req, res) => {
  const { name, targetAmount, target_amount, savedAmount, saved_amount, deadline, category, priority, notes, status, allowExceed } = req.body;
  const rawTarget = targetAmount !== undefined ? targetAmount : target_amount;
  const rawSaved = savedAmount !== undefined ? savedAmount : saved_amount;

  const target = parseFloat(rawTarget);
  const saved = parseFloat(rawSaved !== undefined ? rawSaved : 0);

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
  } else if (finalStatus === 'completed' && saved < target) {
    finalStatus = 'active';
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

      res.status(200).json({
        id: req.params.id,
        name: name.trim(),
        targetAmount: target,
        savedAmount: saved,
        deadline,
        category: category || 'Others',
        priority: priority || 'medium',
        notes: notes || '',
        status: finalStatus
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

      const newSaved = (parseFloat(goal.saved_amount) || 0) + savingAmt;
      const targetAmt = parseFloat(goal.target_amount) || 0;
      if (newSaved > targetAmt && !allowExceed) {
        return res.status(400).json({ error: 'Saved amount cannot exceed target amount.' });
      }

      const newStatus = newSaved >= targetAmt ? 'completed' : goal.status;

      db.run(
        `UPDATE financial_goals SET saved_amount = ?, status = ? WHERE id = ? AND user_id = ?`,
        [newSaved, newStatus, req.params.id, req.user.id],
        async function (updateErr) {
          if (updateErr) return res.status(500).json({ error: 'Failed to add savings to goal.' });
          
          const isNewlyCompleted = newStatus === 'completed' && goal.status !== 'completed';
          if (isNewlyCompleted) {
            notifyUser({
              userId: req.user.id,
              type: 'goal_completed',
              title: 'Financial Goal Achieved! 🎉',
              message: `Congratulations! You have reached your target for "${goal.name}".`,
              relatedId: req.params.id,
              relatedPage: 'budgeting',
              eventKey: `goal_comp_${req.params.id}`
            });
          } else if (targetAmt > 0) {
            const pct = (newSaved / targetAmt) * 100;
            const oldPct = ((parseFloat(goal.saved_amount) || 0) / targetAmt) * 100;
            if (pct >= 75 && oldPct < 75) {
              notifyUser({
                userId: req.user.id,
                type: 'goal_progress',
                title: 'Goal Progress (75%) 🎯',
                message: `Great progress! You have saved 75% of your target for "${goal.name}".`,
                relatedId: req.params.id,
                relatedPage: 'budgeting',
                eventKey: `goal_75_${req.params.id}`
              });
            } else if (pct >= 50 && oldPct < 50) {
              notifyUser({
                userId: req.user.id,
                type: 'goal_progress',
                title: 'Goal Milestone (50%) 🎯',
                message: `Halfway there! You have saved 50% of your target for "${goal.name}".`,
                relatedId: req.params.id,
                relatedPage: 'budgeting',
                eventKey: `goal_50_${req.params.id}`
              });
            }
          }

          res.status(200).json({
            success: true,
            id: req.params.id,
            savedAmount: newSaved,
            status: newStatus,
            completed: isNewlyCompleted,
            unlockedAchievements: []
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
// User Notification Endpoints
// ==========================================================================

// GET /api/user/notifications - Fetch authenticated user's notifications
app.get('/api/user/notifications', authenticateJWT, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50');
    const offset = parseInt(req.query.offset || '0');
    const result = await getUserNotifications(req.user.id, limit, offset);
    res.status(200).json(result);
  } catch (err) {
    console.error('Error fetching user notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// PATCH /api/user/notifications/read-all - Mark all user notifications as read
app.patch('/api/user/notifications/read-all', authenticateJWT, async (req, res) => {
  try {
    const updatedCount = await markAllUserNotificationsRead(req.user.id);
    res.status(200).json({ success: true, updatedCount });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ error: 'Failed to mark all notifications read.' });
  }
});

// PATCH /api/user/notifications/:id/read - Mark single user notification as read
app.patch('/api/user/notifications/:id/read', authenticateJWT, async (req, res) => {
  try {
    const success = await markUserNotificationRead(req.user.id, req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: 'Failed to mark notification read.' });
  }
});

// DELETE /api/user/notifications/:id - Delete a user notification
app.delete('/api/user/notifications/:id', authenticateJWT, async (req, res) => {
  try {
    const success = await deleteUserNotification(req.user.id, req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: 'Failed to delete notification.' });
  }
});

// ==========================================================================
// Database Backup & Recovery Admin Endpoints
// ==========================================================================

// GET /api/admin/backups - List database backups & retention status
app.get('/api/admin/backups', authenticateJWT, requireAdmin, (req, res) => {
  try {
    const backups = listBackups();
    res.status(200).json(backups);
  } catch (err) {
    console.error('Error fetching backups:', err);
    res.status(500).json({ error: 'Failed to fetch database backups.' });
  }
});

// POST /api/admin/backups/create - Trigger manual backup
app.post('/api/admin/backups/create', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const result = await runDailyBackup();
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Error creating manual backup:', err);
    res.status(500).json({ error: 'Failed to create manual backup.' });
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

// ==========================================================================
// Financial Assistant (Ask SpendAchu) Endpoints
// ==========================================================================

// POST /api/financial-assistant/chat — Main chat endpoint
app.post('/api/financial-assistant/chat', authenticateJWT, async (req, res) => {
  const userId = req.user.id; // ALWAYS from JWT, never from req.body
  const startTime = Date.now();
  let currentIntent = 'unsupported';

  try {
    // Step 1: Validate and sanitize input
    const { isValid, sanitized, error, isInjectionAttempt } = sanitizeInput(req.body.question);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: error || 'Invalid question.',
        isInjectionAttempt: !!isInjectionAttempt
      });
    }

    // Step 2: Rate limiting
    const rateCheck = rateLimiter.checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ success: false, error: rateCheck.reason });
    }
    rateLimiter.startRequest(userId);

    try {
      // Step 3: Get conversation context for follow-up support
      const context = sessionService.getContext(userId);

      // Step 4: Classify intent
      const { intent: rawIntent, params: rawParams, inheritedContext } = classifyIntent(sanitized, context);
      currentIntent = validateIntent(rawIntent);

      // Step 5: Resolve date parameters
      const { month: currMonth, year: currYear } = getCurrentMonthYear();
      const { month: prevMonth, year: prevYear } = getPreviousMonthYear();

      let period = resolveDateExpression(sanitized);

      // Step 6: Merge inherited context params
      const params = { ...rawParams };
      if (inheritedContext) {
        if (!params.category && context.previousCategory) params.category = context.previousCategory;
        if (!params.merchant && context.previousMerchant) params.merchant = context.previousMerchant;
        if (!params.goalId && context.previousGoalId) params.goalId = context.previousGoalId;
        // Inherit date only if question contains date keyword
        if (context.previousDatePeriod && /\b(last|this|month|week|year|today|yesterday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(sanitized)) {
          // Use newly resolved period from current question
        }
      }

      // Step 7: Call allowlisted analytics function
      let financialResult = null;

      switch (currentIntent) {
        case 'expense_total':
          financialResult = await financialAnalytics.getExpenseTotal(userId, period.startDate, period.endDate);
          break;

        case 'expense_by_category':
          if (params.category) {
            // Single category query
            const allCats = await financialAnalytics.getExpensesByCategory(userId, period.startDate, period.endDate);
            const match = allCats.categories?.find(c => c.category.toLowerCase() === params.category.toLowerCase());
            if (match) {
              financialResult = {
                hasEnoughData: true,
                category: match.category,
                total: match.total,
                totalFormatted: match.totalFormatted,
                transactionCount: match.count,
                percentageOfTotal: match.percentage,
                currency: 'INR'
              };
            } else {
              financialResult = {
                hasEnoughData: false,
                missingData: [`${params.category} expenses`],
                friendlyMessage: `No ${params.category} expenses found in ${period.label}.`,
                categories: allCats.categories || []
              };
            }
          } else {
            financialResult = await financialAnalytics.getExpensesByCategory(userId, period.startDate, period.endDate);
          }
          break;

        case 'expense_by_merchant':
          financialResult = await financialAnalytics.getExpensesByMerchant(userId, params.merchant, period.startDate, period.endDate);
          break;

        case 'expense_highest':
          financialResult = await financialAnalytics.getHighestExpense(userId, period.startDate, period.endDate);
          break;

        case 'expense_recent':
          financialResult = await financialAnalytics.getRecentExpenses(userId, params.limit || 5);
          break;

        case 'expense_comparison': {
          const prevPeriod = resolveDateExpression('last month');
          const currPeriod = resolveDateExpression('this month');
          financialResult = await financialAnalytics.compareExpensePeriods(userId, currPeriod, prevPeriod);
          break;
        }

        case 'expense_day_breakdown':
          financialResult = await financialAnalytics.getExpenseDayBreakdown(userId, period.startDate, period.endDate);
          break;

        case 'savings_summary':
          financialResult = await financialAnalytics.getSavingsSummary(userId, period.startDate, period.endDate);
          break;

        case 'budget_summary':
          financialResult = await financialAnalytics.getBudgetSummary(userId, currMonth, currYear);
          period = {
            startDate: `${currYear}-${String(currMonth).padStart(2, '0')}-01`,
            endDate: `${currYear}-${String(currMonth).padStart(2, '0')}-${new Date(currYear, currMonth, 0).getDate()}`,
            label: new Date(currYear, currMonth - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
          };
          break;

        case 'goal_progress':
          financialResult = await financialAnalytics.getGoalProgress(userId, params.goalId || null);
          break;

        case 'financial_health':
          financialResult = await financialAnalytics.getFinancialHealthSummary(userId);
          break;

        case 'saving_challenge':
          financialResult = await financialAnalytics.getSavingChallengeSummary(userId);
          break;

        case 'anomaly_summary':
          financialResult = await financialAnalytics.getAnomalySummary(userId, period.startDate, period.endDate);
          break;

        case 'monthly_summary':
          financialResult = await financialAnalytics.getMonthlyFinancialSummary(userId, currMonth, currYear);
          break;

        case 'saving_recommendations':
          financialResult = await financialAnalytics.generateRuleBasedSavingRecommendations(
            userId,
            period.startDate,
            period.endDate
          );
          break;

        case 'unsupported':
        default: {
          // For unsupported/general questions, use Gemini directly as a general AI
          const generalAnswer = await callGeminiGeneral(sanitized, GEMINI_RECEIPT_API_KEY);
          const processingMs0 = Date.now() - startTime;
          console.log(`[FinancialChat] user=${userId.substring(0, 8)}... intent=general_ai ms=${processingMs0} success=true`);
          return res.status(200).json({
            success: true,
            data: {
              intent: 'general',
              answer: generalAnswer,
              period: null,
              metrics: null,
              hasEnoughData: true,
              missingData: [],
              suggestedQuestions: [
                'How much did I spend this month?',
                'What is my budget status?',
                'How are my savings going?'
              ],
              processingMs: processingMs0
            }
          });
        }
      }

      // Step 8: Format response with AI (with deterministic fallback)
      const answer = await formatResponse(currentIntent, financialResult, period, sanitized);

      // Step 9: Build suggested questions
      const suggestedQuestions = getSuggestedQuestions(currentIntent, params.category);

      // Step 10: Update conversation context
      sessionService.updateContext(userId, {
        intent: currentIntent,
        period,
        category: params.category || null,
        merchant: params.merchant || null,
        goalId: params.goalId || null
      });

      // Step 11: Save to history (non-blocking, optional)
      if (sessionService.isSaveHistoryEnabled()) {
        sessionService.getOrCreateSessionId(userId).then(sessionId => {
          sessionService.saveMessage(userId, sessionId, 'user', sanitized, null);
          sessionService.saveMessage(userId, sessionId, 'assistant', answer, currentIntent);
        }).catch(() => {}); // Non-blocking
      }

      // Step 12: Safe operational log (no financial data logged)
      const processingMs = Date.now() - startTime;
      console.log(`[FinancialChat] user=${userId.substring(0, 8)}... intent=${currentIntent} ms=${processingMs} success=true`);

      // Step 13: Return structured response
      return res.status(200).json({
        success: true,
        data: {
          intent: currentIntent,
          answer,
          period,
          metrics: financialResult?.hasEnoughData ? extractMetrics(currentIntent, financialResult) : null,
          hasEnoughData: financialResult?.hasEnoughData ?? false,
          missingData: financialResult?.missingData || [],
          suggestedQuestions,
          processingMs
        }
      });

    } finally {
      rateLimiter.endRequest(userId);
    }

  } catch (err) {
    rateLimiter.endRequest(userId);
    const processingMs = Date.now() - startTime;
    console.error(`[FinancialChat] user=${userId?.substring(0, 8)}... intent=${currentIntent} ms=${processingMs} error=${err.message}`);

    return res.status(500).json({
      success: false,
      error: 'Something went wrong while processing your question. Please try again.',
      intent: currentIntent
    });
  }
});

// Helper: extract key metrics from financial result for frontend summary cards
function extractMetrics(intent, result) {
  if (!result) return null;
  try {
    switch (intent) {
      case 'expense_total':
        return { amount: result.total, currency: 'INR', transactionCount: result.transactionCount };
      case 'expense_by_category':
        return { amount: result.total || result.grandTotal, currency: 'INR', transactionCount: result.transactionCount };
      case 'savings_summary':
        return { amount: result.totalSavings, currency: 'INR', savingsRate: result.savingsRate };
      case 'budget_summary':
        return { remaining: result.remaining, globalBudget: result.globalBudget, usedPercent: result.budgetUsedPercent, currency: 'INR' };
      case 'goal_progress':
        return { activeGoals: result.activeCount, completedGoals: result.completedCount };
      case 'financial_health':
        return { score: result.totalScore, level: result.level };
      case 'expense_comparison':
        return result.comparison ? { ...result.comparison, currency: 'INR' } : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// GET /api/financial-assistant/suggestions — Get default suggested questions
app.get('/api/financial-assistant/suggestions', authenticateJWT, (req, res) => {
  res.status(200).json({
    success: true,
    suggestions: [
      'How much did I spend this month?',
      'What is my highest spending category?',
      'How much budget is remaining?',
      'What is my savings rate?',
      'How are my financial goals progressing?',
      'Compare this month with last month.'
    ]
  });
});

// DELETE /api/financial-assistant/session — Clear conversation context
app.delete('/api/financial-assistant/session', authenticateJWT, async (req, res) => {
  try {
    await sessionService.deleteHistory(req.user.id);
    sessionService.clearContext(req.user.id);
    res.status(200).json({ success: true, message: 'Conversation cleared.' });
  } catch (err) {
    console.error('[FinancialChat] Session clear error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to clear conversation.' });
  }
});

// GET /api/financial-assistant/status — Assistant status and config
app.get('/api/financial-assistant/status', authenticateJWT, (req, res) => {
  const providerInfo = getProviderStatus();
  const rateLimitInfo = rateLimiter.getRateLimitStatus(req.user.id);
  res.status(200).json({
    success: true,
    status: 'operational',
    provider: providerInfo.provider,
    aiEnabled: providerInfo.aiEnabled,
    rateLimits: rateLimitInfo,
    historyEnabled: sessionService.isSaveHistoryEnabled()
  });
});

// GET /api/financial-assistant/history — Get chat history (when enabled)
app.get('/api/financial-assistant/history', authenticateJWT, async (req, res) => {
  try {
    if (!sessionService.isSaveHistoryEnabled()) {
      return res.status(200).json({ success: true, messages: [], historyEnabled: false });
    }
    const messages = await sessionService.getHistory(req.user.id);
    res.status(200).json({ success: true, messages, historyEnabled: true });
  } catch (err) {
    console.error('[FinancialChat] History fetch error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch history.' });
  }
});

// DELETE /api/financial-assistant/history — Delete chat history
app.delete('/api/financial-assistant/history', authenticateJWT, async (req, res) => {
  try {
    await sessionService.deleteHistory(req.user.id);
    res.status(200).json({ success: true, message: 'Chat history deleted.' });
  } catch (err) {
    console.error('[FinancialChat] History delete error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete history.' });
  }
});

// ==========================================================================
// AI Copilot Agent Endpoint (POST /api/agent)
// ==========================================================================

/**
 * Parse natural-language user message via Gemini and return a structured action.
 * Follows the same raw-https pattern used by scanReceiptWithGemini().
 */
const callGeminiAgent = (message, apiKey, today) => {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      return reject(new Error('Gemini API key not configured.'));
    }

    const systemPrompt = `You are Spendachu's AI Copilot. The user is talking to you via a chat interface.
Your job: parse the user's message and return ONLY a valid JSON object — no markdown, no explanation.

Today's date: ${today}
Default currency: INR (₹)

Supported actions:

1. ADD_EXPENSE — when user wants to log / record a spending:
   { "action": "ADD_EXPENSE", "amount": <number>, "category": "<string>", "title": "<string>", "date": "<YYYY-MM-DD>" }
   - category MUST be one of: Food, Transport, Rent, Shopping, Bills, Entertainment, Others
   - title = short description (e.g. "Lunch", "Petrol", "Netflix")
   - If amount is clearly mentioned, extract it. If completely missing, use CLARIFY.

2. GET_SUMMARY — when user asks about spending totals or reports from their own data:
   { "action": "GET_SUMMARY", "timeframe": "<today|week|month>", "category": "<string|null>" }
   - timeframe: "today" for today, "week" for this week, "month" for this month (default)
   - Detect Tamil/Tanglish: "iniku" = today, "vaaram" = week, "maasam" = month

3. GENERAL_QUERY — for ANY other question: greetings, SpendAchu app questions, finance tips, general knowledge, how-to questions about the app, etc.:
   { "action": "GENERAL_QUERY" }
   NOTE: Do NOT include a reply field — the system will generate a rich answer separately.

4. CLARIFY — when amount is missing or intent is unclear:
   { "action": "CLARIFY", "question": "<ask the user what you need to know, in same language>" }

Language rules:
- Detect Tamil/Tanglish by words like: evlo, pannen, panni, iniku, vaaram, maasam, enna, epdi, sollu, etc.
- Examples: "Spent 150 for lunch" → ADD_EXPENSE
- "Canteen tea 20" → ADD_EXPENSE ₹20 Food
- "Uber ride 250 rs" → ADD_EXPENSE ₹250 Transport
- "Fuel 300" → ADD_EXPENSE ₹300 Transport
- "Iniku evlo spend pannen?" → GET_SUMMARY today
- "This month's total" → GET_SUMMARY month
- "How to add expense?" → GENERAL_QUERY
- "What is SpendAchu?" → GENERAL_QUERY
- "Receipt scan panna epdi?" → GENERAL_QUERY
- "Hello" → GENERAL_QUERY
- "Add expense" (no amount) → CLARIFY

Return ONLY the JSON object.`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\nUser message: "${message}"` }] }],
      generationConfig: { maxOutputTokens: 150, temperature: 0.1 }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(requestBody) }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const raw = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const action = JSON.parse(cleaned);
          resolve(action);
        } catch {
          reject(new Error('Failed to parse Gemini agent response.'));
        }
      });
    });

    req.setTimeout(15000, () => { req.destroy(new Error('Gemini agent timeout.')); });
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
};

/**
 * Rich Gemini call for GENERAL_QUERY — includes full SpendAchu website knowledge.
 * No token limit on reply. Responds in same language as user (English/Tamil/Tanglish).
 */
const callGeminiAgentGeneral = (userMessage, apiKey) => {
  return new Promise((resolve) => {
    if (!apiKey) {
      return resolve("I'm having trouble connecting right now. Please try again!");
    }

    const tanglishMarkers = /\b(evlo|evvalo|sollu|solla|pann|pannen|panni|iniku|inniku|nethu|maasam|vaaram|enna|epdi|naan|naanga|ungaluku|theriyuma|purigiradha|seri|okay|ok|appuram|aprom|ithu|antha|inga|andha|yenna|yepdi|illa|illai|than|thaan|iruku|irukkaa|irukku)\b/i;
    const isTanglish = tanglishMarkers.test(userMessage);

    const spendachuKnowledge = `
SpendAchu is an AI-powered personal expense tracker web app. Here is everything about it:

## Core Features:
1. **Expense Tracking** — Add expenses with amount, category, date, payment method, merchant name, notes. Categories: Food, Transport, Rent, Shopping, Bills, Entertainment, Others. Payment methods: Cash, GPay, UPI, Card, Bank Transfer.
2. **Savings Tracking** — Log savings entries separately from expenses.
3. **Budget Management** — Set monthly budget limits per category. Get alerts when near or over budget.
4. **AI Receipt Scanner** — Take a photo of any receipt → AI (Gemini Vision) auto-fills all fields. Supports JPEG/PNG.
5. **AI Insights** — Auto-generated spending patterns and suggestions based on your data.
6. **Financial Goals** — Create savings goals with target amount, deadline, category. Track progress. Deposit savings to goals.
7. **Ask SpendAchu (Financial Q&A)** — Chat interface to ask analytical questions about your spending data (e.g. "What's my highest spending category?").
8. **AI Copilot (this feature!)** — Log expenses and get summaries using natural language in English, Tamil, or Tanglish.
9. **Recently Deleted / Trash** — Deleted expenses go to trash for 30 days before permanent deletion. Can restore.
10. **Export CSV** — Download all expenses as a CSV file.
11. **Dark/Light Mode** — Toggle theme.
12. **Duplicate Detection** — App warns if you try to add a duplicate expense (same amount, date, merchant).
13. **Weekly Email Reports** — Admin gets weekly spending summary emails.
14. **Notifications** — In-app notifications for budget alerts, goal milestones.
15. **Profile Management** — Change profile picture, currency settings, reminder preferences.
16. **Multi-device Sync** — Data synced via backend (Railway) so accessible from any device when logged in.

## How to use — Step by step:
- **Add expense manually**: Click "+ Add Expense" button (bottom right or top right) → fill form → Save.
- **Scan a receipt**: Click "📷 Scan Receipt" → take photo or upload image → AI fills the form → review → Save.
- **Add saving**: Click "+ Add Saving" → enter amount, date, description.
- **Set budget**: Go to "Budgeting" in sidebar → set monthly limits per category.
- **Create a goal**: Go to Dashboard → scroll to Financial Goals → click "+ New Goal".
- **Ask AI questions**: Go to "Ask SpendAchu" in sidebar → type your question.
- **Use AI Copilot**: Click "⚡ Ask AI" button (bottom right corner) → type in natural language.
- **View deleted items**: Click "Recently Deleted" in sidebar → restore or permanently delete.
- **Export data**: Go to Expenses table → click "Export CSV".
- **Change theme**: Click sun/moon icon in sidebar bottom.

## Supported categories and icons:
Food 🍽️ | Transport 🚗 | Rent 🏠 | Shopping 🛍️ | Bills 📄 | Entertainment 🎬 | Others 📌

## AI Copilot — what you can say:
- "Spent 150 for lunch" → logs ₹150 Food
- "Fuel 300 rs" → logs ₹300 Transport
- "This month's total" → shows your spending this month
- "Iniku evlo spend pannen?" → today's total in Tanglish
- General questions about the app or finance

## Technical info (for curious users):
- Frontend: React + Vite hosted on Vercel (spendachu.vercel.app)
- Backend: Node.js + Express + SQLite hosted on Railway
- AI: Google Gemini 1.5 Flash
- Auth: JWT tokens (30-day sessions)
`;

    const languageInstruction = isTanglish
      ? `The user is writing in Tanglish (Tamil + English mixed). Reply naturally in Tanglish — friendly, simple, conversational. Mix Tamil words with English naturally. Example style: "SpendAchu-la receipt scan panna romba easy! 📷 Scan Receipt button click panni photo eduthu upload pannu, AI automatically fill pannidu." Keep it warm and helpful.`
      : `Reply in clear, friendly English. Be helpful, concise, and warm. Use emojis where appropriate.`;

    const systemMsg = `You are the AI Copilot for SpendAchu, an expense tracking app. 
Answer the user's question using the knowledge base below about SpendAchu.
If the question is about something outside SpendAchu (general knowledge, math, etc.), answer that too helpfully.
${languageInstruction}
Keep answers under 200 words. Be specific and practical.

${spendachuKnowledge}`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: `${systemMsg}\n\nUser question: "${userMessage}"` }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(requestBody) }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          resolve(text?.trim() || "I'm here to help with SpendAchu! Ask me anything about the app or your finances.");
        } catch {
          resolve("I'm here to help! Ask me about SpendAchu features, how to add expenses, or anything else.");
        }
      });
    });

    req.setTimeout(15000, () => {
      req.destroy();
      resolve("Taking a bit long to respond. Please try again!");
    });
    req.on('error', () => resolve("Couldn't connect right now. Please try again!"));
    req.write(requestBody);
    req.end();
  });
};

/**
 * Get expense totals from DB for the agent's GET_SUMMARY action.
 */
const getAgentSummary = (userId, timeframe, category) => {
  return new Promise((resolve, reject) => {
    const today = new Date();
    let startDate;

    if (timeframe === 'today') {
      startDate = today.toISOString().split('T')[0];
    } else if (timeframe === 'week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      startDate = weekStart.toISOString().split('T')[0];
    } else {
      // month (default)
      startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    }

    const endDate = today.toISOString().split('T')[0];

    let query = `SELECT SUM(amount) as total, COUNT(*) as count FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?`;
    const params = [userId, startDate, endDate];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve({ total: row?.total || 0, count: row?.count || 0, startDate, endDate, timeframe, category });
    });
  });
};

// POST /api/agent — AI Copilot main endpoint
app.post('/api/agent', authenticateJWT, async (req, res) => {
  const userId = req.user.id;
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Message is required.' });
  }

  const trimmed = message.trim().substring(0, 500);
  const GEMINI_KEY = process.env.FINANCIAL_ASSISTANT_API_KEY || process.env.GEMINI_API_KEY || '';
  const today = new Date().toISOString().split('T')[0];

  try {
    console.log(`[Agent] user=${userId.substring(0, 8)}... message="${trimmed.substring(0, 60)}"`);

    let parsed;
    try {
      parsed = await callGeminiAgent(trimmed, GEMINI_KEY, today);
    } catch (geminiErr) {
      console.error('[Agent] Gemini call failed:', geminiErr.message);
      return res.status(200).json({
        success: true,
        type: 'chat',
        reply: "Sorry, I couldn't understand that. Try saying something like: \"Spent 150 for lunch\" or \"This month's total\"."
      });
    }

    const action = parsed?.action;

    // ── ADD_EXPENSE ────────────────────────────────────────────────────
    if (action === 'ADD_EXPENSE') {
      const amount = parseFloat(parsed.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(200).json({
          success: true,
          type: 'chat',
          reply: "I couldn't catch the amount. How much did you spend? (e.g. \"Lunch 150 rs\")"
        });
      }

      const validCategories = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Others'];
      const category = validCategories.includes(parsed.category) ? parsed.category : 'Others';
      const title = (parsed.title || category).substring(0, 100);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : today;

      await new Promise((resolve, reject) => {
        const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        db.run(
          `INSERT INTO expenses (id, user_id, date, amount, category, payment_method, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [expenseId, userId, date, amount, category, 'Others', title, Date.now()],
          (err) => { if (err) reject(err); else resolve(); }
        );
      });

      const emoji = { Food: '🍽️', Transport: '🚗', Rent: '🏠', Shopping: '🛍️', Bills: '📄', Entertainment: '🎬', Others: '📌' }[category] || '📌';
      const formattedAmount = `₹${amount.toLocaleString('en-IN')}`;

      console.log(`[Agent] ADD_EXPENSE user=${userId.substring(0, 8)}... amount=${amount} category=${category}`);

      return res.status(200).json({
        success: true,
        type: 'success',
        reply: `${emoji} Added **${formattedAmount}** for **${title}** under *${category}*`,
        data: { amount, category, title, date, action: 'ADD_EXPENSE' }
      });
    }

    // ── GET_SUMMARY ────────────────────────────────────────────────────
    if (action === 'GET_SUMMARY') {
      const timeframe = ['today', 'week', 'month'].includes(parsed.timeframe) ? parsed.timeframe : 'month';
      const category = parsed.category || null;

      const summary = await getAgentSummary(userId, timeframe, category);
      const formattedTotal = `₹${summary.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const timeLabel = timeframe === 'today' ? 'today' : timeframe === 'week' ? 'this week' : 'this month';
      const catLabel = category ? ` on ${category}` : '';

      const reply = summary.count === 0
        ? `No expenses recorded${catLabel} ${timeLabel}.`
        : `You spent **${formattedTotal}**${catLabel} ${timeLabel} across ${summary.count} transaction${summary.count !== 1 ? 's' : ''}.`;

      return res.status(200).json({
        success: true,
        type: 'insight',
        reply,
        data: { total: summary.total, count: summary.count, timeframe, category, action: 'GET_SUMMARY' }
      });
    }

    // ── CLARIFY ────────────────────────────────────────────────────────
    if (action === 'CLARIFY') {
      return res.status(200).json({
        success: true,
        type: 'chat',
        reply: parsed.question || "Could you tell me more? (e.g. amount, category)"
      });
    }

    // ── GENERAL_QUERY — rich Gemini call with full SpendAchu knowledge ──
    if (action === 'GENERAL_QUERY') {
      const richReply = await callGeminiAgentGeneral(trimmed, GEMINI_KEY);
      return res.status(200).json({
        success: true,
        type: 'chat',
        reply: richReply
      });
    }

    // Fallback
    return res.status(200).json({
      success: true,
      type: 'chat',
      reply: "I'm not sure what you mean. Try: \"Spent 200 for groceries\" or \"Show this month's total\"."
    });

  } catch (err) {
    console.error('[Agent] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: 'Agent error. Please try again.' });
  }
});

// Serve static frontend files in production
const distPath = path.join(__dirname, '../dist');
const indexPath = path.join(distPath, 'index.html');
app.use(express.static(distPath));

// Wildcard fallback route to support SPA client-side routing
app.get('*', (req, res) => {
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // dist/ was not built — show a helpful message instead of blank screen
    res.status(503).send(`
      <!DOCTYPE html>
      <html><head><title>SpendAchu</title>
      <style>
        body { font-family: -apple-system, sans-serif; background: #0a0f1d; color: #f0f9ff;
               display: flex; align-items: center; justify-content: center; min-height: 100vh;
               flex-direction: column; gap: 12px; margin: 0; }
        h1 { font-size: 1.5rem; color: #06b6d4; }
        p { opacity: 0.7; font-size: 0.95rem; max-width: 400px; text-align: center; }
      </style></head>
      <body>
        <h1>🚀 SpendAchu is starting up...</h1>
        <p>The server is running but the frontend build is missing. Please refresh in a moment, or check the Render build logs.</p>
      </body></html>
    `);
  }
});

// Start server after initializing database
const { initializeDatabase } = require('./services/dbConnector');

initializeDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server listening on host 0.0.0.0:${PORT}`);
    checkSMTPSetup();

    // Trigger initial daily backup on startup and schedule 24-hour backup runner
    runDailyBackup().catch(err => console.error('Startup daily backup error:', err));
    setInterval(() => {
      runDailyBackup().catch(err => console.error('Scheduled daily backup error:', err));
    }, 24 * 60 * 60 * 1000);
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
