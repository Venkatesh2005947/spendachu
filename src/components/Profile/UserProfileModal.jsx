import React from 'react';
import { X, LogOut, ShieldCheck, Mail, Calendar, DollarSign, UserCheck, Award } from 'lucide-react';
import './UserProfileModal.css';

const UserProfileModal = ({
  user,
  onClose,
  onLogout,
  currencyCode = 'INR',
  onCurrencyChange,
  expensesCount = 0,
  savingsCount = 0,
  goalsCount = 0
}) => {
  if (!user) return null;

  const getInitials = (nameStr) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  return (
    <div className="upm-backdrop" onClick={onClose}>
      <div className="upm-card" onClick={(e) => e.stopPropagation()}>
        {/* Banner with Close Button */}
        <div className="upm-banner">
          <button className="upm-close-btn" onClick={onClose} title="Close Profile">
            <X size={18} />
          </button>
        </div>

        {/* Avatar & Role */}
        <div className="upm-header-body">
          <div className="upm-avatar-wrapper">
            <div className="upm-avatar">
              {getInitials(user.name)}
            </div>
            <div className="upm-online-badge" title="Account Active" />
          </div>

          <div className="upm-role-pill">
            <ShieldCheck size={14} />
            <span>{user.is_admin ? 'Admin Account' : 'Verified Member'}</span>
          </div>
        </div>

        {/* User Details */}
        <div className="upm-user-details">
          <h2 className="upm-user-name">{user.name || 'SpendAchu User'}</h2>
          <p className="upm-user-email">{user.email || 'user@example.com'}</p>
        </div>

        {/* Quick Activity Stats */}
        <div className="upm-stats-grid">
          <div className="upm-stat-box">
            <div className="upm-stat-val">{expensesCount}</div>
            <div className="upm-stat-lbl">Expenses</div>
          </div>
          <div className="upm-stat-box">
            <div className="upm-stat-val">{savingsCount}</div>
            <div className="upm-stat-lbl">Savings</div>
          </div>
          <div className="upm-stat-box">
            <div className="upm-stat-val">{goalsCount}</div>
            <div className="upm-stat-lbl">Goals</div>
          </div>
        </div>

        {/* Account Settings / Preferences Section */}
        <div className="upm-section">
          <div className="upm-section-title">Account Preferences</div>
          
          <div className="upm-settings-row">
            <div className="upm-settings-info">
              <DollarSign size={18} style={{ color: 'var(--accent-primary)' }} />
              <span className="upm-settings-lbl">Default Currency</span>
            </div>
            <select
              className="upm-currency-select"
              value={currencyCode}
              onChange={(e) => onCurrencyChange && onCurrencyChange(e.target.value)}
            >
              <option value="INR">₹ INR (Indian Rupee)</option>
              <option value="USD">$ USD (US Dollar)</option>
              <option value="EUR">€ EUR (Euro)</option>
              <option value="GBP">£ GBP (British Pound)</option>
            </select>
          </div>
        </div>

        {/* Security & Verification Section */}
        <div className="upm-section" style={{ paddingBottom: '24px' }}>
          <div className="upm-section-title">Security & Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <UserCheck size={16} style={{ color: '#10b981' }} />
              <span>JWT Authentication Active & Protected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <Award size={16} style={{ color: '#3b82f6' }} />
              <span>PostgreSQL Enterprise Data Storage</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="upm-footer">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            SpendAchu v1.0.0
          </div>
          <button className="upm-logout-btn" onClick={() => { onClose(); onLogout(); }}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
