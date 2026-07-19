const { db } = require('./dbConnector');

/**
 * Calculate the user's consecutive day expense logging streak
 */
function calculateStreak(userId) {
  return new Promise((resolve) => {
    db.all(
      `SELECT DISTINCT date FROM expenses WHERE user_id = ? ORDER BY date DESC`,
      [userId],
      (err, rows) => {
        if (err || !rows || rows.length === 0) return resolve(0);
        
        const dates = rows.map(r => r.date);
        
        // Get today and yesterday dates in local timezone format (YYYY-MM-DD)
        const formatYYYYMMDD = (d) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const todayStr = formatYYYYMMDD(new Date());
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = formatYYYYMMDD(yesterday);

        // Streak must end either today or yesterday to be considered active
        if (!dates.includes(todayStr) && !dates.includes(yesterdayStr)) {
          return resolve(0);
        }

        let streak = 0;
        let checkDate = new Date(dates.includes(todayStr) ? todayStr : yesterdayStr);

        // Max iteration safety block of 1000 days
        for (let i = 0; i < 1000; i++) {
          const checkStr = formatYYYYMMDD(checkDate);
          if (dates.includes(checkStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
        resolve(streak);
      }
    );
  });
}

/**
 * Evaluate and progress achievements for a user based on trigger actions.
 * @param {string} userId 
 * @param {Array<string>} ruleTypes - e.g. ['expense_count', 'streak_days', 'saved_amount', 'goal_created_count', 'goal_completed_count']
 * @returns Promise<Array<object>> - unlocked achievements list
 */
async function evaluateAchievements(userId, ruleTypes = []) {
  if (!userId) return [];

  return new Promise(async (resolve) => {
    try {
      // 1. Fetch user's achievements status
      db.all(
        `SELECT a.*, ua.unlocked_at, ua.progress, ua.seen
         FROM achievements a
         LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
         WHERE a.active = 1`,
        [userId],
        async (err, rows) => {
          if (err || !rows) {
            console.error('Failed to query achievements for evaluation:', err);
            return resolve([]);
          }

          const unlockedThisTime = [];

          // 2. Fetch required metrics from database
          let expenseCount = 0;
          let scannedCount = 0;
          let goalCreatedCount = 0;
          let goalCompletedCount = 0;
          let savedAmountTotal = 0;
          let streakDaysCount = 0;
          let underBudgetCount = 0;

          // Fetch expense count
          if (ruleTypes.includes('expense_count')) {
            expenseCount = await new Promise((res) => {
              db.get(`SELECT COUNT(*) as count FROM expenses WHERE user_id = ?`, [userId], (e, r) => {
                res(r ? r.count : 0);
              });
            });
          }

          // Fetch scanned receipts count
          // In index.js, scanned receipt expenses are standard expenses, but wait: how can we know if they are scanned?
          // Expenses have no 'is_scanned' field, but they are stored in the database.
          // Wait! In order to track 'scanned_count', we can increment it when they scan, or check if they have notes/descriptions containing 'scanned' or have custom items in trash.
          // Wait, let's look at the database schema: does expenses have an image hash or source?
          // No, but index.js is where the OCR scanning is done. We can track scanned_count by storing the count in a setting, or simply checking user_achievements progress.
          // Better: inside `evaluateAchievements`, we can let the caller pass direct progress updates!
          // For scanned_count, the trigger is when they successfully save a scanned receipt. The caller can pass a custom offset or increment!
          // Let's check how we can retrieve scannedCount. Let's make scannedCount = progress + 1 when triggered.
          // Or even simpler: we can evaluate specific metrics by passing them.
          
          // Fetch goal created count
          if (ruleTypes.includes('goal_created_count')) {
            goalCreatedCount = await new Promise((res) => {
              db.get(`SELECT COUNT(*) as count FROM financial_goals WHERE user_id = ?`, [userId], (e, r) => {
                res(r ? r.count : 0);
              });
            });
          }

          // Fetch goal completed count
          if (ruleTypes.includes('goal_completed_count')) {
            goalCompletedCount = await new Promise((res) => {
              db.get(`SELECT COUNT(*) as count FROM financial_goals WHERE user_id = ? AND status = 'completed'`, [userId], (e, r) => {
                res(r ? r.count : 0);
              });
            });
          }

          // Fetch total savings logged
          if (ruleTypes.includes('saved_amount')) {
            savedAmountTotal = await new Promise((res) => {
              db.get(`SELECT SUM(amount) as total FROM savings WHERE user_id = ?`, [userId], (e, r) => {
                res(r && r.total ? r.total : 0);
              });
            });
          }

          // Fetch streak days
          if (ruleTypes.includes('streak_days')) {
            streakDaysCount = await calculateStreak(userId);
          }

          // Fetch Stayed Under Budget count
          // Let's compute months where total monthly spent <= global limit
          if (ruleTypes.includes('under_budget_count')) {
            const budgetsData = await new Promise((res) => {
              db.get(`SELECT data FROM budgets WHERE user_id = ?`, [userId], (e, r) => {
                res(r ? JSON.parse(r.data) : null);
              });
            });
            const globalLimit = budgetsData ? budgetsData.global || 30000 : 30000;

            const spentByMonth = await new Promise((res) => {
              db.all(`SELECT date, amount FROM expenses WHERE user_id = ?`, [userId], (e, r = []) => {
                const months = {};
                r.forEach(exp => {
                  const d = new Date(exp.date);
                  if (isNaN(d.getTime())) return;
                  const key = `${d.getFullYear()}-${d.getMonth()}`;
                  months[key] = (months[key] || 0) + exp.amount;
                });
                res(months);
              });
            });

            // Find months where spending was below budget
            let monthsUnder = 0;
            Object.keys(spentByMonth).forEach(key => {
              if (spentByMonth[key] > 0 && spentByMonth[key] <= globalLimit) {
                monthsUnder++;
              }
            });
            underBudgetCount = monthsUnder;
          }

          // 3. Process each rule
          for (const ach of rows) {
            // Skip if already unlocked
            if (ach.unlocked_at) continue;

            let currentVal = 0;
            switch (ach.rule_type) {
              case 'expense_count':
                currentVal = expenseCount;
                break;
              case 'goal_created_count':
                currentVal = goalCreatedCount;
                break;
              case 'goal_completed_count':
                currentVal = goalCompletedCount;
                break;
              case 'saved_amount':
                currentVal = savedAmountTotal;
                break;
              case 'streak_days':
                currentVal = streakDaysCount;
                break;
              case 'under_budget_count':
                currentVal = underBudgetCount;
                break;
              case 'scanned_count':
                // For scanned_count, since we don't have a database table for scans, 
                // we check if it is passed in the triggers as an increment
                if (ruleTypes.includes('scanned_count')) {
                  const oldProgress = ach.progress || 0;
                  currentVal = oldProgress + 1;
                } else {
                  currentVal = ach.progress || 0;
                }
                break;
              default:
                currentVal = 0;
            }

            // Save progress
            const targetVal = ach.rule_value;
            const progressRatio = Math.min(currentVal, targetVal);

            // Check if unlocked
            if (currentVal >= targetVal) {
              // Unlock!
              const unlockedTime = Date.now();
              await new Promise((res) => {
                db.run(
                  `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, progress, seen)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(user_id, achievement_id) 
                   DO UPDATE SET unlocked_at = EXCLUDED.unlocked_at, progress = EXCLUDED.progress`,
                  [userId, ach.id, unlockedTime, targetVal, 0],
                  () => res()
                );
              });

              unlockedThisTime.push({
                id: ach.id,
                name: ach.name,
                description: ach.description,
                category: ach.category,
                icon: ach.icon,
                points: ach.points,
                unlockedAt: unlockedTime
              });
            } else if (progressRatio > (ach.progress || 0)) {
              // Update progress in database even if not unlocked yet
              await new Promise((res) => {
                db.run(
                  `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, progress, seen)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(user_id, achievement_id)
                   DO UPDATE SET progress = EXCLUDED.progress`,
                  [userId, ach.id, 0, progressRatio, 0],
                  () => res()
                );
              });
            }
          }

          resolve(unlockedThisTime);
        }
      );
    } catch (err) {
      console.error('Error running achievements engine:', err);
      resolve([]);
    }
  });
}

module.exports = {
  evaluateAchievements
};
