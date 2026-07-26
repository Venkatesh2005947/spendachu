/**
 * mockDataService.js
 * =========================================
 * SpendAchu Mock Test Data Generator & Cleaner
 *
 * SAFETIES:
 * - All generated records use primary key IDs starting with 'mock_test_'
 * - Cleanup ONLY deletes records where id LIKE 'mock_test_%'
 * - Real user data is NEVER modified or deleted
 */

'use strict';

const { db } = require('./dbConnector');

/**
 * Promisify db.run
 */
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

/**
 * Promisify db.get
 */
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

/**
 * Promisify db.all
 */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/**
 * Generate dates spread across the last 30 days in YYYY-MM-DD format
 */
function getPastDateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

/**
 * Sample 1 Month Mock Expense Data Template
 */
const MOCK_EXPENSES_TEMPLATE = [
  { daysAgo: 0, amount: 450, category: 'Food', merchant: 'Swiggy', description: 'Lunch order with team', method: 'UPI' },
  { daysAgo: 1, amount: 1200, category: 'Transport', merchant: 'HP Fuel Station', description: 'Petrol fill up for car', method: 'Credit Card' },
  { daysAgo: 2, amount: 3450, category: 'Grocery', merchant: 'Reliance Fresh', description: 'Weekly groceries and household supplies', method: 'UPI' },
  { daysAgo: 3, amount: 850, category: 'Entertainment', merchant: 'BookMyShow', description: 'Movie tickets for 2', method: 'Debit Card' },
  { daysAgo: 4, amount: 2400, category: 'Shopping', merchant: 'Myntra', description: 'Casual shirt and sneakers', method: 'Credit Card' },
  { daysAgo: 5, amount: 350, category: 'Food', merchant: 'Zomato', description: 'Dinner pizza delivery', method: 'UPI' },
  { daysAgo: 7, amount: 1850, category: 'Utilities', merchant: 'Airtel Broadband', description: 'Monthly wifi bill payment', method: 'Net Banking' },
  { daysAgo: 8, amount: 650, category: 'Health', merchant: 'Apollo Pharmacy', description: 'Vitamins and basic medicines', method: 'UPI' },
  { daysAgo: 10, amount: 12500, category: 'Housing', merchant: 'Landlord Transfer', description: 'Monthly house rent contribution', method: 'Net Banking' },
  { daysAgo: 11, amount: 420, category: 'Food', merchant: 'Starbucks', description: 'Coffee and sandwich', method: 'UPI' },
  { daysAgo: 12, amount: 1800, category: 'Transport', merchant: 'Uber India', description: 'Airport cab fare', method: 'UPI' },
  { daysAgo: 14, amount: 2890, category: 'Grocery', merchant: 'D-Mart Supermarket', description: 'Monthly pantry restock', method: 'Debit Card' },
  { daysAgo: 15, amount: 499, category: 'Entertainment', merchant: 'Netflix', description: 'Monthly OTT subscription', method: 'Credit Card' },
  { daysAgo: 16, amount: 550, category: 'Food', merchant: 'Domino\'s Pizza', description: 'Weekend pizza party', method: 'UPI' },
  { daysAgo: 18, amount: 1500, category: 'Fuel', merchant: 'Indian Oil', description: 'Bike fuel refill', method: 'UPI' },
  { daysAgo: 19, amount: 3200, category: 'Shopping', merchant: 'Amazon India', description: 'Wireless earbuds purchase', method: 'Credit Card' },
  { daysAgo: 21, amount: 680, category: 'Food', merchant: 'Haldiram\'s', description: 'Family snacks & sweets', method: 'UPI' },
  { daysAgo: 22, amount: 2100, category: 'Utilities', merchant: 'State Electricity Board', description: 'Monthly electricity bill', method: 'Net Banking' },
  { daysAgo: 24, amount: 1400, category: 'Health', merchant: 'Dr. Lal PathLabs', description: 'Routine blood test checkup', method: 'UPI' },
  { daysAgo: 25, amount: 3500, category: 'Education', merchant: 'Udemy Online', description: 'Full Stack Web Dev Certification', method: 'Credit Card' },
  { daysAgo: 27, amount: 750, category: 'Food', merchant: 'Baskin Robbins', description: 'Ice cream treat', method: 'UPI' },
  { daysAgo: 28, amount: 950, category: 'Transport', merchant: 'Ola Cabs', description: 'Outstation cab ride', method: 'UPI' },
  { daysAgo: 29, amount: 4200, category: 'Grocery', merchant: 'Nature\'s Basket', description: 'Organic veggies and essentials', method: 'Debit Card' },
  { daysAgo: 30, amount: 52000, category: 'Shopping', merchant: 'Croma Electronics', description: '4K Smart Monitor (Large Purchase)', method: 'Credit Card' }
];

