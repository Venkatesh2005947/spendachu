/**
 * financialChatRateLimiter.js
 * =========================================
 * Per-user in-memory rate limiter for the financial assistant.
 *
 * Limits:
 * - Max N requests per minute per user (configurable via env)
 * - Max N requests per day per user (configurable via env)
 * - One active request at a time per user (prevent double-sends)
 *
 * SECURITY: Keys are userId strings from JWT, never user-controlled.
 * No cross-user data sharing. Resets daily at midnight IST.
 */

'use strict';

const RPM_LIMIT = parseInt(process.env.ASSISTANT_RPM_LIMIT || '10');
const DAILY_LIMIT = parseInt(process.env.ASSISTANT_DAILY_LIMIT || '100');

// In-memory stores (per-user, keyed by userId)
const minuteWindows = new Map();   // userId → [timestamp, ...]
const dailyCounters = new Map();   // userId → { count, date }
const activeRequests = new Set();  // userId

/**
 * Get today's date string in IST (for daily counter reset).
 */
function todayIST() {
  return new Date().toLocaleString('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split(',')[0].trim();
}

/**
 * Check and consume rate limit for a user.
 * Returns { allowed: bool, reason: string | null }
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const today = todayIST();

  // 1. Check one active request per user
  if (activeRequests.has(userId)) {
    return { allowed: false, reason: 'A request is already in progress. Please wait.' };
  }

  // 2. Per-minute rate limit (sliding window)
  const oneMinuteAgo = now - 60 * 1000;
  const userTimestamps = (minuteWindows.get(userId) || []).filter(t => t > oneMinuteAgo);

  if (userTimestamps.length >= RPM_LIMIT) {
    return {
      allowed: false,
      reason: `Too many questions. You can ask up to ${RPM_LIMIT} questions per minute. Please wait a moment.`
    };
  }

  // 3. Daily limit (resets at midnight IST)
  const dailyData = dailyCounters.get(userId);
  if (dailyData && dailyData.date === today && dailyData.count >= DAILY_LIMIT) {
    return {
      allowed: false,
      reason: `You have reached the daily limit of ${DAILY_LIMIT} questions. Come back tomorrow!`
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Mark the start of a request (consume rate limit slot).
 */
function startRequest(userId) {
  const now = Date.now();
  const today = todayIST();

  // Update minute window
  const oneMinuteAgo = now - 60 * 1000;
  const existing = (minuteWindows.get(userId) || []).filter(t => t > oneMinuteAgo);
  existing.push(now);
  minuteWindows.set(userId, existing);

  // Update daily counter
  const dailyData = dailyCounters.get(userId);
  if (!dailyData || dailyData.date !== today) {
    dailyCounters.set(userId, { count: 1, date: today });
  } else {
    dailyData.count += 1;
  }

  // Mark as active
  activeRequests.add(userId);
}

/**
 * Mark the end of a request (free active slot).
 */
function endRequest(userId) {
  activeRequests.delete(userId);
}

/**
 * Get remaining limits for a user (for status endpoint).
 */
function getRateLimitStatus(userId) {
  const now = Date.now();
  const today = todayIST();
  const oneMinuteAgo = now - 60 * 1000;

  const recentCount = (minuteWindows.get(userId) || []).filter(t => t > oneMinuteAgo).length;
  const dailyData = dailyCounters.get(userId);
  const dailyCount = (dailyData && dailyData.date === today) ? dailyData.count : 0;

  return {
    requestsThisMinute: recentCount,
    rpmLimit: RPM_LIMIT,
    requestsToday: dailyCount,
    dailyLimit: DAILY_LIMIT,
    hasActiveRequest: activeRequests.has(userId)
  };
}

// Cleanup old minute window entries every 5 minutes to prevent memory growth
setInterval(() => {
  const oneMinuteAgo = Date.now() - 60 * 1000;
  for (const [userId, timestamps] of minuteWindows.entries()) {
    const filtered = timestamps.filter(t => t > oneMinuteAgo);
    if (filtered.length === 0) {
      minuteWindows.delete(userId);
    } else {
      minuteWindows.set(userId, filtered);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  checkRateLimit,
  startRequest,
  endRequest,
  getRateLimitStatus
};
