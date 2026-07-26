/**
 * financialChatAnalyticsService.js
 * =========================================
 * SpendAchu AI Financial Chat Assistant — Analytics Service
 *
 * SECURITY: Every function accepts userId as its first argument.
 * userId MUST always come from req.user.id (JWT validated), NEVER from request body.
 *
 * All queries use parameterized statements. No raw SQL from user input.
 * Returns structured results with hasEnoughData flag for missing-data handling.
 */

'use strict';

const { db } = require('./dbConnector');
const { calculateFinancialHealthScore } = require('./financialHealthEngine');

const TIMEZONE = 'Asia/Kolkata';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Promisify db.all for use in async functions.
 */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

/**
 * Format amount as Indian currency string: ₹1,23,456.00
 */
function formatINR(amount) {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Calculate percentage change between two values.
 */
function percentageChange(current, previous) {
  if (!previous || previous === 0) return null;
  return parseFloat(((current - previous) / Math.abs(previous) * 100).toFixed(2));
}

/**
 * Parse budget JSON safely.
 */
async function getUserBudgetData(userId) {
  const row = await dbGet('SELECT data FROM budgets WHERE user_id = ?', [userId]);
  if (!row || !row.data) return { global: 30000, categories: {} };
  try {
    return JSON.parse(row.data);
  } catch {
    return { global: 30000, categories: {} };
  }
}

// ─── Analytics Functions ─────────────────────────────────────────────────────

/**
 * 1. Get total expenses between two dates.
 */
async function getExpenseTotal(userId, startDate, endDate) {
  try {
    const rows = await dbAll(
      `SELECT amount, category, date, merchant, description FROM expenses
       WHERE user_id = ? AND date >= ? AND date <= ?
       ORDER BY date DESC`,
      [userId, startDate, endDate]
    );

    const total = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

    if (rows.length === 0) {
      return {
        hasEnoughData: false,
        missingData: ['expenses'],
        friendlyMessage: `No expenses were found between ${startDate} and ${endDate}.`,
        total: 0,
        transactionCount: 0
      };
    }

    return {
      hasEnoughData: true,
      total: parseFloat(total.toFixed(2)),
      totalFormatted: formatINR(total),
      transactionCount: rows.length,
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getExpenseTotal error:', err.message);
    throw err;
  }
}

/**
 * 2. Get expenses grouped by category.
 */
async function getExpensesByCategory(userId, startDate, endDate) {
  try {
    const rows = await dbAll(
      `SELECT category, SUM(amount) as total, COUNT(*) as count
       FROM expenses
       WHERE user_id = ? AND date >= ? AND date <= ?
       GROUP BY category
       ORDER BY total DESC`,
      [userId, startDate, endDate]
    );

    if (rows.length === 0) {
      return {
        hasEnoughData: false,
        missingData: ['expenses'],
        friendlyMessage: `No expenses found between ${startDate} and ${endDate}.`,
        categories: []
      };
    }

    const grandTotal = rows.reduce((sum, r) => sum + (r.total || 0), 0);

    const categories = rows.map(r => ({
      category: r.category,
      total: parseFloat((r.total || 0).toFixed(2)),
      totalFormatted: formatINR(r.total || 0),
      count: r.count,
      percentage: grandTotal > 0 ? parseFloat(((r.total / grandTotal) * 100).toFixed(1)) : 0
    }));

    return {
      hasEnoughData: true,
      categories,
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      grandTotalFormatted: formatINR(grandTotal),
      topCategory: categories[0] || null,
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getExpensesByCategory error:', err.message);
    throw err;
  }
}

/**
 * 3. Get expenses for a specific merchant.
 */
async function getExpensesByMerchant(userId, merchant, startDate, endDate) {
  try {
    if (!merchant) {
      return {
        hasEnoughData: false,
        missingData: ['merchant name'],
        friendlyMessage: 'Please specify a merchant name to search for.',
        total: 0,
        transactions: []
      };
    }

    const rows = await dbAll(
      `SELECT date, amount, category, merchant, description FROM expenses
       WHERE user_id = ? AND date >= ? AND date <= ?
       AND LOWER(merchant) LIKE LOWER(?)
       ORDER BY date DESC`,
      [userId, startDate, endDate, `%${merchant}%`]
    );

    if (rows.length === 0) {
      return {
        hasEnoughData: false,
        missingData: ['merchant expenses'],
        friendlyMessage: `No expenses found at "${merchant}" between ${startDate} and ${endDate}.`,
        total: 0,
        transactions: []
      };
    }

    const total = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
      hasEnoughData: true,
      merchant,
      total: parseFloat(total.toFixed(2)),
      totalFormatted: formatINR(total),
      transactionCount: rows.length,
      transactions: rows.slice(0, 10).map(r => ({
        date: r.date,
        amount: r.amount,
        amountFormatted: formatINR(r.amount),
        category: r.category,
        merchant: r.merchant,
        description: r.description
      })),
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getExpensesByMerchant error:', err.message);
    throw err;
  }
}

/**
 * 4. Get the single highest expense in a period.
 */
async function getHighestExpense(userId, startDate, endDate) {
  try {
    const row = await dbGet(
      `SELECT date, amount, category, merchant, description FROM expenses
       WHERE user_id = ? AND date >= ? AND date <= ?
       ORDER BY amount DESC LIMIT 1`,
      [userId, startDate, endDate]
    );

    if (!row) {
      return {
        hasEnoughData: false,
        missingData: ['expenses'],
        friendlyMessage: `No expenses found between ${startDate} and ${endDate}.`,
        highest: null
      };
    }

    return {
      hasEnoughData: true,
      highest: {
        date: row.date,
        amount: row.amount,
        amountFormatted: formatINR(row.amount),
        category: row.category,
        merchant: row.merchant || null,
        description: row.description || null
      },
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getHighestExpense error:', err.message);
    throw err;
  }
}

/**
 * 5. Get recent expenses (latest N).
 */
async function getRecentExpenses(userId, limit = 5) {
  try {
    const safeLimit = Math.min(Math.max(parseInt(limit) || 5, 1), 20);
    const rows = await dbAll(
      `SELECT date, amount, category, merchant, description FROM expenses
       WHERE user_id = ?
       ORDER BY date DESC, created_at DESC
       LIMIT ?`,
      [userId, safeLimit]
    );

    if (rows.length === 0) {
      return {
        hasEnoughData: false,
        missingData: ['expenses'],
        friendlyMessage: 'No expenses have been recorded yet.',
        transactions: []
      };
    }

    return {
      hasEnoughData: true,
      transactions: rows.map(r => ({
        date: r.date,
        amount: r.amount,
        amountFormatted: formatINR(r.amount),
        category: r.category,
        merchant: r.merchant || null,
        description: r.description || null
      })),
      count: rows.length,
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getRecentExpenses error:', err.message);
    throw err;
  }
}

/**
 * 6. Compare expenses between two periods.
 */
async function compareExpensePeriods(userId, currentPeriod, previousPeriod) {
  try {
    const [currentRows, previousRows] = await Promise.all([
      dbAll(
        `SELECT SUM(amount) as total, COUNT(*) as count FROM expenses
         WHERE user_id = ? AND date >= ? AND date <= ?`,
        [userId, currentPeriod.startDate, currentPeriod.endDate]
      ),
      dbAll(
        `SELECT SUM(amount) as total, COUNT(*) as count FROM expenses
         WHERE user_id = ? AND date >= ? AND date <= ?`,
        [userId, previousPeriod.startDate, previousPeriod.endDate]
      )
    ]);

    const currentTotal = parseFloat((currentRows[0]?.total || 0).toFixed(2));
    const previousTotal = parseFloat((previousRows[0]?.total || 0).toFixed(2));
    const currentCount = currentRows[0]?.count || 0;
    const previousCount = previousRows[0]?.count || 0;

    const diff = parseFloat((currentTotal - previousTotal).toFixed(2));
    const pctChange = percentageChange(currentTotal, previousTotal);
    const direction = diff > 0 ? 'increase' : diff < 0 ? 'decrease' : 'unchanged';

    return {
      hasEnoughData: currentTotal > 0 || previousTotal > 0,
      currentPeriod: {
        label: currentPeriod.label,
        total: currentTotal,
        totalFormatted: formatINR(currentTotal),
        transactionCount: currentCount
      },
      previousPeriod: {
        label: previousPeriod.label,
        total: previousTotal,
        totalFormatted: formatINR(previousTotal),
        transactionCount: previousCount
      },
      comparison: {
        difference: diff,
        differenceFormatted: formatINR(Math.abs(diff)),
        percentageChange: pctChange,
        direction
      },
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] compareExpensePeriods error:', err.message);
    throw err;
  }
}

/**
 * 7. Get savings summary for a period.
 * NOTE: SpendAchu's savings table is savings entries, not income.
 */
async function getSavingsSummary(userId, startDate, endDate) {
  try {
    const [savingsRows, expenseRows] = await Promise.all([
      dbAll(
        `SELECT SUM(amount) as total, COUNT(*) as count FROM savings
         WHERE user_id = ? AND date >= ? AND date <= ?`,
        [userId, startDate, endDate]
      ),
      dbAll(
        `SELECT SUM(amount) as total FROM expenses
         WHERE user_id = ? AND date >= ? AND date <= ?`,
        [userId, startDate, endDate]
      )
    ]);

    const totalSavings = parseFloat((savingsRows[0]?.total || 0).toFixed(2));
    const totalExpenses = parseFloat((expenseRows[0]?.total || 0).toFixed(2));
    const savingsCount = savingsRows[0]?.count || 0;

    const totalFlow = totalSavings + totalExpenses;
    const savingsRate = totalFlow > 0
      ? parseFloat(((totalSavings / totalFlow) * 100).toFixed(1))
      : null;

    if (totalSavings === 0 && savingsCount === 0) {
      return {
        hasEnoughData: false,
        missingData: ['savings'],
        friendlyMessage: `No savings were recorded between ${startDate} and ${endDate}.`,
        totalSavings: 0,
        savingsRate: null
      };
    }

    return {
      hasEnoughData: true,
      totalSavings,
      totalSavingsFormatted: formatINR(totalSavings),
      savingsCount,
      totalExpenses,
      totalExpensesFormatted: formatINR(totalExpenses),
      savingsRate,
      savingsRateLabel: savingsRate != null ? `${savingsRate}%` : 'N/A',
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getSavingsSummary error:', err.message);
    throw err;
  }
}

/**
 * 8. Get budget summary for a month/year.
 */
async function getBudgetSummary(userId, month, year) {
  try {
    const m = parseInt(month);
    const y = parseInt(year);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    const [budgetData, expenseRows] = await Promise.all([
      getUserBudgetData(userId),
      dbAll(
        `SELECT category, SUM(amount) as spent FROM expenses
         WHERE user_id = ? AND date >= ? AND date <= ?
         GROUP BY category`,
        [userId, startDate, endDate]
      )
    ]);

    const globalBudget = budgetData.global || 30000;
    const categoryBudgets = budgetData.categories || {};
    const totalSpent = expenseRows.reduce((sum, r) => sum + (r.spent || 0), 0);
    const remaining = Math.max(globalBudget - totalSpent, 0);
    const budgetUsedPercent = globalBudget > 0
      ? parseFloat(((totalSpent / globalBudget) * 100).toFixed(1))
      : 100;

    // Build per-category breakdown
    const spentByCategory = {};
    expenseRows.forEach(r => {
      spentByCategory[r.category] = r.spent || 0;
    });

    const categoryBreakdown = Object.entries(categoryBudgets).map(([cat, limit]) => {
      const spent = spentByCategory[cat] || 0;
      const catRemaining = Math.max(limit - spent, 0);
      const catUsedPct = limit > 0 ? parseFloat(((spent / limit) * 100).toFixed(1)) : 0;
      return {
        category: cat,
        budget: limit,
        budgetFormatted: formatINR(limit),
        spent: parseFloat(spent.toFixed(2)),
        spentFormatted: formatINR(spent),
        remaining: parseFloat(catRemaining.toFixed(2)),
        remainingFormatted: formatINR(catRemaining),
        usedPercent: catUsedPct,
        isExceeded: spent > limit,
        isNearLimit: catUsedPct >= 80 && catUsedPct < 100
      };
    });

    const noBudgetSet = !budgetData.global && Object.keys(categoryBudgets).length === 0;

    if (noBudgetSet) {
      return {
        hasEnoughData: false,
        missingData: ['budget'],
        friendlyMessage: 'You have not configured a monthly budget yet. Go to the Budgeting section to set one.',
        globalBudget: 0
      };
    }

    return {
      hasEnoughData: true,
      month: m,
      year: y,
      startDate,
      endDate,
      globalBudget,
      globalBudgetFormatted: formatINR(globalBudget),
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      totalSpentFormatted: formatINR(totalSpent),
      remaining: parseFloat(remaining.toFixed(2)),
      remainingFormatted: formatINR(remaining),
      budgetUsedPercent,
      isExceeded: totalSpent > globalBudget,
      categoryBreakdown,
      nearLimitCategories: categoryBreakdown.filter(c => c.isNearLimit),
      exceededCategories: categoryBreakdown.filter(c => c.isExceeded),
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getBudgetSummary error:', err.message);
    throw err;
  }
}

/**
 * 9. Get financial goal progress.
 */
async function getGoalProgress(userId, goalId = null) {
  try {
    let rows;
    if (goalId) {
      const row = await dbGet(
        `SELECT * FROM financial_goals WHERE id = ? AND user_id = ?`,
        [goalId, userId]
      );
      rows = row ? [row] : [];
    } else {
      rows = await dbAll(
        `SELECT * FROM financial_goals WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
      );
    }

    if (rows.length === 0) {
      return {
        hasEnoughData: false,
        missingData: ['financial goals'],
        friendlyMessage: 'You currently have no active financial goals. Visit the Budgeting section to create one.',
        goals: []
      };
    }

    const now = new Date();
    const goals = rows.map(g => {
      const progressPct = g.target_amount > 0
        ? parseFloat(Math.min((g.saved_amount / g.target_amount) * 100, 100).toFixed(1))
        : 0;
      const remaining = Math.max(g.target_amount - g.saved_amount, 0);

      // Calculate months remaining until deadline
      let monthsRemaining = null;
      let monthlyNeeded = null;
      if (g.deadline) {
        const deadline = new Date(g.deadline + 'T00:00:00');
        const diffMs = deadline - now;
        monthsRemaining = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44)), 0);
        if (monthsRemaining > 0 && remaining > 0) {
          monthlyNeeded = parseFloat((remaining / monthsRemaining).toFixed(2));
        }
      }

      return {
        id: g.id,
        name: g.name,
        targetAmount: g.target_amount,
        targetFormatted: formatINR(g.target_amount),
        savedAmount: g.saved_amount,
        savedFormatted: formatINR(g.saved_amount),
        remaining: parseFloat(remaining.toFixed(2)),
        remainingFormatted: formatINR(remaining),
        progressPercent: progressPct,
        status: g.status,
        deadline: g.deadline,
        category: g.category,
        priority: g.priority,
        monthsRemaining,
        monthlyNeeded,
        monthlyNeededFormatted: monthlyNeeded ? formatINR(monthlyNeeded) : null,
        isOnTrack: monthsRemaining != null && monthlyNeeded != null && monthlyNeeded <= (g.target_amount / Math.max(monthsRemaining, 1))
      };
    });

    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');

    return {
      hasEnoughData: true,
      goals,
      activeCount: activeGoals.length,
      completedCount: completedGoals.length,
      totalGoals: goals.length,
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getGoalProgress error:', err.message);
    throw err;
  }
}

/**
 * 10. Get financial health summary (reuses existing engine).
 */
async function getFinancialHealthSummary(userId) {
  try {
    const result = await calculateFinancialHealthScore(userId);
    return {
      hasEnoughData: result.hasEnoughData,
      totalScore: result.totalScore,
      level: result.level,
      components: result.components,
      suggestions: result.suggestions,
      missingData: result.missingData || [],
      friendlyMessage: result.message || null
    };
  } catch (err) {
    console.error('[FinancialChat] getFinancialHealthSummary error:', err.message);
    throw err;
  }
}

/**
 * 11. Get saving challenge summary.
 * Returns graceful no-data when saving_challenges table is absent.
 */
async function getSavingChallengeSummary(userId) {
  try {
    const rows = await dbAll(
      `SELECT * FROM saving_challenges WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return {
        hasEnoughData: false,
        missingData: ['saving challenges'],
        friendlyMessage: 'You have no active saving challenges. This feature may not yet be set up.',
        challenge: null
      };
    }

    const c = rows[0];
    return {
      hasEnoughData: true,
      challenge: {
        name: c.name,
        targetAmount: c.target_amount,
        savedAmount: c.saved_amount,
        progressPercent: c.target_amount > 0
          ? parseFloat(((c.saved_amount / c.target_amount) * 100).toFixed(1))
          : 0,
        remaining: Math.max(c.target_amount - c.saved_amount, 0),
        deadline: c.deadline || null
      }
    };
  } catch (err) {
    // Table may not exist — return graceful response
    return {
      hasEnoughData: false,
      missingData: ['saving challenges'],
      friendlyMessage: 'Saving challenges data is not available at this time.',
      challenge: null
    };
  }
}

/**
 * 12. Get anomaly summary (large or unusual expenses).
 */
async function getAnomalySummary(userId, startDate, endDate) {
  try {
    // Get high-value expenses (>=50000)
    const highValueRows = await dbAll(
      `SELECT date, amount, category, merchant, description FROM expenses
       WHERE user_id = ? AND date >= ? AND date <= ? AND amount >= 50000
       ORDER BY amount DESC`,
      [userId, startDate, endDate]
    );

    // Get category totals for current period vs previous period
    const [currentCatRows] = await Promise.all([
      dbAll(
        `SELECT category, SUM(amount) as total FROM expenses
         WHERE user_id = ? AND date >= ? AND date <= ?
         GROUP BY category`,
        [userId, startDate, endDate]
      )
    ]);

    const anomalies = highValueRows.map(r => ({
      date: r.date,
      amount: r.amount,
      amountFormatted: formatINR(r.amount),
      category: r.category,
      merchant: r.merchant || null,
      description: r.description || null,
      reason: `Large transaction of ${formatINR(r.amount)}`
    }));

    if (anomalies.length === 0 && currentCatRows.length === 0) {
      return {
        hasEnoughData: false,
        missingData: ['expenses'],
        friendlyMessage: `No unusual expenses found between ${startDate} and ${endDate}.`,
        anomalies: []
      };
    }

    return {
      hasEnoughData: true,
      anomalyCount: anomalies.length,
      anomalies: anomalies.slice(0, 10),
      totalAnomalyAmount: anomalies.reduce((sum, a) => sum + a.amount, 0),
      totalAnomalyFormatted: formatINR(anomalies.reduce((sum, a) => sum + a.amount, 0)),
      hasHighValueExpenses: anomalies.length > 0,
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getAnomalySummary error:', err.message);
    throw err;
  }
}

/**
 * 13. Get monthly financial summary (combined).
 */
async function getMonthlyFinancialSummary(userId, month, year) {
  try {
    const m = parseInt(month);
    const y = parseInt(year);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    const [expenses, savings, budgetData, goals] = await Promise.all([
      getExpensesByCategory(userId, startDate, endDate),
      getSavingsSummary(userId, startDate, endDate),
      getBudgetSummary(userId, m, y),
      getGoalProgress(userId, null)
    ]);

    const totalExpenses = expenses.hasEnoughData ? expenses.grandTotal : 0;
    const totalSavings = savings.hasEnoughData ? savings.totalSavings : 0;

    return {
      hasEnoughData: expenses.hasEnoughData || savings.hasEnoughData,
      month: m,
      year: y,
      startDate,
      endDate,
      label: new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      totalExpenses,
      totalExpensesFormatted: formatINR(totalExpenses),
      totalSavings,
      totalSavingsFormatted: formatINR(totalSavings),
      categoryBreakdown: expenses.categories || [],
      topCategory: expenses.topCategory || null,
      budget: budgetData.hasEnoughData ? {
        global: budgetData.globalBudget,
        remaining: budgetData.remaining,
        usedPercent: budgetData.budgetUsedPercent,
        isExceeded: budgetData.isExceeded
      } : null,
      activeGoals: goals.hasEnoughData ? goals.activeCount : 0,
      savingsRate: savings.savingsRate,
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getMonthlyFinancialSummary error:', err.message);
    throw err;
  }
}

/**
 * 14. Generate rule-based saving recommendations.
 */
async function generateRuleBasedSavingRecommendations(userId, startDate, endDate) {
  try {
    const [expenses, savings, budgetData, goals] = await Promise.all([
      getExpensesByCategory(userId, startDate, endDate),
      getSavingsSummary(userId, startDate, endDate),
      getBudgetSummary(userId,
        new Date().getMonth() + 1,
        new Date().getFullYear()
      ),
      getGoalProgress(userId, null)
    ]);

    const recommendations = [];

    // Budget exceeded
    if (budgetData.hasEnoughData && budgetData.isExceeded) {
      recommendations.push({
        priority: 'high',
        reason: 'Monthly budget exceeded',
        metric: `Spent ${budgetData.totalSpentFormatted} vs budget of ${budgetData.globalBudgetFormatted}`,
        action: 'Review discretionary spending and reduce non-essential expenses this week.',
        potentialSaving: null
      });
    }

    // Categories near limit
    if (budgetData.hasEnoughData && budgetData.nearLimitCategories?.length > 0) {
      budgetData.nearLimitCategories.forEach(cat => {
        recommendations.push({
          priority: 'medium',
          reason: `${cat.category} is near its budget limit (${cat.usedPercent}% used)`,
          metric: `${cat.spentFormatted} spent of ${cat.budgetFormatted} budget`,
          action: `Reduce ${cat.category} spending before the end of the month.`,
          potentialSaving: formatINR(cat.remaining)
        });
      });
    }

    // Low savings rate
    if (savings.hasEnoughData && savings.savingsRate != null && savings.savingsRate < 10) {
      recommendations.push({
        priority: 'high',
        reason: `Low savings rate of ${savings.savingsRate}%`,
        metric: `Target at least 20% savings rate (currently saving ${savings.totalSavingsFormatted})`,
        action: 'Set up a fixed monthly savings transfer on your payday.',
        potentialSaving: null
      });
    }

    // Top spending category is very high
    if (expenses.hasEnoughData && expenses.topCategory && expenses.topCategory.percentage > 40) {
      recommendations.push({
        priority: 'medium',
        reason: `${expenses.topCategory.category} accounts for ${expenses.topCategory.percentage}% of all spending`,
        metric: expenses.topCategory.totalFormatted,
        action: `Look for ways to reduce ${expenses.topCategory.category} costs — compare options or set a category budget.`,
        potentialSaving: null
      });
    }

    // Goals behind schedule
    if (goals.hasEnoughData) {
      goals.goals.filter(g => g.status === 'active' && g.monthlyNeeded && g.monthsRemaining > 0).forEach(g => {
        if (g.monthlyNeeded > 0) {
          recommendations.push({
            priority: 'medium',
            reason: `Goal "${g.name}" requires ${formatINR(g.monthlyNeeded)}/month`,
            metric: `${g.progressPercent}% complete, ${g.monthsRemaining} months left`,
            action: `Save ${formatINR(g.monthlyNeeded)} per month to complete "${g.name}" by the deadline.`,
            potentialSaving: null
          });
        }
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        reason: 'Your finances look healthy',
        metric: 'No immediate concerns detected',
        action: 'Continue your current saving and spending habits. Consider setting a new financial goal.',
        potentialSaving: null
      });
    }

    return {
      hasEnoughData: true,
      recommendations: recommendations.slice(0, 4),
      disclaimer: 'SpendAchu provides budgeting insights and not professional financial advice.'
    };
  } catch (err) {
    console.error('[FinancialChat] generateRuleBasedSavingRecommendations error:', err.message);
    throw err;
  }
}

/**
 * 15. Get day-by-day expense breakdown (to find highest-spend day).
 */
async function getExpenseDayBreakdown(userId, startDate, endDate) {
  try {
    const rows = await dbAll(
      `SELECT date, SUM(amount) as total, COUNT(*) as count FROM expenses
       WHERE user_id = ? AND date >= ? AND date <= ?
       GROUP BY date
       ORDER BY total DESC`,
      [userId, startDate, endDate]
    );

    if (rows.length === 0) {
      return {
        hasEnoughData: false,
        missingData: ['expenses'],
        friendlyMessage: `No expenses found between ${startDate} and ${endDate}.`,
        highestDay: null,
        breakdown: []
      };
    }

    const highestDay = rows[0];

    return {
      hasEnoughData: true,
      highestDay: {
        date: highestDay.date,
        total: parseFloat((highestDay.total || 0).toFixed(2)),
        totalFormatted: formatINR(highestDay.total || 0),
        transactionCount: highestDay.count
      },
      breakdown: rows.map(r => ({
        date: r.date,
        total: parseFloat((r.total || 0).toFixed(2)),
        totalFormatted: formatINR(r.total || 0),
        count: r.count
      })),
      currency: 'INR'
    };
  } catch (err) {
    console.error('[FinancialChat] getExpenseDayBreakdown error:', err.message);
    throw err;
  }
}

module.exports = {
  getExpenseTotal,
  getExpensesByCategory,
  getExpensesByMerchant,
  getHighestExpense,
  getRecentExpenses,
  compareExpensePeriods,
  getSavingsSummary,
  getBudgetSummary,
  getGoalProgress,
  getFinancialHealthSummary,
  getSavingChallengeSummary,
  getAnomalySummary,
  getMonthlyFinancialSummary,
  generateRuleBasedSavingRecommendations,
  getExpenseDayBreakdown,
  formatINR
};