/**
 * Sample Mock Savings Template
 */
const MOCK_SAVINGS_TEMPLATE = [
  { daysAgo: 3, amount: 10000, description: 'Monthly SIP Mutual Fund Deposit' },
  { daysAgo: 10, amount: 5000, description: 'Emergency Fund Savings Transfer' },
  { daysAgo: 20, amount: 15000, description: 'Fixed Deposit Quarterly Saving' }
];

/**
 * Sample Mock Goals Template
 */
const MOCK_GOALS_TEMPLATE = [
  {
    name: 'Emergency Reserve Fund 🛡️',
    target_amount: 100000,
    saved_amount: 35000,
    category: 'Emergency',
    priority: 'High',
    deadline: getPastDateStr(-180) // 6 months in future
  },
  {
    name: 'Goa Vacation 🏖️',
    target_amount: 40000,
    saved_amount: 22000,
    category: 'Travel',
    priority: 'Medium',
    deadline: getPastDateStr(-90) // 3 months in future
  }
];

/**
 * Generate 1 Month of Mock Test Data for a user
 */
async function generateMockData(userId) {
  if (!userId) throw new Error('User ID is required.');

  // First cleanup any existing mock data for clean state
  await cleanupMockData(userId);

  const now = Date.now();
  let expensesAdded = 0;
  let savingsAdded = 0;
  let goalsAdded = 0;
  let notificationsAdded = 0;

  // 1. Add Mock Expenses
  for (let i = 0; i < MOCK_EXPENSES_TEMPLATE.length; i++) {
    const item = MOCK_EXPENSES_TEMPLATE[i];
    const id = `mock_test_exp_${userId}_${i}_${now}`;
    const dateStr = getPastDateStr(item.daysAgo);
    const createdAt = now - (item.daysAgo * 24 * 60 * 60 * 1000);

    await dbRun(
      `INSERT INTO expenses (id, user_id, date, amount, category, payment_method, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, dateStr, item.amount, item.category, item.method, `${item.description} [MOCK]`, createdAt]
    );
    expensesAdded++;
  }

  // 2. Add Mock Savings
  for (let i = 0; i < MOCK_SAVINGS_TEMPLATE.length; i++) {
    const item = MOCK_SAVINGS_TEMPLATE[i];
    const id = `mock_test_sav_${userId}_${i}_${now}`;
    const dateStr = getPastDateStr(item.daysAgo);
    const createdAt = now - (item.daysAgo * 24 * 60 * 60 * 1000);

    await dbRun(
      `INSERT INTO savings (id, user_id, date, amount, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, dateStr, item.amount, `${item.description} [MOCK]`, createdAt]
    );
    savingsAdded++;
  }

  // 3. Add Mock Goals
  for (let i = 0; i < MOCK_GOALS_TEMPLATE.length; i++) {
    const item = MOCK_GOALS_TEMPLATE[i];
    const id = `mock_test_goal_${userId}_${i}_${now}`;

    await dbRun(
      `INSERT INTO financial_goals (id, user_id, name, target_amount, saved_amount, deadline, category, priority, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [id, userId, item.name, item.target_amount, item.saved_amount, item.deadline, item.category, item.priority, now]
    );
    goalsAdded++;
  }

  // 4. Set balanced Monthly Budget
  const mockBudget = {
    global: 45000,
    categories: {
      Food: 10000,
      Grocery: 8000,
      Transport: 5000,
      Shopping: 8000,
      Utilities: 4000,
      Entertainment: 3000,
      Health: 4000
    }
  };

  // Save budget
  const existingBudget = await dbGet(`SELECT user_id FROM budgets WHERE user_id = ?`, [userId]);
  if (existingBudget) {
    await dbRun(`UPDATE budgets SET data = ? WHERE user_id = ?`, [JSON.stringify(mockBudget), userId]);
  } else {
    await dbRun(`INSERT INTO budgets (user_id, data) VALUES (?, ?)`, [userId, JSON.stringify(mockBudget)]);
  }

  // 5. Add Mock User Notifications
  const mockNotifs = [
    {
      type: 'budget_warning',
      title: '⚠️ Budget Warning: Food Category',
      message: 'You have reached 82% of your monthly Food budget. Current spending: ₹8,200 / ₹10,000.',
      relatedPage: 'budgeting'
    },
    {
      type: 'goal_progress',
      title: '🎯 Financial Goal Progress Update',
      message: 'Great job! You reached 55% of your Goa Vacation 🏖️ goal target.',
      relatedPage: 'budgeting'
    },
    {
      type: 'anomaly_detected',
      title: '🚨 Large Transaction Detected',
      message: 'A large transaction of ₹52,000 at Croma Electronics was recorded on your account.',
      relatedPage: 'expenses'
    }
  ];

  for (let i = 0; i < mockNotifs.length; i++) {
    const n = mockNotifs[i];
    const id = `mock_test_notif_${userId}_${i}_${now}`;
    await dbRun(
      `INSERT INTO user_notifications (id, user_id, type, title, message, related_page, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, userId, n.type, n.title, n.message, n.relatedPage, now - (i * 3600000)]
    );
    notificationsAdded++;
  }

  return {
    success: true,
    expensesAdded,
    savingsAdded,
    goalsAdded,
    notificationsAdded,
    message: `Added 1 month of realistic test data (${expensesAdded} expenses, ${savingsAdded} savings, ${goalsAdded} goals). You can clear this mock data anytime!`
  };
}

