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
    return handleResponse(res);
  },

  async loginUser(email, password, rememberMe = false) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await handleResponse(res);
    
    if (data.token) {
      if (rememberMe) {
        localStorage.setItem('tracker_token', data.token);
        localStorage.setItem('tracker_user', JSON.stringify(data.user));
      } else {
        sessionStorage.setItem('tracker_token', data.token);
        sessionStorage.setItem('tracker_user', JSON.stringify(data.user));
      }
    }
    
    return data.user;
  },

  getCurrentUser() {
    // Check if token exists in session
    const token = localStorage.getItem('tracker_token') || sessionStorage.getItem('tracker_token');
    if (!token) return null;
    
    try {
      const userStr = localStorage.getItem('tracker_user') || sessionStorage.getItem('tracker_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
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

  async sendAIChatMessage(message) {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message })
    });
    return handleResponse(res);
  }
};
