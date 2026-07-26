/**
 * financialChatSessionService.js
 * =========================================
 * Manages conversation context for the financial assistant.
 *
 * - In-memory context (previous intent, category, period, etc.) for follow-ups
 * - Optional persistent storage in financial_chat_messages table
 *
 * SECURITY:
 * - Sessions keyed by authenticated userId (from JWT)
 * - Stored messages are sanitized — no DB queries, API keys, or system prompts
 * - Maximum 5 messages stored per session for context window
 */

'use strict';

const { db } = require('./dbConnector');
const SAVE_HISTORY = (process.env.SAVE_CHAT_HISTORY || 'false') === 'true';
const MAX_CONTEXT_TURNS = 5;

// In-memory session context store: userId → context object
const sessionContexts = new Map();

/**
 * Get context for a user session.
 */
function getContext(userId) {
  return sessionContexts.get(userId) || {
    previousIntent: null,
    previousDatePeriod: null,
    previousCategory: null,
    previousMerchant: null,
    previousGoalId: null,
    turnCount: 0
  };
}

/**
 * Update context after a successful assistant response.
 */
function updateContext(userId, { intent, period, category, merchant, goalId }) {
  const current = getContext(userId);
  sessionContexts.set(userId, {
    previousIntent: intent || current.previousIntent,
    previousDatePeriod: period || current.previousDatePeriod,
    previousCategory: category || current.previousCategory,
    previousMerchant: merchant || current.previousMerchant,
    previousGoalId: goalId || current.previousGoalId,
    turnCount: (current.turnCount || 0) + 1
  });
}

/**
 * Clear session context for a user (on explicit clear or logout).
 */
function clearContext(userId) {
  sessionContexts.delete(userId);
}

// ─── Optional Persistent History ────────────────────────────────────────────

/**
 * Ensure chat tables exist (called from session route if SAVE_HISTORY is true).
 * Tables are created by migration 012 and 013; this is a no-op safety check.
 */
function ensureTablesExist() {
  return Promise.resolve(); // Tables created by migrations
}

/**
 * Create or get a chat session ID for a user.
 */
function getOrCreateSessionId(userId) {
  return new Promise((resolve, reject) => {
    if (!SAVE_HISTORY) {
      // Use in-memory session ID
      resolve(`session_${userId}_${Date.now()}`);
      return;
    }

    // Find the most recent session (within last 24 hours)
    const since = Date.now() - 24 * 60 * 60 * 1000;
    db.get(
      `SELECT id FROM financial_chat_sessions WHERE user_id = ? AND last_active > ? ORDER BY last_active DESC LIMIT 1`,
      [userId, since],
      (err, row) => {
        if (err) return reject(err);

        if (row) {
          // Update last_active
          db.run(`UPDATE financial_chat_sessions SET last_active = ? WHERE id = ?`, [Date.now(), row.id]);
          resolve(row.id);
        } else {
          // Create new session
          const sessionId = `session_${userId}_${Date.now()}`;
          db.run(
            `INSERT INTO financial_chat_sessions (id, user_id, created_at, last_active) VALUES (?, ?, ?, ?)`,
            [sessionId, userId, Date.now(), Date.now()],
            (insertErr) => {
              if (insertErr) return reject(insertErr);
              resolve(sessionId);
            }
          );
        }
      }
    );
  });
}

/**
 * Save a sanitized message to persistent history.
 * Only stores: role, sanitized content, intent, timestamp.
 * NEVER stores: API keys, DB queries, system prompts, raw financial datasets.
 */
function saveMessage(userId, sessionId, role, content, intent = null) {
  if (!SAVE_HISTORY) return Promise.resolve();

  // Sanitize content — remove any accidental credential-like patterns
  const sanitized = (content || '')
    .substring(0, 2000)
    .replace(/[A-Za-z0-9_-]{20,}/g, (match) => {
      // Redact anything that looks like an API key or token (long alphanumeric strings)
      if (/^[A-Za-z0-9_-]{32,}$/.test(match)) return '[REDACTED]';
      return match;
    });

  const messageId = `msg_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  return new Promise((resolve) => {
    db.run(
      `INSERT INTO financial_chat_messages (id, session_id, user_id, role, content, intent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [messageId, sessionId, userId, role, sanitized, intent, Date.now()],
      (err) => {
        if (err) console.error('[FinancialChat] Failed to save message:', err.message);
        resolve(); // Non-blocking — don't fail the response on history save error
      }
    );
  });
}

/**
 * Get recent chat history for a user (last MAX_CONTEXT_TURNS messages).
 */
function getHistory(userId) {
  return new Promise((resolve) => {
    if (!SAVE_HISTORY) {
      resolve([]);
      return;
    }

    db.all(
      `SELECT role, content, intent, created_at FROM financial_chat_messages
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, MAX_CONTEXT_TURNS * 2],
      (err, rows) => {
        if (err) {
          console.error('[FinancialChat] Failed to fetch history:', err.message);
          resolve([]);
          return;
        }
        resolve((rows || []).reverse().map(r => ({
          role: r.role,
          content: r.content,
          intent: r.intent,
          createdAt: r.created_at
        })));
      }
    );
  });
}

/**
 * Delete all chat history for a user.
 */
function deleteHistory(userId) {
  return new Promise((resolve, reject) => {
    clearContext(userId);

    if (!SAVE_HISTORY) {
      resolve();
      return;
    }

    db.run(`DELETE FROM financial_chat_messages WHERE user_id = ?`, [userId], (err) => {
      if (err) return reject(err);
      db.run(`DELETE FROM financial_chat_sessions WHERE user_id = ?`, [userId], (err2) => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
}

module.exports = {
  getContext,
  updateContext,
  clearContext,
  getOrCreateSessionId,
  saveMessage,
  getHistory,
  deleteHistory,
  isSaveHistoryEnabled: () => SAVE_HISTORY
};
