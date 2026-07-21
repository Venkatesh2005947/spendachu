import React from 'react';
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
  MessageSquare,
  Trophy,
  HeartPulse,
  ShieldAlert,
  BarChart3,
  Bell
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
  const isAdmin = user && (
    (user.email && user.email.toLowerCase() === 'spendachu@gmail.com') ||
    user.is_admin === 1 ||
    user.is_admin === true
  );

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'health', label: 'Financial Health', icon: HeartPulse },
    { id: 'notifications', label: 'Notifications 🔔', icon: Bell },
    ...(isAdmin ? [
      { id: 'admin-notifications', label: 'Admin Alerts 🛡️', icon: ShieldAlert },
      { id: 'admin-analytics', label: 'Admin Analytics 📊', icon: BarChart3 }
    ] : []),
    { id: 'expenses', label: 'Expenses', icon: ReceiptText },
    { id: 'savings', label: 'Savings', icon: Coins },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
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

      </ul>

      {/* User profile section */}
      <div 
        className="sidebar-user" 
        style={{ 
          display: 'flex', 
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center', 
          justifyContent: collapsed ? 'center' : 'space-between', 
          gap: '10px',
          width: '100%',
          padding: collapsed ? '20px 10px' : '20px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: collapsed ? 'column' : 'row', alignItems: 'center', gap: '12px', overflow: 'hidden', width: collapsed ? 'auto' : '80%' }}>
          <div className="sidebar-user-avatar" title={collapsed ? user?.name : ''}>
            {getInitials(user?.name)}
          </div>
          {!collapsed && (
            <div className="sidebar-user-info" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
              <span className="sidebar-user-name" style={{ fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || 'User'}
              </span>
              <span className="sidebar-user-email" style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email || 'user@example.com'}
              </span>
            </div>
          )}
        </div>
        
        <button 
          onClick={onLogout}
          title="Log Out"
          className="sidebar-logout-btn"
          style={{
            background: 'none',
            border: 'none',
            color: '#f87171',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            marginTop: collapsed ? '6px' : '0'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248, 113, 113, 0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <LogOut size={collapsed ? 16 : 18} />
        </button>
      </div>
    </div>
  );
}
