import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  PiggyBank, 
  Sparkles, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Sun,
  Moon,
  Coins,
  Trash2,
  MessageSquare
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  user, 
  onLogout, 
  theme, 
  toggleTheme, 
  collapsed, 
  setCollapsed,
  mobileOpen
}) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'expenses', label: 'Expenses', icon: ReceiptText },
    { id: 'savings', label: 'Savings', icon: Coins },
    { id: 'budgeting', label: 'Budgeting', icon: PiggyBank },
    { id: 'insights', label: 'AI Insights', icon: Sparkles },
    { id: 'trash', label: 'Recently Deleted', icon: Trash2 },
    { id: 'feedback', label: 'Send Feedback', icon: MessageSquare }
  ];

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Sidebar Toggle Trigger */}
      <button 
        className="sidebar-toggle-btn"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand menu' : 'Collapse menu'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Brand logo */}
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px' }}>
        <img src="/logo.jpg" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', minWidth: '32px' }} />
        {!collapsed && <span className="sidebar-logo-text" style={{ fontWeight: '900' }}>SpendAchu</span>}
      </div>

      {/* Navigation menu items */}
      <ul className="sidebar-menu">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <li 
              key={item.id}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : ''}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </li>
          );
        })}

        {/* Theme toggle within sidebar */}
        <li 
          className="sidebar-item" 
          onClick={toggleTheme}
          title={collapsed ? 'Toggle theme' : ''}
          style={{ marginTop: 'auto' }}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </li>

        {/* Logout */}
        <li 
          className="sidebar-item" 
          onClick={onLogout}
          title={collapsed ? 'Log Out' : ''}
          style={{ color: '#f87171' }}
        >
          <LogOut size={20} />
          {!collapsed && <span>Log Out</span>}
        </li>
      </ul>

      {/* User profile section */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {getInitials(user?.name)}
        </div>
        {!collapsed && (
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name || 'User'}</span>
            <span className="sidebar-user-email">{user?.email || 'user@example.com'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
