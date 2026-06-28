import React from 'react';
import { CalendarDays, CalendarRange, TrendingUp, PiggyBank } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function StatCards({ expenses, budgets, savings = [], selectedMonth, selectedYear }) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Use provided month/year, defaulting to current
  const viewMonth = selectedMonth ?? now.getMonth();
  const viewYear  = selectedYear  ?? now.getFullYear();
  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear();

  // 1. Calculate Today's Expenses (only relevant for current month)
  const todaySpent = isCurrentMonth
    ? expenses.filter(e => e.date === todayStr).reduce((sum, e) => sum + e.amount, 0)
    : null;

  // 2. Calculate Weekly Expenses (Last 7 Days — only relevant for current month)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);
  const weeklySpent = isCurrentMonth
    ? expenses
        .filter(e => { const d = new Date(e.date + 'T00:00:00'); return d >= oneWeekAgo && d <= now; })
        .reduce((sum, e) => sum + e.amount, 0)
    : null;

  // 3. Calculate Selected Month Expenses
  const monthlySpent = expenses
    .filter(e => { const d = new Date(e.date); return d.getMonth() === viewMonth && d.getFullYear() === viewYear; })
    .reduce((sum, e) => sum + e.amount, 0);

  // 4. Calculate Selected Month Savings
  const monthlySavings = savings
    .filter(s => { const d = new Date(s.date); return d.getMonth() === viewMonth && d.getFullYear() === viewYear; })
    .reduce((sum, s) => sum + s.amount, 0);

  // 5. Budget remaining
  const globalBudget = budgets.global || 30000;
  const budgetRemaining = globalBudget - monthlySpent;
  const budgetPercentage = Math.min((monthlySpent / globalBudget) * 100, 100);

  // Traffic light
  let trafficText = 'Safe Zone 🛡️';
  let trafficBg   = '#10b981';
  if (monthlySpent >= globalBudget) { trafficText = 'Ayyayo Kaasu Pochu! 🚨'; trafficBg = '#ef4444'; }
  else if (monthlySpent >= globalBudget * 0.8) { trafficText = 'Danger Zone! ⚠️'; trafficBg = '#f59e0b'; }

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Massive Main Spending Card */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '24px 30px', 
          background: 'var(--accent-primary)', 
          color: '#000000', 
          border: '1px solid var(--border-color)', 
          borderRadius: '24px', 
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#000000', marginBottom: '4px' }}>
              {isCurrentMonth ? 'Monthly Damage 💸' : `${MONTH_NAMES[viewMonth]} ${viewYear} 📅`}
            </h3>
            <p style={{ fontSize: '42px', fontWeight: '900', margin: 0, lineHeight: '1', fontFamily: 'var(--font-heading)' }}>
              {formatCurrency(monthlySpent)}
            </p>
          </div>

          {/* Traffic Light Indicator Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#000000', padding: '8px 16px', borderRadius: '99px', border: 'none' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: trafficBg, boxShadow: `0 0 8px ${trafficBg}` }}></div>
            <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase' }}>
              {trafficText}
            </span>
          </div>
        </div>

        {/* Budget Progress Bar */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', marginBottom: '6px' }}>
            <span>Limit: {formatCurrency(globalBudget)}</span>
            <span>{budgetPercentage.toFixed(0)}% Used</span>
          </div>
          <div style={{ height: '18px', background: '#ffffff', borderRadius: '99px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${budgetPercentage}%`, backgroundColor: trafficBg, transition: 'width 0.3s ease' }}></div>
          </div>
        </div>

        {/* Sub-damage breakdown */}
        <div className="dashboard-stats-grid">
          {isCurrentMonth ? (
            <>
              <div>
                <h4 style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#333333', marginBottom: '2px' }}>Today's Loss 💸</h4>
                <p style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>{formatCurrency(todaySpent)}</p>
              </div>
              <div>
                <h4 style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#333333', marginBottom: '2px' }}>Weekly Damage 📉</h4>
                <p style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>{formatCurrency(weeklySpent)}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h4 style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#333333', marginBottom: '2px' }}>Total Spent 📊</h4>
                <p style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>{formatCurrency(monthlySpent)}</p>
              </div>
              <div>
                <h4 style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#333333', marginBottom: '2px' }}>Budget Left 📉</h4>
                <p style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>{formatCurrency(Math.max(budgetRemaining, 0))}</p>
              </div>
            </>
          )}
          <div>
            <h4 style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#333333', marginBottom: '2px' }}>Saved 🐷</h4>
            <p style={{ fontSize: '16px', fontWeight: '900', margin: 0, color: 'var(--success)' }}>{formatCurrency(monthlySavings)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

