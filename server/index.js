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




// Helper to query Gemini Vision API via HTTPS REST with confidence scoring
const queryGeminiVision = (apiKey, base64Data, mimeType) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            {
              text: `Analyze the provided receipt/bill image and extract the following fields in strict JSON format.
Choose the most appropriate category and payment method from the allowed lists.
Do not guess values; use null if a field is completely missing or illegible.
For the confidence map, set true if you are highly confident in the extracted value, or false if it is blurry, guess-work, low-confidence, or completely missing from the receipt.

Allowed categories: "Food", "Transport", "Rent", "Shopping", "Bills", "Entertainment", "Others"
Allowed payment methods: "Cash", "Card", "UPI", "Bank Transfer"

Expected JSON format:
{
  "merchant": "Merchant Name or null",
  "date": "YYYY-MM-DD format (use current date if missing: ${new Date().toISOString().split('T')[0]})",
  "time": "HH:MM format or null",
  "amount": 123.45 (number or null),
  "tax": 12.34 (number or null),
  "category": "One of the allowed categories",
  "paymentMethod": "One of the allowed payment methods",
  "notes": "Short description of items or note or null",
  "confidence": {
    "merchant": true,
    "date": true,
    "time": true,
    "amount": true,
    "tax": true,
    "category": true,
    "paymentMethod": true
  }
}
Return ONLY the raw JSON object inside no markdown block (do not enclose in \`\`\`json or \`\`\`).`
            }
          ]
        }
      ]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(body);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            let cleanJson = text.trim();
            if (cleanJson.startsWith('```')) {
              cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
            }
            resolve(JSON.parse(cleanJson));
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Gemini API returned status ${res.statusCode}: ${body}`));
        }
      });
    });

    // Set 25 seconds request timeout
    req.setTimeout(25000, () => {
      req.destroy(new Error('Request to Gemini API timed out after 25 seconds.'));
    });

    req.on('error', (e) => reject(e));
    req.write(payload);
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
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const nodemailer = require('nodemailer');
const { sendWelcomeWebhook } = require('./services/webhook');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'secret_spendachu_9923';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeTables();
  }
});

// Setup database tables
function initializeTables() {
  db.serialize(() => {
    // 1. Users
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )`);

    // 2. Expenses
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      merchant TEXT,
      time TEXT,
      tax REAL,
      notes TEXT
    )`);

    // 3. Savings
    db.run(`CREATE TABLE IF NOT EXISTS savings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL
    )`);

    // 4. Trash
    db.run(`CREATE TABLE IF NOT EXISTS trash (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      item TEXT NOT NULL,
      deleted_at INTEGER NOT NULL
    )`);

    // 5. Budgets
    db.run(`CREATE TABLE IF NOT EXISTS budgets (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )`);

    // 6. Feedbacks
    db.run(`CREATE TABLE IF NOT EXISTS feedbacks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      delivery_status TEXT,
      delivery_error TEXT,
      created_at INTEGER NOT NULL
    )`, (err) => {
      if (!err) {
        // Safe migrations for existing databases
        db.run(`ALTER TABLE feedbacks ADD COLUMN delivery_status TEXT`, () => {});
        db.run(`ALTER TABLE feedbacks ADD COLUMN delivery_error TEXT`, () => {});
        db.run(`ALTER TABLE expenses ADD COLUMN merchant TEXT`, () => {});
        db.run(`ALTER TABLE expenses ADD COLUMN time TEXT`, () => {});
        db.run(`ALTER TABLE expenses ADD COLUMN tax REAL`, () => {});
        db.run(`ALTER TABLE expenses ADD COLUMN notes TEXT`, () => {});
      }
    });
  });
}

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

  db.run(
    `INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)`,
    [userId, name, normalizedEmail, passwordHash],
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

          res.status(201).json({ name, email: normalizedEmail });
        }
      );
    }
  );
});

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
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

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
// Scan Receipt and Extract Details
app.post('/api/expenses/scan-receipt', authenticateJWT, (req, res) => {
  const { image, mimeType } = req.body;
  if (!image || !mimeType) {
    return res.status(400).json({ error: 'Image and mimeType are required.' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(503).json({ error: 'Gemini API is not configured on the server. Please set GEMINI_API_KEY.' });
  }

  queryGeminiVision(geminiApiKey, image, mimeType)
    .then(result => {
      res.json(result);
    })
    .catch(err => {
      console.error('❌ [Gemini Vision Scan Error]:', err.message);
      res.status(500).json({ error: 'Failed to scan receipt. Gemini API error: ' + err.message });
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

// Add Expense
app.post('/api/expenses', authenticateJWT, (req, res) => {
  const { date, amount, category, paymentMethod, description, merchant, time, tax, notes } = req.body;
  const amtFloat = parseFloat(amount);
  const taxFloat = tax ? parseFloat(tax) : 0;

  if (isNaN(amtFloat) || amtFloat <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

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
    function (err) {
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
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to add saving.' });
      res.status(201).json({ id: savingId });
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server listening on host 0.0.0.0:${PORT}`);
  checkSMTPSetup();
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
