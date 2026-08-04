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
  BarChart3,
  Bot
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  user, 
  onLogout, 
  onOpenProfile,
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
    { id: 'assistant', label: 'Ask SpendAchu 🤖', icon: Bot },
    ...(isAdmin ? [
      { id: 'admin-analytics', label: 'Admin Analytics 📊', icon: BarChart3 }
    ] : []),
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

      </ul>

      {/* Professional User profile section */}
      <div 
        className="sidebar-user" 
        onClick={onOpenProfile}
        title="Click to view & manage account profile"
        style={{ 
          display: 'flex', 
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center', 
          justifyContent: collapsed ? 'center' : 'space-between', 
          gap: '10px',
          width: '100%',
          padding: collapsed ? '16px 10px' : '14px 16px',
          cursor: 'pointer',
          borderRadius: '14px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          transition: 'all 0.2s ease',
          margin: '8px 0 0'
        }}
      >
        <div style={{ display: 'flex', flexDirection: collapsed ? 'column' : 'row', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
          <div className="sidebar-user-avatar" title={collapsed ? user?.name : ''} style={{ position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
            {user?.profile_picture ? (
              <img src={user.profile_picture} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              getInitials(user?.name)
            )}
            <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', border: '2px solid var(--bg-sidebar)' }} />
          </div>
          {!collapsed && (
            <div className="sidebar-user-info" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="sidebar-user-name" style={{ fontSize: '13.5px', fontWeight: '700', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'User'}
                </span>
                {isAdmin && (
                  <span style={{ fontSize: '9.5px', background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', padding: '1px 6px', borderRadius: '6px', fontWeight: '800', letterSpacing: '0.5px' }}>
                    ADMIN
                  </span>
                )}
              </div>
              <span className="sidebar-user-email" style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email || 'user@example.com'}
              </span>
            </div>
          )}
        </div>
        
        <button 
          onClick={(e) => { e.stopPropagation(); onLogout(); }}
          title="Log Out"
          className="sidebar-logout-btn"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            cursor: 'pointer',
            padding: '7px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'; }}
        >
          <LogOut size={collapsed ? 15 : 16} />
        </button>
      </div>
    </div>
  );
}
