/**
 * SpendAchu Weekly Admin Analytics Report Engine
 * ===============================================
 * Aggregates 11 weekly metrics (new users, active users, expenses, savings, OCR success/failure,
 * duplicates blocked, anomalies, goals, feedback) from backend database tables.
 * Stores reports idempotently by week_key (e.g. 2026-W29) and dispatches Monday emails.
 */

const { db } = require('./dbConnector');
const https = require('https');
const http = require('http');

/**
 * Main function to generate or fetch a weekly report for a specific ISO week key.
 */
async function generateWeeklyReport(targetWeekKey = null, forceRegenerate = false) {
  const weekKey = targetWeekKey || getCurrentWeekKey();
  
  // 1. Check if report already exists in DB
  if (!forceRegenerate) {
    const existing = await getReportByWeekKey(weekKey);
    if (existing) {
      return existing;
    }
  }

  // 2. Calculate date range for the ISO week (Monday 00:00:00 to Sunday 23:59:59)
  const { startDateStr, endDateStr, startMs, endMs } = getWeekBounds(weekKey);

  // 3. Query DB tables concurrently
  const [
    newUsersCount,
    activeUsersCount,
    expenseStats,
    savingsStats,
    ocrFailuresCount,
    duplicatesBlockedCount,
    anomaliesCount,
    goalsCount,
    feedbackCount
  ] = await Promise.all([
    getNewUsersCount(startMs, endMs),
    getActiveUsersCount(startDateStr, endDateStr, startMs, endMs),
    getExpenseStats(startDateStr, endDateStr, startMs, endMs),
    getSavingsStats(startDateStr, endDateStr, startMs, endMs),
    getNotificationEventCount('receipt_ocr_failure', startMs, endMs),
    getNotificationEventCount('duplicate_expense_blocked', startMs, endMs),
    getNotificationEventCount('high_or_critical_expense_anomaly', startMs, endMs),
    getGoalsCreatedCount(startMs, endMs),
    getFeedbackCount(startMs, endMs)
  ]);

  const receiptsScannedCount = expenseStats.scannedExpensesCount + ocrFailuresCount;
  const receiptScanSuccessCount = expenseStats.scannedExpensesCount;

  const reportId = `war_${weekKey}_${Date.now()}`;
  const createdAt = Date.now();

  const reportData = {
    id: reportId,
    weekKey,
    startDate: startDateStr,
    endDate: endDateStr,
    newUsersCount,
    activeUsersCount,
    expensesCount: expenseStats.count,
    totalExpenseAmount: expenseStats.totalAmount,
    savingsCount: savingsStats.count,
    totalSavingsAmount: savingsStats.totalAmount,
    receiptsScannedCount,
    receiptScanSuccessCount,
    receiptScanFailureCount: ocrFailuresCount,
    duplicatesBlockedCount,
    anomaliesCount,
    goalsCreatedCount,
    feedbackCount,
    sentToEmail: 'spendachu@gmail.com',
    emailStatus: 'pending',
    createdAt,
    sentAt: null
  };

  // Save report idempotently to database
  await saveReportToDB(reportData);

  return reportData;
}

/**
 * Dispatch the weekly report summary email to spendachu@gmail.com asynchronously.
 */
async function dispatchWeeklyReportEmail(reportData) {
  if (!reportData || reportData.emailStatus === 'sent') {
    return true;
  }

  const recipientEmail = process.env.ADMIN_EMAIL || 'spendachu@gmail.com';
  const webhookUrl = process.env.ADMIN_NOTIFICATION_WEBHOOK_URL;
  const webhookSecret = process.env.ADMIN_NOTIFICATION_WEBHOOK_SECRET || 'spendachu-admin-webhook-secret';

  const payload = JSON.stringify({
    eventType: 'weekly_admin_analytics_report',
    weekKey: reportData.weekKey,
    recipientEmail,
    report: {
      period: `${reportData.startDate} to ${reportData.endDate}`,
      newUsers: reportData.newUsersCount,
      activeUsers: reportData.activeUsersCount,
      totalExpensesCount: reportData.expensesCount,
      totalExpenseAmount: `₹${reportData.totalExpenseAmount.toLocaleString()}`,
      totalSavingsCount: reportData.savingsCount,
      totalSavingsAmount: `₹${reportData.totalSavingsAmount.toLocaleString()}`,
      receiptsScanned: reportData.receiptsScannedCount,
      receiptScanSuccess: reportData.receiptScanSuccessCount,
      receiptScanFailures: reportData.receiptScanFailureCount,
      duplicatesBlocked: reportData.duplicatesBlockedCount,
      anomalyAlerts: reportData.anomaliesCount,
      financialGoalsCreated: reportData.goalsCreatedCount,
      feedbackReceived: reportData.feedbackCount
    },
    generatedAt: new Date().toISOString()
  });

  let delivered = false;

  if (webhookUrl && webhookUrl.trim() !== '') {
    try {
      await sendHttpRequest(webhookUrl, webhookSecret, payload);
      delivered = true;
    } catch (err) {
      console.warn(`⚠️ Failed to dispatch weekly report webhook: ${err.message}`);
    }
  }

  // Update report dispatch status in DB
  const sentAt = Date.now();
  const emailStatus = delivered ? 'sent' : 'delivered_locally';

  await new Promise((resolve) => {
    db.run(
      `UPDATE weekly_admin_reports 
       SET sent_to_email = ?, email_status = ?, sent_at = ? 
       WHERE week_key = ?`,
      [recipientEmail, emailStatus, sentAt, reportData.weekKey],
      () => resolve(true)
    );
  });

  reportData.emailStatus = emailStatus;
  reportData.sentAt = sentAt;

  return delivered;
}

