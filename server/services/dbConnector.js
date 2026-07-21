const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const { createPreMigrationBackup, runDailyBackup } = require('./backupService');

const isProduction = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);

let sqliteDb = null;
let pgPool = null;

// Helper to translate SQLite query placeholders (?) to PostgreSQL ($1, $2, ...)
function translateQuery(sql) {
  if (!isProduction) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// Unified Database API Wrapper mimicking sqlite3
const db = {
  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = params || [];

    if (!isProduction) {
      return sqliteDb.run(sql, params, callback);
    } else {
      const translatedSql = translateQuery(sql);
      pgPool.query(translatedSql, params, (err, res) => {
        if (err) {
          console.error(`Postgres error executing SQL: ${translatedSql}`, err);
          return callback ? callback(err) : null;
        }
        const context = {
          lastID: null,
          changes: res.rowCount
        };
        if (callback) callback.call(context, null);
      });
    }
  },

  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = params || [];

    if (!isProduction) {
      return sqliteDb.get(sql, params, callback);
    } else {
      const translatedSql = translateQuery(sql);
      pgPool.query(translatedSql, params, (err, res) => {
        if (err) {
          console.error(`Postgres error executing SQL: ${translatedSql}`, err);
          return callback ? callback(err) : null;
        }
        if (callback) callback(null, res.rows[0]);
      });
    }
  },

  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = params || [];

    if (!isProduction) {
      return sqliteDb.all(sql, params, callback);
    } else {
      const translatedSql = translateQuery(sql);
      pgPool.query(translatedSql, params, (err, res) => {
        if (err) {
          console.error(`Postgres error executing SQL: ${translatedSql}`, err);
          return callback ? callback(err) : null;
        }
        if (callback) callback(null, res.rows || []);
      });
    }
  },

  serialize(callback) {
    if (!isProduction) {
      sqliteDb.serialize(callback);
    } else {
      if (callback) callback();
    }
  }
};

