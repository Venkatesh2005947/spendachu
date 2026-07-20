import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCw, 
  Eye, 
  Check, 
  Trash2, 
  X, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Info
} from 'lucide-react';
import { dbService } from '../../services/db';

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchNotifications = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page,
        limit: 15,
        ...(severityFilter ? { severity: severityFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {})
      };
      const res = await dbService.getAdminNotifications(params);
      setNotifications(res.notifications || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch admin notifications:', err);
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(1);
  }, [severityFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchNotifications(1);
  };

  const handleMarkRead = async (id) => {
    try {
      setActionLoading(id);
      await dbService.markAdminNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (id) => {
    try {
      setActionLoading(id);
      await dbService.dismissAdminNotification(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'dismissed' } : n));
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async (id) => {
    try {
      setActionLoading(id);
      const res = await dbService.retryAdminNotification(id);
      alert(res.message || 'Retry attempt completed.');
      fetchNotifications(pagination.page);
    } catch (err) {
      alert(`Retry error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'critical':
        return { label: 'CRITICAL', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'high':
        return { label: 'HIGH', bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: 'rgba(249, 115, 22, 0.3)' };
      case 'medium':
        return { label: 'MEDIUM', bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: 'rgba(234, 179, 8, 0.3)' };
      case 'low':
      default:
        return { label: 'LOW', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sent':
        return { label: 'Sent 🚀', color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.12)' };
      case 'failed':
        return { label: 'Failed ❌', color: 'var(--danger)', bg: 'var(--danger-bg)' };
      case 'read':
        return { label: 'Read 👀', color: 'var(--text-muted)', bg: 'var(--bg-secondary)' };
      case 'dismissed':
        return { label: 'Dismissed 🙈', color: 'var(--text-muted)', bg: 'transparent' };
      case 'pending':
      default:
        return { label: 'Pending ⏳', color: 'var(--warning)', bg: 'var(--warning-bg)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
            <ShieldAlert size={26} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>
              Admin Notification Center 🛡️
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Monitor system events, anomalies, security alerts, and Make.com webhook deliveries
            </p>
          </div>
        </div>

        <button 
          onClick={() => fetchNotifications(pagination.page)}
          className="outline-btn"
          style={{ padding: '10px 18px', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RotateCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search title, message, or user ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                borderRadius: '14px',
                border: '1px solid var(--card-border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Severity Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>Severity:</span>
            <select 
              value={severityFilter} 
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '14px',
                border: '1px solid var(--card-border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: '700'
              }}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="high">High Only</option>
              <option value="medium">Medium Only</option>
              <option value="low">Low Only</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>Status:</span>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '14px',
                border: '1px solid var(--card-border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: '700'
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="read">Read</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="scanning-spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--card-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }}></div>
          <span style={{ fontSize: '14px', fontWeight: '700' }}>Fetching admin notifications...</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div style={{ padding: '20px', background: 'var(--danger-bg)', borderRadius: '16px', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '13.5px' }}>
          <AlertTriangle size={18} style={{ marginBottom: '6px' }} />
          <div>{error}</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && notifications.length === 0 && (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', borderRadius: '24px', background: 'var(--card-bg)' }}>
          <CheckCircle2 size={40} style={{ color: 'var(--success)', marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>No Notifications Found</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            There are no admin notification records matching your current filter criteria.
          </p>
        </div>
      )}

      {/* Notifications Table / List */}
      {!loading && !error && notifications.length > 0 && (
        <div className="glass-card" style={{ padding: '20px', borderRadius: '24px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlgn: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '12px 16px' }}>Severity</th>
                <th style={{ padding: '12px 16px' }}>Event & Title</th>
                <th style={{ padding: '12px 16px' }}>User ID</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Created</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => {
                const sevBadge = getSeverityBadge(n.severity);
                const statBadge = getStatusBadge(n.status);

                return (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background 0.2s ease' }}>
                    {/* Severity */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <span style={{ 
                        fontSize: '10px', 
                        fontWeight: '900', 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        background: sevBadge.bg, 
                        color: sevBadge.color,
                        border: `1px solid ${sevBadge.border}`,
                        display: 'inline-block'
                      }}>
                        {sevBadge.label}
                      </span>
                    </td>

                    {/* Title & Message */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', maxWidth: '320px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {n.eventType}
                      </span>
                      <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                        {n.title}
                      </strong>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {n.message}
                      </p>
                    </td>

                    {/* User ID */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {n.userId || '—'}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: statBadge.color, background: statBadge.bg, padding: '4px 8px', borderRadius: '8px', display: 'inline-block' }}>
                        {statBadge.label}
                      </span>
                      {n.attemptCount > 0 && (
                        <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Attempts: {n.attemptCount}
                        </span>
                      )}
                    </td>

                    {/* Created Time */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => setSelectedNotification(n)}
                          className="outline-btn"
                          style={{ padding: '6px', borderRadius: '8px' }}
                          title="View Payload Details"
                        >
                          <Eye size={14} />
                        </button>

                        {n.status === 'failed' && (
                          <button 
                            onClick={() => handleRetry(n.id)}
                            className="outline-btn"
                            disabled={actionLoading === n.id}
                            style={{ padding: '6px', borderRadius: '8px', color: 'var(--warning)' }}
                            title="Retry Webhook Delivery"
                          >
                            <RotateCw size={14} className={actionLoading === n.id ? 'spin' : ''} />
                          </button>
                        )}

                        {n.status !== 'read' && n.status !== 'dismissed' && (
                          <button 
                            onClick={() => handleMarkRead(n.id)}
                            className="outline-btn"
                            disabled={actionLoading === n.id}
                            style={{ padding: '6px', borderRadius: '8px', color: 'var(--success)' }}
                            title="Mark as Read"
                          >
                            <Check size={14} />
                          </button>
                        )}

                        {n.status !== 'dismissed' && (
                          <button 
                            onClick={() => handleDismiss(n.id)}
                            className="outline-btn"
                            disabled={actionLoading === n.id}
                            style={{ padding: '6px', borderRadius: '8px', color: 'var(--danger)' }}
                            title="Dismiss Notification"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--card-border)', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total records)
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                disabled={pagination.page <= 1}
                onClick={() => fetchNotifications(pagination.page - 1)}
                className="outline-btn"
                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '10px' }}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <button 
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchNotifications(pagination.page + 1)}
                className="outline-btn"
                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '10px' }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payload Inspection Modal */}
      {selectedNotification && (
        <div 
          className="modal-overlay"
          onClick={() => setSelectedNotification(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            padding: '20px'
          }}
        >
          <div 
            className="glass-card" 
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '650px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              borderRadius: '24px',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              padding: '28px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>
                Notification Payload & Metadata 📋
              </h3>
              <button onClick={() => setSelectedNotification(null)} className="outline-btn" style={{ padding: '6px', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div><strong>ID:</strong> <code>{selectedNotification.id}</code></div>
              <div><strong>Event Key:</strong> <code>{selectedNotification.eventKey}</code></div>
              <div><strong>Event Type:</strong> <code>{selectedNotification.eventType}</code></div>
              <div><strong>Severity:</strong> <span style={{ textTransform: 'uppercase', fontWeight: '800' }}>{selectedNotification.severity}</span></div>
              <div><strong>Title:</strong> {selectedNotification.title}</div>
              <div><strong>Message:</strong> {selectedNotification.message}</div>
              <div><strong>Last Error:</strong> {selectedNotification.lastError || 'None'}</div>

              <div style={{ marginTop: '12px' }}>
                <strong style={{ display: 'block', marginBottom: '6px' }}>Sanitized Metadata (JSON):</strong>
                <pre style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '14px', border: '1px solid var(--card-border)', fontSize: '12px', color: 'var(--accent-primary)', overflowX: 'auto' }}>
                  {JSON.stringify(selectedNotification.metadata, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