/**
 * Get historical weekly reports ordered chronologically DESC.
 */
async function getWeeklyReportsHistory() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM weekly_admin_reports ORDER BY week_key DESC LIMIT 52`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        const mapped = (rows || []).map(r => ({
          id: r.id,
          weekKey: r.week_key,
          startDate: r.start_date,
          endDate: r.end_date,
          newUsersCount: r.new_users_count,
          activeUsersCount: r.active_users_count,
          expensesCount: r.expenses_count,
          totalExpenseAmount: r.total_expense_amount,
          savingsCount: r.savings_count,
          totalSavingsAmount: r.total_savings_amount,
          receiptsScannedCount: r.receipts_scanned_count,
          receiptScanSuccessCount: r.receipt_scan_success_count,
          receiptScanFailureCount: r.receipt_scan_failure_count,
          duplicatesBlockedCount: r.duplicates_blocked_count,
          anomaliesCount: r.anomalies_count,
          goalsCreatedCount: r.goals_created_count,
          feedbackCount: r.feedback_count,
          sentToEmail: r.sent_to_email,
          emailStatus: r.email_status,
          createdAt: Number(r.created_at),
          sentAt: r.sent_at ? Number(r.sent_at) : null
        }));
        resolve(mapped);
      }
    );
  });
}

// -----------------------------------------------------------------------------
// Database Query Helpers
// -----------------------------------------------------------------------------

function getReportByWeekKey(weekKey) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM weekly_admin_reports WHERE week_key = ?`,
      [weekKey],
      (err, r) => {
        if (err) return reject(err);
        if (!r) return resolve(null);
        resolve({
          id: r.id,
          weekKey: r.week_key,
          startDate: r.start_date,
          endDate: r.end_date,
          newUsersCount: r.new_users_count,
          activeUsersCount: r.active_users_count,
          expensesCount: r.expenses_count,
          totalExpenseAmount: r.total_expense_amount,
          savingsCount: r.savings_count,
          totalSavingsAmount: r.total_savings_amount,
          receiptsScannedCount: r.receipts_scanned_count,
          receiptScanSuccessCount: r.receipt_scan_success_count,
          receiptScanFailureCount: r.receipt_scan_failure_count,
          duplicatesBlockedCount: r.duplicates_blocked_count,
          anomaliesCount: r.anomalies_count,
          goalsCreatedCount: r.goals_created_count,
          feedbackCount: r.feedback_count,
          sentToEmail: r.sent_to_email,
          emailStatus: r.email_status,
          createdAt: Number(r.created_at),
          sentAt: r.sent_at ? Number(r.sent_at) : null
        });
      }
    );
  });
}

