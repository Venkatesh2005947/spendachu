import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  ExternalLink, 
  AlertTriangle, 
  Target, 
  ReceiptText, 
  HeartPulse, 
  Sparkles, 
  ShieldAlert,
  Info,
  Filter,
  Check
} from 'lucide-react';
import { dbService } from '../../services/db';

export default function NotificationsPage({ onNavigateTab }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'unread' | 'budget' | 'goals' | 'system'

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await dbService.getUserNotifications(100, 0);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications page:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await dbService.markUserNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await dbService.markAllUserNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await dbService.deleteUserNotification(id);
      const item = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (item && !item.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleAction = (item) => {
    if (!item.isRead) {
      handleMarkRead(item.id);
    }
    if (item.relatedPage && onNavigateTab) {
      onNavigateTab(item.relatedPage);
    }
  };

  const getCategoryIcon = (type) => {
    switch (type) {
      case 'budget_warning':
      case 'unusual_expense': return <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />;
      case 'goal_progress':
      case 'goal_completed': return <Target size={18} style={{ color: 'var(--success)' }} />;
      case 'health_score': return <HeartPulse size={18} style={{ color: 'var(--accent-primary)' }} />;
      case 'ocr_failure': return <ReceiptText size={18} style={{ color: 'var(--warning)' }} />;
      default: return <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'unread') return !n.isRead;
    if (filterType === 'budget') return n.type === 'budget_warning' || n.type === 'unusual_expense';
    if (filterType === 'goals') return n.type === 'goal_progress' || n.type === 'goal_completed';
    if (filterType === 'system') return n.type === 'system' || n.type === 'ocr_failure';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Header Banner */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '24px', 
          borderRadius: '24px', 
          background: 'var(--card-bg)', 
          border: '1px solid var(--card-border)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '12px', borderRadius: '16px', color: 'var(--accent-primary)', display: 'flex' }}>
            <Bell size={26} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>
              Notifications Center 🔔
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Stay updated on budget limits, unusual expenses, goal milestones, and system alerts
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="secondary-btn"
            style={{ padding: '10px 18px', borderRadius: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <CheckCheck size={16} />
            <span>Mark All as Read ({unreadCount})</span>
          </button>
        )}
      </div>

      {/* Filter Tabs Bar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <FilterTab active={filterType === 'all'} onClick={() => setFilterType('all')} label="All Notifications" count={notifications.length} />
        <FilterTab active={filterType === 'unread'} onClick={() => setFilterType('unread')} label="Unread" count={unreadCount} badge />
        <FilterTab active={filterType === 'budget'} onClick={() => setFilterType('budget')} label="Budget & Expenses" />
        <FilterTab active={filterType === 'goals'} onClick={() => setFilterType('goals')} label="Financial Goals" />
        <FilterTab active={filterType === 'system'} onClick={() => setFilterType('system')} label="System & Safety" />
      </div>

      {/* Notifications Listing Card */}
      <div className="glass-card" style={{ padding: '0', borderRadius: '24px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
        
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Loading your notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bell size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>No notifications found</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>You have no items in this category filter.</p>
          </div>
        ) : (
          filteredNotifications.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--card-border)',
                background: item.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                transition: 'background 0.15s ease'
              }}
            >
              <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '14px', display: 'flex', flexShrink: 0 }}>
                {getCategoryIcon(item.type)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '14.5px', color: 'var(--text-primary)' }}>
                    {item.title}
                  </strong>
                  {!item.isRead && (
                    <span style={{ background: 'var(--accent-primary)', color: '#fff', fontSize: '9px', fontWeight: '900', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase' }}>
                      New
                    </span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {item.message}
                </p>

                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                {item.relatedPage && (
                  <button
                    onClick={() => handleAction(item)}
                    className="secondary-btn"
                    style={{ padding: '6px 12px', borderRadius: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>View</span>
                    <ExternalLink size={13} />
                  </button>
                )}

                {!item.isRead && (
                  <button
                    onClick={() => handleMarkRead(item.id)}
                    title="Mark as read"
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: '6px' }}
                  >
                    <Check size={18} />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(item.id)}
                  title="Delete notification"
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

function FilterTab({ active, onClick, label, count, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: '16px',
        border: active ? '1px solid var(--accent-primary)' : '1px solid var(--card-border)',
        background: active ? 'rgba(99, 102, 241, 0.15)' : 'var(--card-bg)',
        color: active ? 'var(--accent-primary)' : 'var(--text-primary)',
        fontSize: '12.5px',
        fontWeight: '700',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.15s ease'
      }}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span style={{ 
          background: badge && count > 0 ? 'var(--danger)' : 'var(--bg-secondary)', 
          color: badge && count > 0 ? '#fff' : 'var(--text-muted)', 
          fontSize: '10px', 
          padding: '2px 6px', 
          borderRadius: '10px' 
        }}>
          {count}
        </span>
      )}
    </button>
  );
}
