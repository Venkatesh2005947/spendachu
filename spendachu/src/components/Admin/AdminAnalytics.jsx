import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  UserCheck, 
  ReceiptText, 
  PiggyBank, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Target, 
  MessageSquare, 
  Send, 
  RotateCw, 
  Calendar,
  ChevronRight,
  Info
} from 'lucide-react';
import { dbService } from '../../services/db';

export default function AdminAnalytics() {
  const [currentReport, setCurrentReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedWeekKey, setSelectedWeekKey] = useState('');

  const loadAnalytics = async (weekKey = null) => {
    try {
      setLoading(true);
      setError(null);
      const [report, historyList] = await Promise.all([
        dbService.getWeeklyReport(weekKey),
        dbService.getWeeklyReportHistory().catch(() => [])
      ]);
      setCurrentReport(report);
      setHistory(historyList || []);
      if (!weekKey && report) {
        setSelectedWeekKey(report.weekKey);
      }
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
      setError(err.message || 'Failed to load weekly report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleWeekChange = (e) => {
    const key = e.target.value;
    setSelectedWeekKey(key);
    loadAnalytics(key);
  };

  const handleManualDispatch = async () => {
    try {
      setDispatchLoading(true);
      const updatedReport = await dbService.getWeeklyReport(selectedWeekKey, true);
      setCurrentReport(updatedReport);
      alert(`Weekly report email dispatched to spendachu@gmail.com! (Status: ${updatedReport.emailStatus})`);
      loadAnalytics(selectedWeekKey);
    } catch (err) {
      alert(`Dispatch error: ${err.message}`);
    } finally {
      setDispatchLoading(false);
    }
  };

  const calculateSuccessRate = (success, total) => {
    if (!total || total === 0) return '100%';
    return `${Math.round((success / total) * 100)}%`;
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
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '12px', borderRadius: '16px', color: 'var(--success)', display: 'flex' }}>
            <BarChart3 size={26} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>
              Weekly Admin Analytics Report 📊
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Backend aggregated metric performance & Monday spendachu@gmail.com email dispatcher
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Week Selector */}
          <select
            value={selectedWeekKey}
            onChange={handleWeekChange}
            style={{
              padding: '10px 14px',
              borderRadius: '16px',
              border: '1px solid var(--card-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: '800'
            }}
          >
            {history.length > 0 ? (
              history.map(h => (
                <option key={h.weekKey} value={h.weekKey}>
                  {h.weekKey} ({h.startDate} to {h.endDate})
                </option>
              ))
            ) : (
              <option value="">Current Week</option>
            )}
          </select>

          <button 
            onClick={handleManualDispatch}
            disabled={dispatchLoading || loading}
            className="primary-btn"
            style={{ padding: '10px 18px', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Send size={15} className={dispatchLoading ? 'spin' : ''} />
            <span>{dispatchLoading ? 'Sending...' : 'Send Monday Email Now 📧'}</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="scanning-spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--card-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }}></div>
          <span style={{ fontSize: '14px', fontWeight: '700' }}>Aggregating weekly database metrics...</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div style={{ padding: '20px', background: 'var(--danger-bg)', borderRadius: '16px', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '13.5px' }}>
          <AlertTriangle size={18} style={{ marginBottom: '6px' }} />
          <div>{error}</div>
        </div>
      )}

      {/* Report Data Cards */}
      {!loading && !error && currentReport && (
        <>
          {/* Email Status Bar */}
          <div 
            style={{ 
              background: 'var(--bg-secondary)', 
              padding: '14px 20px', 
              borderRadius: '16px', 
              border: '1px solid var(--card-border)',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              fontSize: '13px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--accent-primary)' }} />
              <strong style={{ color: 'var(--text-primary)' }}>
                Report Period: {currentReport.startDate} to {currentReport.endDate} ({currentReport.weekKey})
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Email Status:</span>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: '900', 
                padding: '4px 10px', 
                borderRadius: '20px', 
                background: currentReport.emailStatus === 'sent' ? 'rgba(16, 185, 129, 0.15)' : 'var(--warning-bg)',
                color: currentReport.emailStatus === 'sent' ? 'var(--success)' : 'var(--warning)',
                textTransform: 'uppercase'
              }}>
                {currentReport.emailStatus === 'sent' ? `Sent to ${currentReport.sentToEmail}` : `Status: ${currentReport.emailStatus}`}
              </span>
            </div>
          </div>

          {/* 11 KPI Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <MetricKpiCard 
              icon={<Users size={20} />} 
              iconBg="rgba(99, 102, 241, 0.15)" 
              iconColor="var(--accent-primary)" 
              label="New Users Registered" 
              value={currentReport.newUsersCount} 
              unit="accounts" 
            />
            <MetricKpiCard 
              icon={<UserCheck size={20} />} 
              iconBg="rgba(16, 185, 129, 0.15)" 
              iconColor="var(--success)" 
              label="Active Users" 
              value={currentReport.activeUsersCount} 
              unit="users" 
            />
            <MetricKpiCard 
              icon={<ReceiptText size={20} />} 
              iconBg="rgba(239, 68, 68, 0.15)" 
              iconColor="var(--danger)" 
              label="Total Expenses Logged" 
              value={`₹${currentReport.totalExpenseAmount.toLocaleString()}`} 
              unit={`${currentReport.expensesCount} entries`} 
            />
            <MetricKpiCard 
              icon={<PiggyBank size={20} />} 
              iconBg="rgba(16, 185, 129, 0.15)" 
              iconColor="var(--success)" 
              label="Total Savings Added" 
              value={`₹${currentReport.totalSavingsAmount.toLocaleString()}`} 
              unit={`${currentReport.savingsCount} entries`} 
            />
            <MetricKpiCard 
              icon={<Camera size={20} />} 
              iconBg="rgba(6, 182, 212, 0.15)" 
              iconColor="#06b6d4" 
              label="Receipts Scanned" 
              value={currentReport.receiptsScannedCount} 
              unit="scans" 
            />
            <MetricKpiCard 
              icon={<CheckCircle2 size={20} />} 
              iconBg="rgba(16, 185, 129, 0.15)" 
              iconColor="var(--success)" 
              label="Scan Success Rate" 
              value={calculateSuccessRate(currentReport.receiptScanSuccessCount, currentReport.receiptsScannedCount)} 
              unit={`${currentReport.receiptScanSuccessCount} successful`} 
            />
            <MetricKpiCard 
              icon={<AlertTriangle size={20} />} 
              iconBg="rgba(245, 158, 11, 0.15)" 
              iconColor="var(--warning)" 
              label="Scan Failures" 
              value={currentReport.receiptScanFailureCount} 
              unit="failed" 
            />
            <MetricKpiCard 
              icon={<ShieldAlert size={20} />} 
              iconBg="rgba(168, 85, 247, 0.15)" 
              iconColor="#a855f7" 
              label="Duplicates Blocked" 
              value={currentReport.duplicatesBlockedCount} 
              unit="blocked" 
            />
            <MetricKpiCard 
              icon={<AlertTriangle size={20} />} 
              iconBg="rgba(239, 68, 68, 0.15)" 
              iconColor="var(--danger)" 
              label="Anomaly Alerts Created" 
              value={currentReport.anomaliesCount} 
              unit="alerts" 
            />
            <MetricKpiCard 
              icon={<Target size={20} />} 
              iconBg="rgba(99, 102, 241, 0.15)" 
              iconColor="var(--accent-primary)" 
              label="Financial Goals Created" 
              value={currentReport.goalsCreatedCount} 
              unit="goals" 
            />
            <MetricKpiCard 
              icon={<MessageSquare size={20} />} 
              iconBg="rgba(16, 185, 129, 0.15)" 
              iconColor="var(--success)" 
              label="Feedback Submissions" 
              value={currentReport.feedbackCount} 
              unit="messages" 
            />
          </div>

          {/* Historical Comparison Table */}
          <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Historical Weekly Reports Log 📜
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>Week</th>
                  <th style={{ padding: '10px 14px' }}>Dates</th>
                  <th style={{ padding: '10px 14px' }}>New Users</th>
                  <th style={{ padding: '10px 14px' }}>Active Users</th>
                  <th style={{ padding: '10px 14px' }}>Expenses Spent</th>
                  <th style={{ padding: '10px 14px' }}>Savings Total</th>
                  <th style={{ padding: '10px 14px' }}>OCR Scans</th>
                  <th style={{ padding: '10px 14px' }}>Anomalies</th>
                  <th style={{ padding: '10px 14px' }}>Email Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.weekKey} style={{ borderBottom: '1px solid var(--card-border)', background: h.weekKey === selectedWeekKey ? 'var(--bg-secondary)' : 'transparent' }}>
                    <td style={{ padding: '12px 14px', fontWeight: '800', color: 'var(--text-primary)' }}>{h.weekKey}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{h.startDate} – {h.endDate}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>{h.newUsersCount}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>{h.activeUsersCount}</td>
                    <td style={{ padding: '12px 14px', fontWeight: '800', color: 'var(--danger)' }}>₹{h.totalExpenseAmount.toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', fontWeight: '800', color: 'var(--success)' }}>₹{h.totalSavingsAmount.toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>{h.receiptsScannedCount}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--warning)' }}>{h.anomaliesCount}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', background: h.emailStatus === 'sent' ? 'rgba(16, 185, 129, 0.15)' : 'var(--warning-bg)', color: h.emailStatus === 'sent' ? 'var(--success)' : 'var(--warning)' }}>
                        {h.emailStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MetricKpiCard({ icon, iconBg, iconColor, label, value, unit }) {
  return (
    <div 
      className="glass-card" 
      style={{ 
        padding: '18px 20px', 
        borderRadius: '18px', 
        background: 'var(--card-bg)', 
        border: '1px solid var(--card-border)' 
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
          {label}
        </span>
        <div style={{ background: iconBg, padding: '8px', borderRadius: '12px', color: iconColor, display: 'flex' }}>
          {icon}
        </div>
      </div>

      <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', lineHeight: '1.2' }}>
        {value}
      </div>

      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '4px' }}>
        {unit}
      </div>
    </div>
  );
}