function saveReportToDB(report) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO weekly_admin_reports (
        id, week_key, start_date, end_date, new_users_count, active_users_count,
        expenses_count, total_expense_amount, savings_count, total_savings_amount,
        receipts_scanned_count, receipt_scan_success_count, receipt_scan_failure_count,
        duplicates_blocked_count, anomalies_count, goals_created_count, feedback_count,
        sent_to_email, email_status, created_at, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(week_key) DO UPDATE SET
        new_users_count = EXCLUDED.new_users_count,
        active_users_count = EXCLUDED.active_users_count,
        expenses_count = EXCLUDED.expenses_count,
        total_expense_amount = EXCLUDED.total_expense_amount,
        savings_count = EXCLUDED.savings_count,
        total_savings_amount = EXCLUDED.total_savings_amount,
        receipts_scanned_count = EXCLUDED.receipts_scanned_count,
        receipt_scan_success_count = EXCLUDED.receipt_scan_success_count,
        receipt_scan_failure_count = EXCLUDED.receipt_scan_failure_count,
        duplicates_blocked_count = EXCLUDED.duplicates_blocked_count,
        anomalies_count = EXCLUDED.anomalies_count,
        goals_created_count = EXCLUDED.goals_created_count,
        feedback_count = EXCLUDED.feedback_count,
        created_at = EXCLUDED.created_at`,
      [
        report.id,
        report.weekKey,
        report.startDate,
        report.endDate,
        report.newUsersCount,
        report.activeUsersCount,
        report.expensesCount,
        report.totalExpenseAmount,
        report.savingsCount,
        report.totalSavingsAmount,
        report.receiptsScannedCount,
        report.receiptScanSuccessCount,
        report.receiptScanFailureCount,
        report.duplicatesBlockedCount,
        report.anomaliesCount,
        report.goalsCreatedCount,
        report.feedbackCount,
        report.sentToEmail,
        report.emailStatus,
        report.createdAt,
        report.sentAt
      ],
      (err) => {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

function getNewUsersCount(startMs, endMs) {
  return new Promise((resolve) => {
    db.all(`SELECT id, created_at FROM users`, [], (err, rows) => {
      if (err || !rows) return resolve(0);
      let count = 0;
      for (const row of rows) {
        let ts = row.created_at;
        if (!ts && row.id && row.id.startsWith('usr_')) {
          const parts = row.id.split('_');
          ts = parseInt(parts[1]);
        }
        if (ts && ts >= startMs && ts <= endMs) {
          count++;
        }
      }
      resolve(count);
    });
  });
}

function getActiveUsersCount(startDateStr, endDateStr, startMs, endMs) {
  return new Promise((resolve) => {
    db.all(
      `SELECT DISTINCT user_id FROM (
        SELECT user_id FROM expenses WHERE (date >= ? AND date <= ?) OR (created_at >= ? AND created_at <= ?)
        UNION
        SELECT user_id FROM savings WHERE (date >= ? AND date <= ?) OR (created_at >= ? AND created_at <= ?)
      )`,
      [startDateStr, endDateStr, startMs, endMs, startDateStr, endDateStr, startMs, endMs],
      (err, rows) => {
        if (err || !rows) return resolve(0);
        resolve(rows.length);
      }
    );
  });
}

function getExpenseStats(startDateStr, endDateStr, startMs, endMs) {
  return new Promise((resolve) => {
    db.all(
      `SELECT amount, description, notes FROM expenses 
       WHERE (date >= ? AND date <= ?) OR (created_at >= ? AND created_at <= ?)`,
      [startDateStr, endDateStr, startMs, endMs],
      (err, rows) => {
        if (err || !rows) return resolve({ count: 0, totalAmount: 0, scannedExpensesCount: 0 });
        let totalAmount = 0;
        let scannedExpensesCount = 0;
        rows.forEach(r => {
          totalAmount += (r.amount || 0);
          const text = `${r.description || ''} ${r.notes || ''}`.toLowerCase();
          if (text.includes('scanned') || text.includes('ocr') || text.includes('receipt')) {
            scannedExpensesCount++;
          }
        });
        resolve({
          count: rows.length,
          totalAmount: Math.round(totalAmount),
          scannedExpensesCount
        });
      }
    );
  });
}

function getSavingsStats(startDateStr, endDateStr, startMs, endMs) {
  return new Promise((resolve) => {
    db.all(
      `SELECT amount FROM savings 
       WHERE (date >= ? AND date <= ?) OR (created_at >= ? AND created_at <= ?)`,
      [startDateStr, endDateStr, startMs, endMs],
      (err, rows) => {
        if (err || !rows) return resolve({ count: 0, totalAmount: 0 });
        const totalAmount = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
        resolve({ count: rows.length, totalAmount: Math.round(totalAmount) });
      }
    );
  });
}

function getNotificationEventCount(eventType, startMs, endMs) {
  return new Promise((resolve) => {
    db.get(
      `SELECT COUNT(*) as count FROM admin_notifications 
       WHERE event_type = ? AND created_at >= ? AND created_at <= ?`,
      [eventType, startMs, endMs],
      (err, row) => {
        if (err || !row) return resolve(0);
        resolve(row.count || 0);
      }
    );
  });
}

function getGoalsCreatedCount(startMs, endMs) {
  return new Promise((resolve) => {
    db.get(
      `SELECT COUNT(*) as count FROM financial_goals WHERE created_at >= ? AND created_at <= ?`,
      [startMs, endMs],
      (err, row) => {
        if (err || !row) return resolve(0);
        resolve(row.count || 0);
      }
    );
  });
}

function getFeedbackCount(startMs, endMs) {
  return new Promise((resolve) => {
    db.get(
      `SELECT COUNT(*) as count FROM feedbacks WHERE created_at >= ? AND created_at <= ?`,
      [startMs, endMs],
      (err, row) => {
        if (err || !row) return resolve(0);
        resolve(row.count || 0);
      }
    );
  });
}

// -----------------------------------------------------------------------------
// Helper Date Calculations (ISO Week)
// -----------------------------------------------------------------------------

function getCurrentWeekKey() {
  const d = new Date();
  const year = d.getFullYear();
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
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

function getWeekBounds(weekKey) {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }

  const monday = new Date(ISOweekStart);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return {
    startDateStr: monday.toISOString().split('T')[0],
    endDateStr: sunday.toISOString().split('T')[0],
    startMs: monday.getTime(),
    endMs: sunday.getTime()
  };
}

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
          'User-Agent': 'SpendAchu-Weekly-Report-Engine/1.0'
        },
        timeout: 8000
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            reject(new Error(`Webhook HTTP status ${res.statusCode}`));
          }
        });
      });

      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Webhook request timed out'));
      });

      req.write(payload);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateWeeklyReport,
  dispatchWeeklyReportEmail,
  getWeeklyReportsHistory,
  getCurrentWeekKey
};
