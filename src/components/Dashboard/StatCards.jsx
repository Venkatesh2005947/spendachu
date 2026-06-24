import React from 'react';
import { CalendarDays, CalendarRange, TrendingUp, PiggyBank } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function StatCards({ expenses, budgets, savings = [] }) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 1. Calculate Today's Expenses
  const todaySpent = expenses
    .filter(e => e.date === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  // 2. Calculate Weekly Expenses (Last 7 Days)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);
  const weeklySpent = expenses
    .filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      return d >= oneWeekAgo && d <= now;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  // 3. Calculate Monthly Expenses (Current Calendar Month)
  const monthlySpent = expenses
    .filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  // 3.5. Calculate Monthly Savings
  const monthlySavings = savings
    .filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, s) => sum + s.amount, 0);

  // 4. Calculate Budget remaining
  const globalBudget = budgets.global || 30000;
  const budgetRemaining = globalBudget - monthlySpent;
  const budgetPercentage = Math.min((monthlySpent / globalBudget) * 100, 100);

  // Traffic light state settings
  let trafficLight = 'green';
  let trafficText = 'Safe Zone 🛡️';
  let trafficBg = '#10b981'; // Green
  
  if (monthlySpent >= globalBudget) {
    trafficLight = 'red';
    trafficText = 'Ayyayo Kaasu Pochu! 🚨';
    trafficBg = '#ef4444'; // Red
  } else if (monthlySpent >= globalBudget * 0.8) {
    trafficLight = 'yellow';
    trafficText = 'Danger Zone! ⚠️';
    trafficBg = '#f59e0b'; // Yellow
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Massive Main Spending Card */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '24px 30px', 
          background: 'var(--accent-primary)', 
          color: '#000000', 
          border: '3px solid #000000', 
          borderRadius: '24px', 
          boxShadow: '6px 6px 0px #000000',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#000000', marginBottom: '4px' }}>
              Monthly Damage 💸
            </h3>
            <p style={{ fontSize: '42px', fontWeight: '900', margin: 0, lineHeight: '1', fontFamily: 'var(--font-heading)' }}>
              {formatCurrency(monthlySpent)}
            </p>
          </div>

          {/* Traffic Light Indicator Pill */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: '#000000', 
              padding: '8px 16px', 
              borderRadius: '99px',
              border: '2px solid #000000'
            }}
          >
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
          <div style={{ height: '18px', background: '#ffffff', borderRadius: '99px', border: '3px solid #000000', overflow: 'hidden' }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${budgetPercentage}%`, 
                backgroundColor: trafficBg,
                transition: 'width 0.3s ease'
              }}
            ></div>
          </div>
        </div>

        {/* Sub-damage breakdown */}
        <div className="dashboard-stats-grid">
          <div>
            <h4 style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#333333', marginBottom: '2px' }}>
              Today's Loss 💸
            </h4>
            <p style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>
              {formatCurrency(todaySpent)}
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#333333', marginBottom: '2px' }}>
              Weekly Damage 📉
            </h4>
            <p style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>
              {formatCurrency(weeklySpent)}
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#333333', marginBottom: '2px' }}>
              Saved 🐷
            </h4>
            <p style={{ fontSize: '16px', fontWeight: '900', margin: 0, color: 'var(--success)' }}>
              {formatCurrency(monthlySavings)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
