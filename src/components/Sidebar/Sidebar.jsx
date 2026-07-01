import React from 'react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  PiggyBank, 
  Sparkles, 
  LogOut, 
  Coins, 
  Trash2, 
  MessageSquare
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  user,
  onLogout, 
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
    <div className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
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
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </li>
          );
        })}

        {/* Logout */}
        <li 
          className="sidebar-item" 
          onClick={onLogout}
          style={{ color: '#f87171' }}
        >
          <LogOut size={20} />
          <span>Log Out</span>
        </li>
      </ul>

      {/* User profile section */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {getInitials(user?.name)}
        </div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">{user?.name || 'User'}</span>
          <span className="sidebar-user-email">{user?.email || 'user@example.com'}</span>
        </div>
      </div>
    </div>
  );
}

