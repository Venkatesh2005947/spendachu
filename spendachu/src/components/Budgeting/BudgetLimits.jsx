import React, { useState, useEffect } from 'react';
import { PiggyBank, Sparkles, ShieldCheck, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function BudgetLimits({ 
  budgets, 
  expenses, 
  onSaveBudgets,
  onClearAllExpenses
}) {
  const [globalLimit, setGlobalLimit] = useState(budgets.global || 2500);
  const [catLimits, setCatLimits] = useState({
    Food: budgets.Food || 400,
    Transport: budgets.Transport || 150,
    Rent: budgets.Rent || 1200,
    Shopping: budgets.Shopping || 300,
    Bills: budgets.Bills || 250,
    Entertainment: budgets.Entertainment || 200,
    Others: budgets.Others || 200
  });
  
  const [successMsg, setSuccessMsg] = useState('');

  // Extract spending totals for the current month per category
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const getCategorySpent = (category) => {
    return thisMonthExpenses
      .filter(e => {
        if (category === 'Others') {
          return e.category.startsWith('Others');
        }
        return e.category === category;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSuccessMsg('');

    const payload = {
      global: parseFloat(globalLimit) || 0,
      Food: parseFloat(catLimits.Food) || 0,
      Transport: parseFloat(catLimits.Transport) || 0,
      Rent: parseFloat(catLimits.Rent) || 0,
      Shopping: parseFloat(catLimits.Shopping) || 0,
      Bills: parseFloat(catLimits.Bills) || 0,
      Entertainment: parseFloat(catLimits.Entertainment) || 0,
      Others: parseFloat(catLimits.Others) || 0
    };

    onSaveBudgets(payload);
    setSuccessMsg('Budgets updated successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCatChange = (cat, val) => {
    setCatLimits(prev => ({
      ...prev,
      [cat]: val
    }));
  };

  const categories = Object.keys(catLimits);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Global Limit & Currency selectors */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PiggyBank style={{ color: 'var(--accent-primary)' }} />
          <span>Global Settings & Budget Limits</span>
        </h2>

        {successMsg && (
          <div className="alert-pill success" style={{ marginBottom: '20px', background: 'var(--success-bg)', color: 'var(--success)', borderLeft: '3px solid var(--success)' }}>
            <ShieldCheck size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', maxWidth: '320px', gap: '20px', marginBottom: '24px' }}>
            {/* Global Limit Input */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="globalLimit">Global Monthly Budget Limit (₹)</label>
              <input
                id="globalLimit"
                type="number"
                className="form-control"
                value={globalLimit}
                onChange={(e) => setGlobalLimit(e.target.value)}
                placeholder="50000"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button type="submit" className="glow-btn">
              Save Budget Configuration
            </button>

            <button 
              type="button" 
              className="outline-btn" 
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => {
                if (window.confirm('Are you sure you want to delete all expenses? This will permanently delete all entries.')) {
                  onClearAllExpenses();
                  setSuccessMsg('All expenses cleared successfully!');
                  setTimeout(() => setSuccessMsg(''), 3000);
                }
              }}
              disabled={expenses.length === 0}
              title="Purge all expense entries to start fresh"
            >
              Clear All Expenses
            </button>
          </div>
        </form>
      </div>

      {/* Category Wise Limits */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles style={{ color: 'var(--warning)' }} />
          <span>Category Budgets & Alerts</span>
        </h3>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Set limits for specific categories. We will display alarms when your monthly category spending crosses 80% (approaching) or 100% (exceeded).
        </p>

        <form onSubmit={handleSave}>
          <div className="budget-grid">
            {categories.map(cat => {
              const spent = getCategorySpent(cat);
              const limit = parseFloat(catLimits[cat]) || 0;
              const ratio = limit > 0 ? (spent / limit) * 100 : 0;
              
              let alertClass = '';
              let badgeText = 'Healthy';
              let badgeColor = 'var(--success)';
              
              if (limit > 0) {
                if (spent >= limit) {
                  alertClass = 'danger';
                  badgeText = 'Exceeded!';
                  badgeColor = 'var(--danger)';
                } else if (spent >= limit * 0.8) {
                  alertClass = 'warning';
                  badgeText = 'Warning (80%+)';
                  badgeColor = 'var(--warning)';
                }
              }

              return (
                <div key={cat} className={`glass-card budget-input-card ${alertClass}`} style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14.5px' }}>{cat}</span>
                    {limit > 0 && (
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--card-border)', color: badgeColor, fontWeight: 'bold' }}>
                        {badgeText}
                      </span>
                    )}
                  </div>
                  
                  {/* Category limit input */}
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <input
                      type="number"
                      className="form-control"
                      value={catLimits[cat]}
                      onChange={(e) => handleCatChange(cat, e.target.value)}
                      placeholder="No limit"
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                    />
                  </div>

                  {/* Summary values */}
                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>Spent: {formatCurrency(spent)}</span>
                    <span>Limit: {limit > 0 ? formatCurrency(limit) : 'None'}</span>
                  </div>

                  {/* Visual progress bar */}
                  {limit > 0 && (
                    <div style={{ height: '4px', background: 'var(--card-border)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${Math.min(ratio, 100)}%`, 
                          background: badgeColor 
                        }}
                      ></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '24px' }}>
            <button type="submit" className="glow-btn">
              Save Category Limits
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