// Database migration schema definition
const MIGRATIONS = [
  {
    version: '001_initial_schema',
    up: async (runQuery) => {
      // 1. Users
      await runQuery(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL
        )
      `);
      // 2. Expenses
      await runQuery(`
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          date TEXT NOT NULL,
          amount DOUBLE PRECISION NOT NULL,
          category TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          description TEXT,
          created_at BIGINT NOT NULL
        )
      `);
      // 3. Savings
      await runQuery(`
        CREATE TABLE IF NOT EXISTS savings (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          date TEXT NOT NULL,
          amount DOUBLE PRECISION NOT NULL,
          description TEXT,
          created_at BIGINT NOT NULL
        )
      `);
      // 4. Trash
      await runQuery(`
        CREATE TABLE IF NOT EXISTS trash (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          item TEXT NOT NULL,
          deleted_at BIGINT NOT NULL
        )
      `);
      // 5. Budgets
      await runQuery(`
        CREATE TABLE IF NOT EXISTS budgets (
          user_id TEXT PRIMARY KEY,
          data TEXT NOT NULL
        )
      `);
      // 6. Feedbacks
      await runQuery(`
        CREATE TABLE IF NOT EXISTS feedbacks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          email TEXT NOT NULL,
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `);
    }
  },
  {
    version: '002_add_feedback_delivery_columns',
    up: async (runQuery) => {
      // Check if columns exist (for safety / idempotency)
      try {
        await runQuery(`ALTER TABLE feedbacks ADD COLUMN delivery_status TEXT`);
      } catch (e) {
        console.log('delivery_status column might already exist, skipping...');
      }
      try {
        await runQuery(`ALTER TABLE feedbacks ADD COLUMN delivery_error TEXT`);
      } catch (e) {
        console.log('delivery_error column might already exist, skipping...');
      }
    }
  },
  {
    version: '003_add_expenses_fields',
    up: async (runQuery) => {
      try {
        await runQuery(`ALTER TABLE expenses ADD COLUMN merchant TEXT`);
      } catch (e) {
        console.log('merchant column might already exist, skipping...');
      }
      try {
        await runQuery(`ALTER TABLE expenses ADD COLUMN time TEXT`);
      } catch (e) {
        console.log('time column might already exist, skipping...');
      }
      try {
        await runQuery(`ALTER TABLE expenses ADD COLUMN tax DOUBLE PRECISION`);
      } catch (e) {
        console.log('tax column might already exist, skipping...');
      }
      try {
        await runQuery(`ALTER TABLE expenses ADD COLUMN notes TEXT`);
      } catch (e) {
        console.log('notes column might already exist, skipping...');
      }
    }
  },
  {
    version: '004_create_financial_goals',
    up: async (runQuery) => {
      await runQuery(`
        CREATE TABLE IF NOT EXISTS financial_goals (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          target_amount DOUBLE PRECISION NOT NULL,
          saved_amount DOUBLE PRECISION NOT NULL,
          deadline TEXT NOT NULL,
          category TEXT NOT NULL,
          priority TEXT NOT NULL,
          notes TEXT,
          status TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `);
    }
  },
  {
    version: '005_create_achievements',
    up: async (runQuery) => {
      // 1. Create achievements table
      await runQuery(`
        CREATE TABLE IF NOT EXISTS achievements (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          icon TEXT NOT NULL,
          rule_type TEXT NOT NULL,
          rule_value DOUBLE PRECISION NOT NULL,
          points INTEGER NOT NULL,
          active INTEGER NOT NULL DEFAULT 1
        )
      `);

      // 2. Create user_achievements table
      await runQuery(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          user_id TEXT NOT NULL,
          achievement_id TEXT NOT NULL,
          unlocked_at BIGINT NOT NULL,
          progress DOUBLE PRECISION NOT NULL DEFAULT 0,
          seen INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, achievement_id)
        )
      `);

      // 3. Seed initial achievements
      const initialAchievements = [
        {
          id: 'ach_first_expense',
          name: 'First Expense',
          description: 'Record your very first expense entry.',
          category: 'expense tracking',
          icon: 'Award',
          rule_type: 'expense_count',
          rule_value: 1,
          points: 10
        },
        {
          id: 'ach_10_expenses',
          name: '10 Expenses Added',
          description: 'Add 10 expense records.',
          category: 'expense tracking',
          icon: 'TrendingUp',
          rule_type: 'expense_count',
          rule_value: 10,
          points: 20
        },
        {
          id: 'ach_100_expenses',
          name: '100 Expenses Added',
          description: 'Keep logging! Reach 100 expenses.',
          category: 'expense tracking',
          icon: 'Flame',
          rule_type: 'expense_count',
          rule_value: 100,
          points: 50
        },
        {
          id: 'ach_first_receipt',
          name: 'First Receipt Scanned',
          description: 'Scan a receipt with AI for the first time.',
          category: 'receipt scanning',
          icon: 'Camera',
          rule_type: 'scanned_count',
          rule_value: 1,
          points: 15
        },
        {
          id: 'ach_first_goal_created',
          name: 'First Financial Goal Created',
          description: 'Set a new savings goal.',
          category: 'financial goals',
          icon: 'Target',
          rule_type: 'goal_created_count',
          rule_value: 1,
          points: 10
        },
        {
          id: 'ach_first_goal_completed',
          name: 'First Goal Completed',
          description: 'Reach a saving goal target! 🎉',
          category: 'financial goals',
          icon: 'CheckCircle2',
          rule_type: 'goal_completed_count',
          rule_value: 1,
          points: 25
        },
        {
          id: 'ach_7_day_streak',
          name: '7 Day Tracking Streak',
          description: 'Add an expense daily for 7 days in a row.',
          category: 'consistency',
          icon: 'Calendar',
          rule_type: 'streak_days',
          rule_value: 7,
          points: 30
        },
        {
          id: 'ach_30_day_streak',
          name: '30 Day Tracking Streak',
          description: 'Maintain consistency with 30 days streak!',
          category: 'consistency',
          icon: 'Sparkles',
          rule_type: 'streak_days',
          rule_value: 30,
          points: 75
        },
        {
          id: 'ach_saved_10k',
          name: 'Saved ₹10,000',
          description: 'Log ₹10,000 total in savings entries.',
          category: 'savings',
          icon: 'PiggyBank',
          rule_type: 'saved_amount',
          rule_value: 10000,
          points: 40
        },
        {
          id: 'ach_under_budget',
          name: 'Stayed Under Budget',
          description: 'Stay under your monthly budget limit.',
          category: 'budget',
          icon: 'Coins',
          rule_type: 'under_budget_count',
          rule_value: 1,
          points: 20
        }
      ];

      for (const ach of initialAchievements) {
        await runQuery(
          `INSERT INTO achievements (id, name, description, category, icon, rule_type, rule_value, points, active) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ach.id, ach.name, ach.description, ach.category, ach.icon, ach.rule_type, ach.rule_value, ach.points, 1]
        );
      }
    }
  },
  {
    version: '006_create_financial_health_score_history',
    up: async (runQuery) => {
      await runQuery(`
        CREATE TABLE IF NOT EXISTS financial_health_score_history (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          total_score INTEGER NOT NULL,
          level TEXT NOT NULL,
          budget_control_score DOUBLE PRECISION NOT NULL,
          savings_habit_score DOUBLE PRECISION NOT NULL,
          spending_control_score DOUBLE PRECISION NOT NULL,
          goal_progress_score DOUBLE PRECISION NOT NULL,
          tracking_consistency_score DOUBLE PRECISION NOT NULL,
          has_enough_data INTEGER NOT NULL,
          period_key TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          UNIQUE(user_id, period_key)
        )
      `);
    }
  },
  {
    version: '007_create_admin_notifications',
    up: async (runQuery) => {
      await runQuery(`
        CREATE TABLE IF NOT EXISTS admin_notifications (
          id TEXT PRIMARY KEY,
          event_key TEXT UNIQUE NOT NULL,
          event_type TEXT NOT NULL,
          severity TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          user_id TEXT,
          metadata TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          attempt_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at BIGINT NOT NULL,
          sent_at BIGINT,
          read_at BIGINT
        )
      `);
    }
  },
  {
    version: '008_create_weekly_admin_reports',
    up: async (runQuery) => {
      try {
        await runQuery(`ALTER TABLE users ADD COLUMN created_at BIGINT`);
      } catch (e) {
        console.log('created_at column on users table might already exist, skipping...');
      }

      await runQuery(`
        CREATE TABLE IF NOT EXISTS weekly_admin_reports (
          id TEXT PRIMARY KEY,
          week_key TEXT UNIQUE NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          new_users_count INTEGER NOT NULL DEFAULT 0,
          active_users_count INTEGER NOT NULL DEFAULT 0,
          expenses_count INTEGER NOT NULL DEFAULT 0,
          total_expense_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
          savings_count INTEGER NOT NULL DEFAULT 0,
          total_savings_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
          receipts_scanned_count INTEGER NOT NULL DEFAULT 0,
          receipt_scan_success_count INTEGER NOT NULL DEFAULT 0,
          receipt_scan_failure_count INTEGER NOT NULL DEFAULT 0,
          duplicates_blocked_count INTEGER NOT NULL DEFAULT 0,
          anomalies_count INTEGER NOT NULL DEFAULT 0,
          goals_created_count INTEGER NOT NULL DEFAULT 0,
          feedback_count INTEGER NOT NULL DEFAULT 0,
          sent_to_email TEXT,
          email_status TEXT NOT NULL DEFAULT 'pending',
          created_at BIGINT NOT NULL,
          sent_at BIGINT
        )
      `);
    }
  },
  {
    version: '009_add_inactive_reminder_fields',
    up: async (runQuery) => {
      try {
        await runQuery(`ALTER TABLE users ADD COLUMN last_login BIGINT`);
      } catch (e) { console.log('last_login column might exist, skipping...'); }
      try {
        await runQuery(`ALTER TABLE users ADD COLUMN last_inactive_reminder_sent BIGINT`);
      } catch (e) { console.log('last_inactive_reminder_sent column might exist, skipping...'); }
      try {
        await runQuery(`ALTER TABLE users ADD COLUMN inactive_reminder_count INTEGER DEFAULT 0`);
      } catch (e) { console.log('inactive_reminder_count column might exist, skipping...'); }
      try {
        await runQuery(`ALTER TABLE users ADD COLUMN inactive_reminders_enabled INTEGER DEFAULT 1`);
      } catch (e) { console.log('inactive_reminders_enabled column might exist, skipping...'); }
      try {
        await runQuery(`ALTER TABLE users ADD COLUMN last_reminder_stage TEXT`);
      } catch (e) { console.log('last_reminder_stage column might exist, skipping...'); }
    }
  },
  {
    version: '010_create_backup_audit_log',
    up: async (runQuery) => {
      await runQuery(`
        CREATE TABLE IF NOT EXISTS backup_audit_logs (
          id TEXT PRIMARY KEY,
          action_type TEXT NOT NULL,
          file_path TEXT NOT NULL,
          size_bytes BIGINT,
          status TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          details TEXT
        )
      `);
    }
  },
  {
    version: '011_create_user_notifications',
    up: async (runQuery) => {
      await runQuery(`
        CREATE TABLE IF NOT EXISTS user_notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          related_id TEXT,
          related_page TEXT,
          is_read INTEGER NOT NULL DEFAULT 0,
          event_key TEXT UNIQUE,
          created_at BIGINT NOT NULL,
          read_at BIGINT
        )
      `);
    }
  }
];

// Helper to run query as a Promise
function execQueryPromise(clientOrDb, sql, params = []) {
  return new Promise((resolve, reject) => {
    if (clientOrDb.query) {
      // Postgres Client/Pool
      clientOrDb.query(translateQuery(sql), params, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    } else {
      // SQLite
      clientOrDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    }
  });
}

// Backup database tables or files
async function backupDatabase() {
  const timestamp = Date.now();
  console.log(`📦 [Backup] Starting database backup. Timestamp: ${timestamp}`);
  
  if (!isProduction) {
    // Backup SQLite database file
    const dbFile = path.join(__dirname, '..', 'database.db');
    if (fs.existsSync(dbFile)) {
      const backupFile = `${dbFile}.bak_${timestamp}`;
      fs.copyFileSync(dbFile, backupFile);
      console.log(`📦 [Backup] SQLite backup saved to: ${backupFile}`);
    }
  } else {
    // Backup PostgreSQL schema by generating SQL statements / copies
    // Render persistent backup directory
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const tables = ['users', 'expenses', 'savings', 'trash', 'budgets', 'feedbacks', 'financial_goals', 'achievements', 'user_achievements'];
    const backupData = {};

    for (const table of tables) {
      try {
        const res = await pgPool.query(`SELECT * FROM ${table}`);
        backupData[table] = res.rows;
        
        // Also do DDL table level copy for safety
        await pgPool.query(`CREATE TABLE IF NOT EXISTS backup_${table}_${timestamp} AS SELECT * FROM ${table}`);
        console.log(`📦 [Backup] PostgreSQL table copy backup_${table}_${timestamp} created.`);
      } catch (err) {
        console.log(`⚠️ [Backup] Table ${table} does not exist yet or failed to backup: ${err.message}`);
      }
    }
    
    const jsonBackupFile = path.join(backupDir, `pg_backup_${timestamp}.json`);
    fs.writeFileSync(jsonBackupFile, JSON.stringify(backupData, null, 2));
    console.log(`📦 [Backup] Offline JSON backup file created: ${jsonBackupFile}`);
  }
}

// Data synchronization from SQLite database to PostgreSQL
async function syncSqliteToPostgre() {
  const sqliteFile = path.join(__dirname, '..', 'database.db');
  if (!fs.existsSync(sqliteFile)) {
    console.log('ℹ️ [Data Sync] No local SQLite file database.db found. No sync needed.');
    return;
  }

  console.log('🔄 [Data Sync] Found SQLite database. Syncing to PostgreSQL...');

  const tempDb = new sqlite3.Database(sqliteFile);

  const fetchSqliteTable = (table) => {
    return new Promise((resolve, reject) => {
      tempDb.all(`SELECT * FROM ${table}`, [], (err, rows) => {
        if (err) {
          if (err.message.includes('no such table')) resolve([]);
          else reject(err);
        } else resolve(rows);
      });
    });
  };

  try {
    // 1. Users
    const sqliteUsers = await fetchSqliteTable('users');
    for (const u of sqliteUsers) {
      await pgPool.query(
        `INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.email, u.password_hash]
      );
    }
    console.log(`🔄 [Data Sync] Synced ${sqliteUsers.length} users.`);

    // 2. Expenses
    const sqliteExpenses = await fetchSqliteTable('expenses');
    for (const e of sqliteExpenses) {
      await pgPool.query(
        `INSERT INTO expenses (id, user_id, date, amount, category, payment_method, description, created_at, merchant, time, tax, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
        [e.id, e.user_id, e.date, e.amount, e.category, e.payment_method, e.description, e.created_at, e.merchant, e.time, e.tax, e.notes]
      );
    }
    console.log(`🔄 [Data Sync] Synced ${sqliteExpenses.length} expenses.`);

    // 3. Savings
    const sqliteSavings = await fetchSqliteTable('savings');
    for (const s of sqliteSavings) {
      await pgPool.query(
        `INSERT INTO savings (id, user_id, date, amount, description, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.user_id, s.date, s.amount, s.description, s.created_at]
      );
    }
    console.log(`🔄 [Data Sync] Synced ${sqliteSavings.length} savings entries.`);

    // 4. Trash
    const sqliteTrash = await fetchSqliteTable('trash');
    for (const t of sqliteTrash) {
      await pgPool.query(
        `INSERT INTO trash (id, user_id, type, item, deleted_at) 
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [t.id, t.user_id, t.type, t.item, t.deleted_at]
      );
    }
    console.log(`🔄 [Data Sync] Synced ${sqliteTrash.length} trashed entries.`);

    // 5. Budgets
    const sqliteBudgets = await fetchSqliteTable('budgets');
    for (const b of sqliteBudgets) {
      await pgPool.query(
        `INSERT INTO budgets (user_id, data) 
         VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
        [b.user_id, b.data]
      );
    }
    console.log(`🔄 [Data Sync] Synced ${sqliteBudgets.length} budget configurations.`);

    // 6. Feedbacks
    const sqliteFeedbacks = await fetchSqliteTable('feedbacks');
    for (const f of sqliteFeedbacks) {
      await pgPool.query(
        `INSERT INTO feedbacks (id, user_id, email, category, message, delivery_status, delivery_error, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
        [f.id, f.user_id, f.email, f.category, f.message, f.delivery_status, f.delivery_error, f.created_at]
      );
    }
    console.log(`🔄 [Data Sync] Synced ${sqliteFeedbacks.length} feedbacks.`);

    // 7. Goals
    const sqliteGoals = await fetchSqliteTable('financial_goals');
    for (const g of sqliteGoals) {
      await pgPool.query(
        `INSERT INTO financial_goals (id, user_id, name, target_amount, saved_amount, deadline, category, priority, notes, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
        [g.id, g.user_id, g.name, g.target_amount, g.saved_amount, g.deadline, g.category, g.priority, g.notes, g.status, g.created_at]
      );
    }
    console.log(`🔄 [Data Sync] Synced ${sqliteGoals.length} financial goals.`);

    // 8. Achievements
    const sqliteAchievements = await fetchSqliteTable('achievements');
    for (const a of sqliteAchievements) {
      await pgPool.query(
        `INSERT INTO achievements (id, name, description, category, icon, rule_type, rule_value, points, active) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
        [a.id, a.name, a.description, a.category, a.icon, a.rule_type, a.rule_value, a.points, a.active]
      );
    }
    console.log(`🔄 [Data Sync] Synced ${sqliteAchievements.length} achievements.`);

    // 9. User Achievements
    const sqliteUserAchievements = await fetchSqliteTable('user_achievements');
    for (const ua of sqliteUserAchievements) {
      await pgPool.query(
        `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, progress, seen) 
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, achievement_id) DO NOTHING`,
        [ua.user_id, ua.achievement_id, ua.unlocked_at, ua.progress, ua.seen]
      );
    }
    console.log(`🔄 [Data Sync] Synced ${sqliteUserAchievements.length} user unlocked achievements.`);

    // Sync finished: rename SQLite file to prevent running again next time
    tempDb.close();
    const migratedFile = `${sqliteFile}.migrated`;
    fs.renameSync(sqliteFile, migratedFile);
    console.log(`✅ [Data Sync] SQLite data successfully migrated. File renamed to: ${migratedFile}`);
  } catch (err) {
    console.error('❌ [Data Sync] Error during SQLite-to-Postgre data migration:', err);
    tempDb.close();
  }
}

// Initialize database connection and run migrations
async function initializeDatabase() {
  if (!isProduction) {
    // Local SQLite database
    const dbFile = path.join(__dirname, '..', 'database.db');
    sqliteDb = new sqlite3.Database(dbFile);
    console.log(`💻 [DB Connector] Connected to local SQLite database at: ${dbFile}`);
  } else {
    // Render PostgreSQL database
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log('🌐 [DB Connector] Connected to Render PostgreSQL Database.');
  }

  // Backup current database tables/files
  await backupDatabase();

  const activeDriver = isProduction ? pgPool : sqliteDb;

  // Initialize schema_migrations table
  await execQueryPromise(activeDriver, `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      executed_at BIGINT NOT NULL
    )
  `);

  // Fetch executed migrations
  let executedList = [];
  if (!isProduction) {
    executedList = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT version FROM schema_migrations', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.version));
      });
    });
  } else {
    const res = await pgPool.query('SELECT version FROM schema_migrations');
    executedList = res.rows.map(r => r.version);
  }

  console.log(`📋 [Migrations] Completed migrations found in DB:`, executedList);

  // Run pending migrations
  for (const m of MIGRATIONS) {
    if (!executedList.includes(m.version)) {
      console.log(`⚙️ [Migrations] Running pending migration: "${m.version}"`);
      
      // Automatic pre-migration snapshot before applying schema changes
      try {
        await createPreMigrationBackup(m.version);
      } catch (backupErr) {
        console.warn(`⚠️ Pre-migration backup warning: ${backupErr.message}`);
      }

      if (isProduction) {
        // Run migration in PostgreSQL Transaction
        const pgClient = await pgPool.connect();
        try {
          await pgClient.query('BEGIN');
          const runQueryFn = (sql, params = []) => execQueryPromise(pgClient, sql, params);
          await m.up(runQueryFn);
          await pgClient.query(
            'INSERT INTO schema_migrations (version, executed_at) VALUES ($1, $2)',
            [m.version, Date.now()]
          );
          await pgClient.query('COMMIT');
          console.log(`✅ [Migrations] PostgreSQL Migration "${m.version}" executed successfully.`);
        } catch (err) {
          await pgClient.query('ROLLBACK');
          pgClient.release();
          console.error(`❌ [Migrations] PostgreSQL Migration "${m.version}" FAILED:`, err.message);
          throw err; // Stop application start
        }
        pgClient.release();
      } else {
        // Run migration in SQLite
        try {
          await execQueryPromise(sqliteDb, 'BEGIN TRANSACTION');
          const runQueryFn = (sql, params = []) => execQueryPromise(sqliteDb, sql, params);
          await m.up(runQueryFn);
          await execQueryPromise(
            sqliteDb,
            'INSERT INTO schema_migrations (version, executed_at) VALUES (?, ?)',
            [m.version, Date.now()]
          );
          await execQueryPromise(sqliteDb, 'COMMIT');
          console.log(`✅ [Migrations] SQLite Migration "${m.version}" executed successfully.`);
        } catch (err) {
          await execQueryPromise(sqliteDb, 'ROLLBACK');
          console.error(`❌ [Migrations] SQLite Migration "${m.version}" FAILED:`, err.message);
          throw err; // Stop application start
        }
      }
    }
  }

  console.log('✅ [Migrations] All migrations completed successfully.');

  // Run data sync if PostgreSQL is loaded
  if (isProduction) {
    await syncSqliteToPostgre();
  }
}

module.exports = {
  db,
  initializeDatabase
};
