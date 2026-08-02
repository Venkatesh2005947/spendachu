/**
 * db.js
 * Refactored Client-Side API Layer.
 * Communicates with the Express + SQLite backend server for cross-device synchronization.
 */

// Helper to retrieve the authorization token from storage
function getAuthHeaders() {
  const token = localStorage.getItem('tracker_token') || sessionStorage.getItem('tracker_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// Helper to handle fetch responses and handle JSON error output
async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Server error occurred.');
  }
  return data;
}

export const dbService = {
  // 1. Authentication Methods
  async registerUser(email, name, password) {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password })
    });
    const data = await handleResponse(res);
    if (data.token) {
      localStorage.setItem('tracker_token', data.token);
      localStorage.setItem('tracker_user', JSON.stringify(data.user));
    }
    return data.user;
  },

  async loginUser(email, password, rememberMe = true) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await handleResponse(res);
    
    if (data.token) {
      // Always store session in localStorage for permanent login
      localStorage.setItem('tracker_token', data.token);
      localStorage.setItem('tracker_user', JSON.stringify(data.user));
      // Backup in sessionStorage as fallback
      sessionStorage.setItem('tracker_token', data.token);
      sessionStorage.setItem('tracker_user', JSON.stringify(data.user));
    }
    
    return data.user;
  },

  getCurrentUser() {
    // Check if token exists in localStorage or sessionStorage
    const token = localStorage.getItem('tracker_token') || sessionStorage.getItem('tracker_token');
    if (!token) return null;
    
    try {
      const userStr = localStorage.getItem('tracker_user') || sessionStorage.getItem('tracker_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },

  // Verify the stored JWT token against the backend (server is the source of truth)
  async verifySession() {
    const token = localStorage.getItem('tracker_token') || sessionStorage.getItem('tracker_token');
    if (!token) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch('/api/verify', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        // Token is expired or invalid — clear all auth storage
        localStorage.removeItem('tracker_token');
        localStorage.removeItem('tracker_user');
        sessionStorage.removeItem('tracker_token');
        sessionStorage.removeItem('tracker_user');
        return null;
      }
      const data = await res.json();
      return data.user || null;
    } catch (e) {
      // Network error or timeout — don't log out, user may be offline or cold starting
      // Fall back to cached user data so they can see their data instantly
      console.warn('Token verification timed out or network issue. Using cached session.');
      const userStr = localStorage.getItem('tracker_user') || sessionStorage.getItem('tracker_user');
      try {
        return userStr ? JSON.parse(userStr) : null;
      } catch {
        return null;
      }
    }
  },

  logout() {
    localStorage.removeItem('tracker_token');
    localStorage.removeItem('tracker_user');
    sessionStorage.removeItem('tracker_token');
    sessionStorage.removeItem('tracker_user');
  },

  async resetPassword(email, newPassword) {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword })
    });
    return handleResponse(res);
  },

  async checkEmail(email) {
    const res = await fetch('/api/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleResponse(res);
  },

  async updateProfilePicture(profile_picture) {
    const res = await fetch('/api/user/profile-picture', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ profile_picture })
    });
    return handleResponse(res);
  },

  // 2. Expense Operations
  async getExpenses() {
    const res = await fetch('/api/expenses', {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async addExpense(expenseData) {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(expenseData)
    });
    // 409 means a duplicate was detected — return the payload so the caller
    // can show the warning UI instead of treating it as a hard error.
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      return { isDuplicate: true, confidence: data.confidence, existing: data.existing };
    }
    return handleResponse(res);
  },

  async updateExpense(id, updatedData) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updatedData)
    });
    return handleResponse(res);
  },

  async deleteExpense(id) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async clearAllExpenses() {
    const res = await fetch('/api/expenses/clear', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    await handleResponse(res);
    return [];
  },

  // 3. Saving Operations
  async getSavings() {
    const res = await fetch('/api/savings', {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async addSaving(savingData) {
    const res = await fetch('/api/savings', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(savingData)
    });
    return handleResponse(res);
  },

  async deleteSaving(id) {
    const res = await fetch(`/api/savings/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async clearAllSavings() {
    const res = await fetch('/api/savings/clear', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    await handleResponse(res);
    return [];
  },

  // 4. Recently Deleted (Trash) Operations
  async getTrash() {
    const res = await fetch('/api/trash', {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async restoreItem(id) {
    const res = await fetch(`/api/trash/restore/${id}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async permanentDeleteItem(id) {
    const res = await fetch(`/api/trash/permanent/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async clearTrash() {
    const res = await fetch('/api/trash/clear', {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // 5. Budget Operations
  async getBudgets() {
    const res = await fetch('/api/budgets', {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async updateBudgets(newBudgets) {
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newBudgets)
    });
    return handleResponse(res);
  },

  async submitFeedback(feedbackData) {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(feedbackData)
    });
    return handleResponse(res);
  },

  async scanReceipt(base64Image, mimeType) {
    const res = await fetch('/api/expenses/scan-receipt', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ image: base64Image, mimeType })
    });
    return handleResponse(res);
  },

  // 6. Financial Goals Operations
  async getGoals() {
    const res = await fetch('/api/goals', {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async addGoal(goalData) {
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(goalData)
    });
    return handleResponse(res);
  },

  async updateGoal(id, updatedData) {
    const res = await fetch(`/api/goals/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updatedData)
    });
    return handleResponse(res);
  },

  async addSavingsToGoal(id, amount, allowExceed = false) {
    const res = await fetch(`/api/goals/${id}/add-savings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount, allowExceed })
    });
    return handleResponse(res);
  },

  async deleteGoal(id) {
    const res = await fetch(`/api/goals/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // 10. Weekly Admin Analytics Report Operations
  async getWeeklyReport(weekKey = null, dispatch = false) {
    const params = new URLSearchParams();
    if (weekKey) params.append('weekKey', weekKey);
    if (dispatch) params.append('dispatch', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/admin/weekly-report${query}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getWeeklyReportHistory() {
    const res = await fetch('/api/admin/weekly-report/history', {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // 11. Inactive User & Settings Operations
  async getInactiveUsersAdmin() {
    const res = await fetch('/api/admin/inactive-users', {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async processInactiveRemindersAdmin() {
    const res = await fetch('/api/admin/inactive-users/process', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getUserSettings() {
    const res = await fetch('/api/user/settings', {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async updateReminderSettings(enabled) {
    const res = await fetch('/api/user/settings/reminders', {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ enabled })
    });
    return handleResponse(res);
  },

  // ── Financial Assistant (Ask SpendAchu) ───────────────────────────────────

  async sendChatMessage(question) {
    const res = await fetch('/api/financial-assistant/chat', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ question })
    });
    return handleResponse(res);
  },

  async getChatSuggestions() {
    const res = await fetch('/api/financial-assistant/suggestions', {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async clearChatSession() {
    const res = await fetch('/api/financial-assistant/session', {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getAssistantStatus() {
    const res = await fetch('/api/financial-assistant/status', {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getChatHistory() {
    const res = await fetch('/api/financial-assistant/history', {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async deleteChatHistory() {
    const res = await fetch('/api/financial-assistant/history', {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  }
};
