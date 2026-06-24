/**
 * helpers.js
 * Practical helper methods for date manipulation, currency formatters, and CSV export triggers.
 */

// Currencies database (Strictly INR for Indian Usage)
export const CURRENCY_SYMBOLS = {
  INR: '₹'
};

/**
 * Format numeric value to Indian Rupee string (lakhs & crores grouping)
 * @param {number} amount 
 * @returns {string} Formatted string
 */
export function formatCurrency(amount) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  } catch (e) {
    return `₹${Number(amount).toFixed(2)}`;
  }
}

/**
 * Checks if a given expense falls within a specific date filter
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} rangeType - 'today' | 'weekly' | 'monthly' | 'custom'
 * @param {Object} customRange - { start, end } strings
 * @returns {boolean} True if inside range
 */
export function isDateInRange(dateStr, rangeType, customRange = null) {
  const targetDate = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  
  // Set times to midnight to avoid hours clipping
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (rangeType === 'today') {
    return targetDate.getTime() === today.getTime();
  }
  
  if (rangeType === 'weekly') {
    // Current week: last 7 days from today
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    return targetDate >= weekAgo && targetDate <= now;
  }
  
  if (rangeType === 'monthly') {
    // Current month
    return targetDate.getMonth() === now.getMonth() && targetDate.getFullYear() === now.getFullYear();
  }
  
  if (rangeType === 'custom' && customRange && customRange.start && customRange.end) {
    const start = new Date(customRange.start + 'T00:00:00');
    const end = new Date(customRange.end + 'T23:59:59');
    return targetDate >= start && targetDate <= end;
  }
  
  return true;
}

/**
 * Generate and trigger a browser CSV file download from expense objects
 * @param {Array} expenses 
 */
export function exportExpensesToCSV(expenses) {
  if (!expenses || expenses.length === 0) return;

  const headers = ['ID', 'Date', 'Category', 'Payment Method', 'Description', 'Amount (INR)'];
  
  const rows = expenses.map(e => [
    e.id,
    e.date,
    e.category,
    e.paymentMethod,
    // Escape quotes in description to prevent breaking CSV cells
    `"${(e.description || '').replace(/"/g, '""')}"`,
    e.amount.toFixed(2)
  ]);

  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute("download", `ExpenseReport_${timestamp}.csv`);
  
  document.body.appendChild(link); // Required for FF
  link.click();
  document.body.removeChild(link);
}
