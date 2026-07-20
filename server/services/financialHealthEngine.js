/**
 * SpendAchu Financial Health Score Engine
 * ========================================
 * Evaluates authenticated user financial data purely from backend DB tables:
 * - Budget Control (Max 30 pts)
 * - Savings Habit (Max 25 pts)
 * - Spending Control (Max 20 pts)
 * - Financial Goal Progress (Max 15 pts - normalized if no goals configured)
 * - Tracking Consistency (Max 10 pts)
 *
 * Total Score: 0 - 100
 */

const { db } = require('./dbConnector');
const crypto = require('crypto');

/**
 * Main entry point to calculate current score & recommendations for a user.
 */
async function calculateFinancialHealthScore(userId) {
  if (!userId) {
    throw new Error('User ID is required for financial health evaluation.');
  }

  // Fetch all raw data from database concurrently
  const [expenses, savings, budgetsData, goals] = await Promise.all([
    getUserExpenses(userId),
    getUserSavings(userId),
    getUserBudgets(userId),
    getUserGoals(userId)
  ]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // ---------------------------------------------------------------------------
  // 1. Data Insufficiency Check (Last 30 days activity)
  // ---------------------------------------------------------------------------
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const recentExpenses = expenses.filter(e => e.date >= thirtyDaysAgoStr);
  const activeTrackingDaysSet = new Set(recentExpenses.map(e => e.date));
  const activeDaysCount = activeTrackingDaysSet.size;
  const totalExpenseCount = expenses.length;

  if (totalExpenseCount < 3 || activeDaysCount < 2) {
    const missing = [];
    if (totalExpenseCount < 3) {
      missing.push(`Log at least 3 expenses (currently ${totalExpenseCount})`);
    }
    if (activeDaysCount < 2) {
      missing.push(`Track expenses across at least 2 distinct days in the last 30 days (currently ${activeDaysCount})`);
    }

    return {
      hasEnoughData: false,
      totalScore: 0,
      level: 'Needs Attention',
      missingData: missing,
      message: 'We need a bit more tracking activity to compute an accurate Financial Health Score for you. Keep logging your daily expenses!',
      components: {
        budgetControl: { score: 0, maxPoints: 30, details: 'Insufficient data' },
        savingsHabit: { score: 0, maxPoints: 25, details: 'Insufficient data' },
        spendingControl: { score: 0, maxPoints: 20, details: 'Insufficient data' },
        goalProgress: { score: 0, maxPoints: 15, details: 'Insufficient data', configured: goals.length > 0 },
        trackingConsistency: { score: 0, maxPoints: 10, details: 'Insufficient data' }
      },
      suggestions: [
        'Log your daily transactions regularly to unlock your Financial Health Score.',
        'Set up a monthly budget in the Budgeting section to track spending limits.',
        'Add your savings goals to monitor milestone progress.'
      ]
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Component 1: Budget Control (Max 30 points)
  // ---------------------------------------------------------------------------
  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const currentMonthSpent = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const globalBudget = budgetsData.global || 30000;
  const budgetUsedPercent = globalBudget > 0 ? (currentMonthSpent / globalBudget) * 100 : 100;
  const isBudgetExceeded = currentMonthSpent > globalBudget;

  let budgetControlScore = 30;
  let budgetDetails = '';

  if (isBudgetExceeded) {
    budgetControlScore = 0;
    budgetDetails = `Exceeded monthly budget by ${Math.round(budgetUsedPercent - 100)}% (${currentMonthSpent.toLocaleString()} / ${globalBudget.toLocaleString()})`;
  } else if (budgetUsedPercent <= 70) {
    budgetControlScore = 30;
    budgetDetails = `Healthy budget usage (${Math.round(budgetUsedPercent)}% used)`;
  } else {
    // 70% - 100% used: scale down smoothly from 30 to 10 points
    const over70 = (budgetUsedPercent - 70) / 30;
    budgetControlScore = Math.max(10, Math.round(30 - (over70 * 20)));
    budgetDetails = `Moderate budget usage (${Math.round(budgetUsedPercent)}% used)`;
  }

  // ---------------------------------------------------------------------------
  // 3. Component 2: Savings Habit (Max 25 points)
  // ---------------------------------------------------------------------------
  const currentMonthSavings = savings.filter(s => {
    const d = new Date(s.date + 'T00:00:00');
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce((sum, s) => sum + (s.amount || 0), 0);

  // Evaluate savings rate: monthlySavings / (monthlySpent + monthlySavings) * 100
  const totalFlow = currentMonthSpent + currentMonthSavings;
  const savingsRate = totalFlow > 0 ? (currentMonthSavings / totalFlow) * 100 : 0;

  let savingsHabitScore = 0;
  let savingsDetails = '';

  if (savingsRate >= 30) {
    savingsHabitScore = 25;
    savingsDetails = `Excellent savings rate (${Math.round(savingsRate)}% saved)`;
  } else if (savingsRate >= 20) {
    savingsHabitScore = 20;
    savingsDetails = `Strong savings rate (${Math.round(savingsRate)}% saved)`;
  } else if (savingsRate >= 10) {
    savingsHabitScore = 15;
    savingsDetails = `Moderate savings habit (${Math.round(savingsRate)}% saved)`;
  } else if (savingsRate > 0) {
    savingsHabitScore = 8;
    savingsDetails = `Low savings rate (${Math.round(savingsRate)}% saved)`;
  } else {
    savingsHabitScore = 0;
    savingsDetails = 'No savings logged this month';
  }

  // ---------------------------------------------------------------------------
  // 4. Component 3: Spending Control (Max 20 points)
  // ---------------------------------------------------------------------------
  let spendingControlScore = 20;
  const spendingDeductions = [];

  // A. Duplicate expenses check (-3 pts per duplicate pair)
  const duplicatesCount = detectDuplicatesCount(currentMonthExpenses);
  if (duplicatesCount > 0) {
    const deduction = Math.min(duplicatesCount * 3, 9);
    spendingControlScore -= deduction;
    spendingDeductions.push(`${duplicatesCount} potential duplicate expense(s) detected (-${deduction} pts)`);
  }

  // B. Single unusually high expense (>40% of total monthly budget) (-4 pts)
  const highExpenses = currentMonthExpenses.filter(e => e.amount > (globalBudget * 0.4));
  if (highExpenses.length > 0) {
    const deduction = Math.min(highExpenses.length * 4, 8);
    spendingControlScore -= deduction;
    spendingDeductions.push(`${highExpenses.length} unusually large transaction(s) >40% budget (-${deduction} pts)`);
  }

  // C. Month-to-month spending surge (>25% increase compared to previous month) (-5 pts)
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const prevMonthSpent = expenses.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  }).reduce((sum, e) => sum + (e.amount || 0), 0);

  if (prevMonthSpent > 0 && currentMonthSpent > (prevMonthSpent * 1.25)) {
    const surgePercent = Math.round(((currentMonthSpent - prevMonthSpent) / prevMonthSpent) * 100);
    spendingControlScore -= 5;
    spendingDeductions.push(`Spending surged ${surgePercent}% compared to last month (-5 pts)`);
  }

  spendingControlScore = Math.max(0, spendingControlScore);
  const spendingDetails = spendingDeductions.length > 0 
    ? spendingDeductions.join('; ')
    : 'Disciplined spending control with no major surges or duplicates';

  // ---------------------------------------------------------------------------
  // 5. Component 4: Financial Goal Progress (Max 15 points)
  // ---------------------------------------------------------------------------
  const hasGoals = goals.length > 0;
  let goalProgressScore = 0;
  let goalDetails = '';

  if (hasGoals) {
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');

    let totalSaved = 0;
    let totalTarget = 0;
    goals.forEach(g => {
      totalSaved += (g.saved_amount || 0);
      totalTarget += (g.target_amount || 1);
    });

    const overallProgressPercent = Math.min((totalSaved / totalTarget) * 100, 100);
    const basePoints = Math.round((overallProgressPercent / 100) * 9); // Max 9 pts for savings progress

    let bonusPoints = 0;
    if (completedGoals.length > 0) bonusPoints += 4; // Bonus for completed goals
    if (activeGoals.some(g => (g.saved_amount / g.target_amount) >= 0.5)) bonusPoints += 2;

    goalProgressScore = Math.min(15, basePoints + bonusPoints);
    goalDetails = `${completedGoals.length} completed, ${activeGoals.length} active (${Math.round(overallProgressPercent)}% total progress)`;
  } else {
    goalProgressScore = 0;
    goalDetails = 'No financial goals configured';
  }

  // ---------------------------------------------------------------------------
  // 6. Component 5: Tracking Consistency (Max 10 points)
  // ---------------------------------------------------------------------------
  const activeRatio = activeDaysCount / 30; // Max 1.0
  let trackingConsistencyScore = Math.round(activeRatio * 10);

  // Check for large gaps (>7 consecutive days without tracking in recent expenses)
  const maxGapDays = calculateMaxTrackingGap(recentExpenses, thirtyDaysAgo, now);
  if (maxGapDays > 7) {
    trackingConsistencyScore = Math.max(0, trackingConsistencyScore - 3);
  }

  trackingConsistencyScore = Math.min(10, Math.max(0, trackingConsistencyScore));
  const trackingDetails = `${activeDaysCount} active tracking days in last 30 days (max gap ${maxGapDays} days)`;

  // ---------------------------------------------------------------------------
  // 7. Score Normalization & Total Calculation
  // ---------------------------------------------------------------------------
  let rawTotal = budgetControlScore + savingsHabitScore + spendingControlScore + trackingConsistencyScore;
  let finalScore = 0;

  if (hasGoals) {
    rawTotal += goalProgressScore;
    finalScore = Math.min(100, Math.max(0, Math.round(rawTotal)));
  } else {
    // Normalize score out of 85 points to 100 points so absence of goals is NOT penalized
    finalScore = Math.min(100, Math.max(0, Math.round((rawTotal / 85) * 100)));
  }

  // Determine Level
  const level = getScoreLevel(finalScore);

  // Generate Personalised Rule-Based Suggestions
  const suggestions = generateRecommendations({
    finalScore,
    budgetControlScore,
    savingsHabitScore,
    spendingControlScore,
    goalProgressScore,
    trackingConsistencyScore,
    isBudgetExceeded,
    budgetUsedPercent,
    savingsRate,
    duplicatesCount,
    hasGoals,
    activeDaysCount,
    maxGapDays
  });

  const periodKey = getPeriodKey(now);
  const snapshotDate = now.toISOString().split('T')[0];

  const result = {
    hasEnoughData: true,
    totalScore: finalScore,
    level,
    periodKey,
    snapshotDate,
    components: {
      budgetControl: { score: budgetControlScore, maxPoints: 30, details: budgetDetails },
      savingsHabit: { score: savingsHabitScore, maxPoints: 25, details: savingsDetails },
      spendingControl: { score: spendingControlScore, maxPoints: 20, details: spendingDetails },
      goalProgress: { score: goalProgressScore, maxPoints: 15, details: goalDetails, configured: hasGoals },
      trackingConsistency: { score: trackingConsistencyScore, maxPoints: 10, details: trackingDetails }
    },
    suggestions
  };

  // Save/Update snapshot in history table asynchronously
  saveScoreSnapshot(userId, result).catch(err => {
    console.error('Failed to save score snapshot:', err);
  });

  return result;
}

// -----------------------------------------------------------------------------
// Score History Helper
// -----------------------------------------------------------------------------
async function getScoreHistory(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM financial_health_score_history 
       WHERE user_id = ? 
       ORDER BY snapshot_date ASC LIMIT 24`,
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        const mapped = (rows || []).map(r => ({
          id: r.id,
          totalScore: r.total_score,
          level: r.level,
          periodKey: r.period_key,
          snapshotDate: r.snapshot_date,
          components: {
            budgetControl: r.budget_control_score,
            savingsHabit: r.savings_habit_score,
            spendingControl: r.spending_control_score,
            goalProgress: r.goal_progress_score,
            trackingConsistency: r.tracking_consistency_score
          }
        }));
        resolve(mapped);
      }
    );
  });
}

// -----------------------------------------------------------------------------
// Snapshot Persistence Helper (Idempotent per period_key)
// -----------------------------------------------------------------------------
async function saveScoreSnapshot(userId, scoreResult) {
  const { totalScore, level, periodKey, snapshotDate, components, hasEnoughData } = scoreResult;
  const snapshotId = `fhs_${userId}_${periodKey}`;
  const createdAt = Date.now();

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO financial_health_score_history (
        id, user_id, total_score, level, budget_control_score, savings_habit_score,
        spending_control_score, goal_progress_score, tracking_consistency_score,
        has_enough_data, period_key, snapshot_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, period_key) DO UPDATE SET
        total_score = EXCLUDED.total_score,
        level = EXCLUDED.level,
        budget_control_score = EXCLUDED.budget_control_score,
        savings_habit_score = EXCLUDED.savings_habit_score,
        spending_control_score = EXCLUDED.spending_control_score,
        goal_progress_score = EXCLUDED.goal_progress_score,
        tracking_consistency_score = EXCLUDED.tracking_consistency_score,
        has_enough_data = EXCLUDED.has_enough_data,
        snapshot_date = EXCLUDED.snapshot_date,
        created_at = EXCLUDED.created_at`,
      [
        snapshotId,
        userId,
        totalScore,
        level,
        components.budgetControl.score,
        components.savingsHabit.score,
        components.spendingControl.score,
        components.goalProgress.score,
        components.trackingConsistency.score,
        hasEnoughData ? 1 : 0,
        periodKey,
        snapshotDate,
        createdAt
      ],
      (err) => {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

// -----------------------------------------------------------------------------
// Helper Calculation Functions
// -----------------------------------------------------------------------------
function getScoreLevel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Attention';
}

function getPeriodKey(dateObj) {
  const year = dateObj.getFullYear();
  // ISO week calculation
  const target = new Date(dateObj.valueOf());
  const dayNr = (dateObj.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNr = 1 + Math.round((firstThursday - target.valueOf()) / 604800000);
  const weekStr = weekNr < 10 ? `0${weekNr}` : `${weekNr}`;
  return `${year}-W${weekStr}`;
}

function detectDuplicatesCount(expenses) {
  let dupCount = 0;
  for (let i = 0; i < expenses.length; i++) {
    for (let j = i + 1; j < expenses.length; j++) {
      const a = expenses[i];
      const b = expenses[j];
      if (
        a.amount === b.amount &&
        a.date === b.date &&
        a.category === b.category &&
        (a.description || '').toLowerCase() === (b.description || '').toLowerCase()
      ) {
        dupCount++;
      }
    }
  }
  return dupCount;
}

function calculateMaxTrackingGap(recentExpenses, startDate, endDate) {
  if (recentExpenses.length === 0) return 30;
  const dates = Array.from(new Set(recentExpenses.map(e => e.date))).sort();
  let maxGap = 0;

  for (let i = 1; i < dates.length; i++) {
    const d1 = new Date(dates[i - 1] + 'T00:00:00');
    const d2 = new Date(dates[i] + 'T00:00:00');
    const gap = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    if (gap > maxGap) maxGap = gap;
  }
  return maxGap;
}

function generateRecommendations(data) {
  const recs = [];

  if (data.isBudgetExceeded) {
    recs.push('🚨 Your monthly budget is currently exceeded. Review your recent non-essential expenses to cut back.');
  } else if (data.budgetControlScore < 20) {
    recs.push('⚠️ You are close to your monthly budget limit. Keep an eye on daily spending for the rest of the month.');
  }

  if (data.savingsRate < 10) {
    recs.push('💰 Try committing to saving at least 10–20% of your total monthly cashflow in your Savings section.');
  }

  if (data.duplicatesCount > 0) {
    recs.push(`🔍 ${data.duplicatesCount} potential duplicate transaction(s) found. Check your recent expenses list to clean them up.`);
  }

  if (!data.hasGoals) {
    recs.push('🎯 Set up your first Financial Goal (e.g. Emergency Fund or Vacation) to systematically save toward milestones.');
  } else if (data.goalProgressScore < 10) {
    recs.push('📈 Deposit savings regularly into your active Financial Goals to boost goal completion rate.');
  }

  if (data.activeDaysCount < 10 || data.maxGapDays > 5) {
    recs.push('📅 Log expenses daily or every few days to avoid long gaps and improve tracking consistency.');
  }

  if (recs.length === 0) {
    recs.push('🌟 Fantastic job! Your financial habits are in top shape. Keep maintaining your budget and savings discipline.');
  }

  return recs.slice(0, 4);
}

// -----------------------------------------------------------------------------
// Database Query Helpers
// -----------------------------------------------------------------------------
function getUserExpenses(userId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC`, [userId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function getUserSavings(userId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM savings WHERE user_id = ? ORDER BY date DESC`, [userId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function getUserBudgets(userId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT data FROM budgets WHERE user_id = ?`, [userId], (err, row) => {
      if (err) return reject(err);
      if (!row || !row.data) return resolve({ global: 30000 });
      try {
        const parsed = JSON.parse(row.data);
        resolve(parsed);
      } catch (e) {
        resolve({ global: 30000 });
      }
    });
  });
}

function getUserGoals(userId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM financial_goals WHERE user_id = ?`, [userId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = {
  calculateFinancialHealthScore,
  getScoreHistory
};
