/**
 * SpendAchu User Notification Service
 * ====================================
 * Non-blocking event-driven notification manager for authenticated users.
 * Supports budget limit warnings, unusual expense alerts, goal progress,
 * goal completion, saving challenge updates, OCR scan failures, health score, and system messages.
 * Enforces event_key deduplication and strict user isolation.
 */

const { db } = require('./dbConnector');

/**
 * Record a user notification asynchronously without blocking caller operations.
 */
function notifyUser({ userId, type, title, message, relatedId = null, relatedPage = null, eventKey = null }) {
  if (!userId || !type || !title || !message) {
    console.warn('⚠️ notifyUser missing required parameters:', { userId, type, title });
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      const id = `un_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = Date.now();
      const safeEventKey = eventKey || `ev_${userId}_${type}_${createdAt}`;

      db.run(
        `INSERT INTO user_notifications (
          id, user_id, type, title, message, related_id, related_page, is_read, event_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        ON CONFLICT(event_key) DO NOTHING`,
        [id, userId, type, title, message, relatedId, relatedPage, safeEventKey, createdAt],
        function (err) {
          if (err) {
            console.warn(`⚠️ Error recording user notification (${type}):`, err.message);
            return resolve(false);
          }
          resolve(true);
        }
      );
    } catch (err) {
      console.warn('⚠️ notifyUser exception swallowed:', err.message);
      resolve(false);
    }
  });
}

/**
 * Fetch paginated notifications for a specific user and calculate unread count.
 */
function getUserNotifications(userId, limit = 50, offset = 0) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as unread_count FROM user_notifications WHERE user_id = ? AND is_read = 0`,
      [userId],
      (countErr, countRow) => {
        if (countErr) return reject(countErr);
        const unreadCount = countRow ? (countRow.unread_count || 0) : 0;

        db.all(
          `SELECT * FROM user_notifications 
           WHERE user_id = ? 
           ORDER BY created_at DESC 
           LIMIT ? OFFSET ?`,
          [userId, limit, offset],
          (err, rows) => {
            if (err) return reject(err);

            const notifications = (rows || []).map(r => ({
              id: r.id,
              userId: r.user_id,
              type: r.type,
              title: r.title,
              message: r.message,
              relatedId: r.related_id,
              relatedPage: r.related_page,
              isRead: r.is_read === 1,
              eventKey: r.event_key,
              createdAt: Number(r.created_at),
              readAt: r.read_at ? Number(r.read_at) : null
            }));

            resolve({
              unreadCount,
              notifications
            });
          }
        );
      }
    );
  });
}

/**
 * Mark a single user notification as read.
 */
function markUserNotificationRead(userId, notificationId) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.run(
      `UPDATE user_notifications SET is_read = 1, read_at = ? WHERE id = ? AND user_id = ?`,
      [now, notificationId, userId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Mark all unread notifications as read for a user.
 */
function markAllUserNotificationsRead(userId) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.run(
      `UPDATE user_notifications SET is_read = 1, read_at = ? WHERE user_id = ? AND is_read = 0`,
      [now, userId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      }
    );
  });
}

/**
 * Delete a user notification record.
 */
function deleteUserNotification(userId, notificationId) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM user_notifications WHERE id = ? AND user_id = ?`,
      [notificationId, userId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

module.exports = {
  notifyUser,
  getUserNotifications,
  markUserNotificationRead,
  markAllUserNotificationsRead,
  deleteUserNotification
};
