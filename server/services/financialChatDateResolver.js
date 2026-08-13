/**
 * financialChatDateResolver.js
 * =========================================
 * Resolves natural language date expressions to ISO date ranges.
 * All dates resolved using Asia/Kolkata (IST) timezone.
 *
 * Returns: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', label: string }
 */

'use strict';

const TIMEZONE = 'Asia/Kolkata';

/**
 * Get the current date in IST as a Date object.
 */
function nowInIST() {
  // Use Intl to get IST date components
  const now = new Date();
  const istStr = now.toLocaleString('en-CA', { timeZone: TIMEZONE, hour12: false });
  // istStr is like "2026-07-26, 12:35:00"
  const [datePart] = istStr.split(', ');
  return datePart; // "YYYY-MM-DD"
}

/**
 * Get today's date in IST as YYYY-MM-DD string.
 */
function todayIST() {
  return nowInIST();
}

/**
 * Add/subtract days from a YYYY-MM-DD string.
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Get start of week (Monday) for a given YYYY-MM-DD string.
 */
function startOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sunday, 1=Monday...
  const diff = (day === 0) ? -6 : 1 - day; // Monday-based week
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

/**
 * Get end of week (Sunday) for a given YYYY-MM-DD string.
 */
function endOfWeek(dateStr) {
  const monStr = startOfWeek(dateStr);
  return addDays(monStr, 6);
}

/**
 * Get first day of month.
 */
function startOfMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Get last day of month.
 */
function endOfMonth(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
}

/**
 * Parse a month name string to month number (1-indexed).
 */
function parseMonthName(str) {
  const months = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12
  };
  return months[str.toLowerCase().trim()] || null;
}

/**
 * Format a date period for display.
 */
function formatPeriodLabel(startDate, endDate) {
  if (startDate === endDate) {
    return new Date(startDate + 'T00:00:00Z').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    });
  }
  const s = new Date(startDate + 'T00:00:00Z');
  const e = new Date(endDate + 'T00:00:00Z');
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
    return s.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  return `${startDate} to ${endDate}`;
}

/**
 * Main resolver — takes a user query string and returns date range.
 * Falls back to current month if nothing matches.
 */
function resolveDateExpression(expression, referenceDate = null) {
  const today = referenceDate || todayIST();
  const todayObj = new Date(today + 'T00:00:00Z');
  const currentYear = todayObj.getUTCFullYear();
  const currentMonth = todayObj.getUTCMonth() + 1; // 1-indexed

  const raw = (expression || '').toLowerCase().trim();

  // today
  if (/\btoday\b/.test(raw)) {
    return { startDate: today, endDate: today, label: 'Today' };
  }

  // yesterday
  if (/\byesterday\b/.test(raw)) {
    const y = addDays(today, -1);
    return { startDate: y, endDate: y, label: 'Yesterday' };
  }

  // this week
  if (/\bthis\s+week\b/.test(raw)) {
    const start = startOfWeek(today);
    const end = endOfWeek(today);
    return { startDate: start, endDate: end, label: 'This Week' };
  }

  // last week
  if (/\blast\s+week\b/.test(raw)) {
    const lastWeekDay = addDays(startOfWeek(today), -1);
    const start = startOfWeek(lastWeekDay);
    const end = endOfWeek(lastWeekDay);
    return { startDate: start, endDate: end, label: 'Last Week' };
  }

  // last 7 days
  if (/\blast\s*7\s*days?\b/.test(raw)) {
    const start = addDays(today, -6);
    return { startDate: start, endDate: today, label: 'Last 7 Days' };
  }

  // last 30 days
  if (/\blast\s*30\s*days?\b/.test(raw)) {
    const start = addDays(today, -29);
    return { startDate: start, endDate: today, label: 'Last 30 Days' };
  }

  // last N days
  const lastNMatch = raw.match(/\blast\s*(\d+)\s*days?\b/);
  if (lastNMatch) {
    const n = parseInt(lastNMatch[1]);
    const start = addDays(today, -(n - 1));
    return { startDate: start, endDate: today, label: `Last ${n} Days` };
  }

  // this month
  if (/\bthis\s+month\b/.test(raw)) {
    const start = startOfMonth(currentYear, currentMonth);
    const end = endOfMonth(currentYear, currentMonth);
    const label = new Date(currentYear, currentMonth - 1, 1)
      .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    return { startDate: start, endDate: end, label };
  }

  // last month
  if (/\blast\s+month\b/.test(raw)) {
    const lm = currentMonth === 1 ? 12 : currentMonth - 1;
    const ly = currentMonth === 1 ? currentYear - 1 : currentYear;
    const start = startOfMonth(ly, lm);
    const end = endOfMonth(ly, lm);
    const label = new Date(ly, lm - 1, 1)
      .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    return { startDate: start, endDate: end, label };
  }

  // this year
  if (/\bthis\s+year\b/.test(raw)) {
    return {
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
      label: `${currentYear}`
    };
  }

  // last year
  if (/\blast\s+year\b/.test(raw)) {
    const ly = currentYear - 1;
    return { startDate: `${ly}-01-01`, endDate: `${ly}-12-31`, label: `${ly}` };
  }

  // "July 2026" or "jul 2026" or "July '26"
  const monthYearMatch = raw.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b\s*['\s]?\s*(\d{2,4})/);
  if (monthYearMatch) {
    const monthNum = parseMonthName(monthYearMatch[1]);
    let year = parseInt(monthYearMatch[2]);
    if (year < 100) year += 2000; // '26 → 2026
    if (monthNum) {
      const start = startOfMonth(year, monthNum);
      const end = endOfMonth(year, monthNum);
      const label = new Date(year, monthNum - 1, 1)
        .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      return { startDate: start, endDate: end, label };
    }
  }

  // "2026-07-01 to 2026-07-31" or "2026-07-01 - 2026-07-31"
  const rangeMatch = raw.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2})/);
  if (rangeMatch) {
    return {
      startDate: rangeMatch[1],
      endDate: rangeMatch[2],
      label: formatPeriodLabel(rangeMatch[1], rangeMatch[2])
    };
  }

  // "in January" or just "January" (current year implied)
  const monthOnlyMatch = raw.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/);
  if (monthOnlyMatch) {
    const monthNum = parseMonthName(monthOnlyMatch[1]);
    if (monthNum) {
      const start = startOfMonth(currentYear, monthNum);
      const end = endOfMonth(currentYear, monthNum);
      const label = new Date(currentYear, monthNum - 1, 1)
        .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      return { startDate: start, endDate: end, label };
    }
  }

  // Default: current month
  const start = startOfMonth(currentYear, currentMonth);
  const end = endOfMonth(currentYear, currentMonth);
  const label = new Date(currentYear, currentMonth - 1, 1)
    .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  return { startDate: start, endDate: end, label, isDefault: true };
}

/**
 * Get current month/year in IST.
 */
function getCurrentMonthYear() {
  const today = todayIST();
  const d = new Date(today + 'T00:00:00Z');
  return {
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear()
  };
}

/**
 * Get previous month/year in IST.
 */
function getPreviousMonthYear() {
  const { month, year } = getCurrentMonthYear();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return { month: prevMonth, year: prevYear };
}

module.exports = {
  resolveDateExpression,
  todayIST,
  addDays,
  startOfMonth,
  endOfMonth,
  getCurrentMonthYear,
  getPreviousMonthYear
};
