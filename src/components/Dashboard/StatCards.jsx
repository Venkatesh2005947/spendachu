import React from 'react';
import { 
  CreditCard, 
  Calendar, 
  TrendingDown, 
  PiggyBank, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert,
  Wallet,
  BarChart3
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function StatCards({ expenses = [], budgets = {}, savings = [], selectedMonth, selectedYear }) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const safeSavings = Array.isArray(savings) ? savings : [];
  const safeBudgets = budgets || {};

  // Use provided month/year, defaulting to current
  const viewMonth = selectedMonth ?? now.getMonth();
  const viewYear  = selectedYear  ?? now.getFullYear();
  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear();

  // 1. Calculate Today's Expenses (only relevant for current month)
  const todaySpent = isCurrentMonth
    ? safeExpenses.filter(e => e && e.date === todayStr).reduce((sum, e) => sum + (e.amount || 0), 0)
    : 0;

  // 2. Calculate Weekly Expenses (Last 7 Days — only relevant for current month)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);
  const weeklySpent = isCurrentMonth
    ? safeExpenses
        .filter(e => { if (!e || !e.date) return false; const d = new Date(e.date + 'T00:00:00'); return d >= oneWeekAgo && d <= now; })
        .reduce((sum, e) => sum + (e.amount || 0), 0)
    : 0;

  // 3. Calculate Selected Month Expenses
  const monthlySpent = safeExpenses
    .filter(e => { if (!e || !e.date) return false; const d = new Date(e.date); return d.getMonth() === viewMonth && d.getFullYear() === viewYear; })
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // 4. Calculate Selected Month Savings
  const monthlySavings = safeSavings
    .filter(s => { if (!s || !s.date) return false; const d = new Date(s.date); return d.getMonth() === viewMonth && d.getFullYear() === viewYear; })
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  // 5. Budget remaining
  const globalBudget = safeBudgets.global || 30000;
  const budgetRemaining = globalBudget - monthlySpent;
  const budgetPercentage = Math.min((monthlySpent / globalBudget) * 100, 100);

  // Status configuration with Lucide React SVG outline icons
  let statusText = 'On Track';
  let statusColor = '#10b981';
  let StatusIcon = CheckCircle2;
  let progressGradient = 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)';

  if (monthlySpent >= globalBudget) { 
    statusText = 'Budget Exceeded'; 
    statusColor = '#ef4444'; 
    StatusIcon = ShieldAlert;
    progressGradient = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
  } else if (monthlySpent >= globalBudget * 0.8) { 
    statusText = 'Near Limit'; 
    statusColor = '#f59e0b'; 
    StatusIcon = AlertTriangle;
    progressGradient = 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)';
  }

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* Production-Grade Modern Fintech Card (Apple/Revolut Inspired) */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '24px 28px', 
          background: 'linear-gradient(145deg, var(--card-bg) 0%, var(--bg-secondary) 100%)', 
          color: 'var(--text-primary)', 
          border: '1px solid var(--card-border)', 
          borderRadius: '24px', 
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CreditCard size={16} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text-muted)', margin: 0 }}>
                {isCurrentMonth ? 'Spent This Month' : `${MONTH_NAMES[viewMonth]} ${viewYear}`}
              </h3>
            </div>
            <p style={{ fontSize: '38px', fontWeight: '900', margin: 0, lineHeight: '1.1', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {formatCurrency(monthlySpent)}
            </p>
          </div>

          {/* Minimalist Status Indicator Badge */}
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'var(--card-bg)', 
            padding: '8px 14px', 
            borderRadius: '99px', 
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <StatusIcon size={15} style={{ color: statusColor }} />
            <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '800', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              {statusText}
            </span>
          </div>
        </div>

        {/* Budget Progress Bar with Dynamic Gradient */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            <span>Limit: {formatCurrency(globalBudget)}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '800' }}>{budgetPercentage.toFixed(0)}% Used</span>
          </div>
          <div style={{ height: '10px', background: 'var(--bg-primary)', borderRadius: '99px', border: '1px solid var(--border-color)', overflow: 'hidden', padding: '1px' }}>
            <div style={{ 
              height: '100%', 
              width: `${budgetPercentage}%`, 
              background: progressGradient, 
              transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)', 
              borderRadius: '99px',
              boxShadow: `0 0 10px ${statusColor}40`
            }} />
          </div>
        </div>

        {/* Compact 3-Column Metrics Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
          gap: '12px', 
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px dashed var(--border-color)'
        }}>
          {isCurrentMonth ? (
            <>
              {/* Today Sub-Card */}
              <div style={{ 
                background: 'var(--bg-primary)', 
                padding: '12px 14px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <Calendar size={13} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today</span>
                </div>
                <p style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{formatCurrency(todaySpent)}</p>
              </div>

              {/* This Week Sub-Card */}
              <div style={{ 
                background: 'var(--bg-primary)', 
                padding: '12px 14px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <TrendingDown size={13} style={{ color: 'var(--accent-secondary)' }} />
                  <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Week</span>
                </div>
                <p style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{formatCurrency(weeklySpent)}</p>
              </div>
            </>
          ) : (
            <>
              {/* Total Spent Sub-Card */}
              <div style={{ 
                background: 'var(--bg-primary)', 
                padding: '12px 14px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <BarChart3 size={13} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Spent</span>
                </div>
                <p style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{formatCurrency(monthlySpent)}</p>
              </div>

              {/* Budget Left Sub-Card */}
              <div style={{ 
                background: 'var(--bg-primary)', 
                padding: '12px 14px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <Wallet size={13} style={{ color: 'var(--accent-secondary)' }} />
                  <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Budget Left</span>
                </div>
                <p style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{formatCurrency(Math.max(budgetRemaining, 0))}</p>
              </div>
            </>
          )}

          {/* Saved Sub-Card */}
          <div style={{ 
            background: 'rgba(16, 185, 129, 0.08)', 
            padding: '12px 14px', 
            borderRadius: '16px', 
            border: '1px solid rgba(16, 185, 129, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', marginBottom: '4px' }}>
              <PiggyBank size={14} />
              <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Saved</span>
            </div>
            <p style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: 'var(--success)' }}>
              {formatCurrency(monthlySavings)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
