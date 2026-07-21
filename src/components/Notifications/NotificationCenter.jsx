import React, { useState, useEffect, useRef } from 'react';
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
  X
} from 'lucide-react';
import { dbService } from '../../services/db';

export default function NotificationCenter({ onNavigateTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await dbService.getUserNotifications(10, 0);
      setUnreadCount(res.unreadCount || 0);
      setNotifications(res.notifications || []);
    } catch (err) {
      console.warn('Failed to load user notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30s for real-time notification updates
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await dbService.markUserNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
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

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
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

  const handleNotificationClick = (item) => {
    if (!item.isRead) {
      handleMarkRead(item.id);
    }
    if (item.relatedPage && onNavigateTab) {
      onNavigateTab(item.relatedPage);
      setIsOpen(false);
    }
  };

  const getCategoryIcon = (type) => {
    switch (type) {
      case 'budget_warning':
      case 'unusual_expense': return <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />;
      case 'goal_progress':
      case 'goal_completed': return <Target size={15} style={{ color: 'var(--success)' }} />;
      case 'health_score': return <HeartPulse size={15} style={{ color: 'var(--accent-primary)' }} />;
      case 'ocr_failure': return <ReceiptText size={15} style={{ color: 'var(--warning)' }} />;
      default: return <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />;
    }
  };

  const formatTimeAgo = (ts) => {
    if (!ts) return '';
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Top Header Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications Center"
        style={{
          position: 'relative',
          background: unreadCount > 0 ? 'rgba(99, 102, 241, 0.15)' : 'var(--card-bg)',
          border: unreadCount > 0 ? '1px solid var(--accent-primary)' : '1px solid var(--card-border)',
          borderRadius: '12px',
          padding: '8px 12px',
          cursor: 'pointer',
          color: unreadCount > 0 ? 'var(--accent-primary)' : 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s ease',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <Bell size={18} className={unreadCount > 0 ? 'bell-ring' : ''} />
        {unreadCount > 0 && (
          <span 
            style={{ 
              background: 'var(--danger)', 
              color: '#fff', 
              fontSize: '10px', 
              fontWeight: '900', 
              padding: '2px 6px', 
              borderRadius: '10px',
              minWidth: '16px',
              textAlign: 'center'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div 
          className="glass-card notification-dropdown-panel"
        >
          {/* Dropdown Header */}
          <div 
            style={{ 
              padding: '14px 16px', 
              borderBottom: '1px solid var(--card-border)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              background: 'var(--bg-secondary)',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} style={{ color: 'var(--accent-primary)' }} />
              <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Notifications</strong>
              {unreadCount > 0 && (
                <span style={{ fontSize: '10px', fontWeight: '800', background: 'var(--accent-primary)', color: '#fff', padding: '2px 7px', borderRadius: '10px' }}>
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* Notifications List (Only list is scrollable) */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={28} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <div style={{ fontSize: '13px', fontWeight: '700' }}>All caught up!</div>
                <div style={{ fontSize: '11px', marginTop: '2px' }}>No new notifications</div>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--card-border)',
                    background: item.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.08)',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '10px', display: 'flex', flexShrink: 0 }}>
                    {getCategoryIcon(item.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                      <strong 
                        className="notification-item-text"
                        style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: '800', lineHeight: '1.3' }}
                      >
                        {item.title}
                      </strong>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, marginTop: '1px' }}>
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>

                    <p 
                      className="notification-item-text"
                      style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}
                    >
                      {item.message}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                    {!item.isRead && (
                      <button
                        onClick={(e) => handleMarkRead(item.id, e)}
                        title="Mark as read"
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: '3px' }}
                      >
                        <CheckCheck size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      title="Delete notification"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Dropdown Footer */}
          <div 
            style={{ 
              padding: '12px 16px', 
              borderTop: '1px solid var(--card-border)', 
              background: 'var(--bg-secondary)', 
              textAlign: 'center',
              flexShrink: 0 
            }}
          >
            <button
              onClick={() => {
                if (onNavigateTab) onNavigateTab('notifications');
                setIsOpen(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>View All Notifications Page</span>
              <ExternalLink size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
