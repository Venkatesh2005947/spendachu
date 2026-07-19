const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

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
    
    const tables = ['users', 'expenses', 'savings', 'trash', 'budgets', 'feedbacks', 'financial_goals'];
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