/**
 * Delete ALL Mock Test Data for a user
 */
async function cleanupMockData(userId) {
  if (!userId) throw new Error('User ID is required.');

  const [expRes, savRes, goalRes, notifRes, chatMsgRes, chatSessRes, trashRes] = await Promise.all([
    dbRun(`DELETE FROM expenses WHERE user_id = ? AND id LIKE 'mock_test_%'`, [userId]),
    dbRun(`DELETE FROM savings WHERE user_id = ? AND id LIKE 'mock_test_%'`, [userId]),
    dbRun(`DELETE FROM financial_goals WHERE user_id = ? AND id LIKE 'mock_test_%'`, [userId]),
    dbRun(`DELETE FROM user_notifications WHERE user_id = ? AND id LIKE 'mock_test_%'`, [userId]),
    dbRun(`DELETE FROM financial_chat_messages WHERE user_id = ? AND id LIKE 'mock_test_%'`, [userId]),
    dbRun(`DELETE FROM financial_chat_sessions WHERE user_id = ? AND id LIKE 'mock_test_%'`, [userId]),
    dbRun(`DELETE FROM trash WHERE user_id = ? AND id LIKE 'mock_test_%'`, [userId])
  ]);

  return {
    success: true,
    deletedExpenses: expRes?.changes || 0,
    deletedSavings: savRes?.changes || 0,
    deletedGoals: goalRes?.changes || 0,
    deletedNotifications: notifRes?.changes || 0,
    message: 'All 1-month mock test data has been completely deleted. Your real data remains safe!'
  };
}

/**
 * Check if user currently has active mock test data
 */
async function getMockDataStatus(userId) {
  if (!userId) return { hasMockData: false, mockExpensesCount: 0 };

  const [expRow, savRow, goalRow] = await Promise.all([
    dbGet(`SELECT COUNT(*) as count FROM expenses WHERE user_id = ? AND id LIKE 'mock_test_%'`, [userId]),
    dbGet(`SELECT COUNT(*) as count FROM savings WHERE user_id = ? AND id LIKE 'mock_test_%'`, [userId]),
    dbGet(`SELECT COUNT(*) as count FROM financial_goals WHERE user_id = ? AND id LIKE 'mock_test_%'`, [userId])
  ]);

  const mockExpensesCount = expRow?.count || 0;
  const mockSavingsCount = savRow?.count || 0;
  const mockGoalsCount = goalRow?.count || 0;

  return {
    hasMockData: (mockExpensesCount + mockSavingsCount + mockGoalsCount) > 0,
    mockExpensesCount,
    mockSavingsCount,
    mockGoalsCount
  };
}

module.exports = {
  generateMockData,
  cleanupMockData,
  getMockDataStatus
};
