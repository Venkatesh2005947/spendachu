import React, { useState } from 'react';
import { X, Plus, PiggyBank } from 'lucide-react';

export default function AddGoalSavingsModal({ goal, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [allowExceed, setAllowExceed] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const amtFloat = parseFloat(amount);
    if (isNaN(amtFloat) || amtFloat <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    const currentSaved = goal.savedAmount || 0;
    const target = goal.targetAmount || 0;
    const futureSaved = currentSaved + amtFloat;

    if (futureSaved > target && !allowExceed) {
      setError('Adding this amount would exceed the target. Check "Allow exceeding target" if desired.');
      return;
    }

    onSave(amtFloat, allowExceed);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 12050 }}>
      <div className="glass-card modal-container" style={{ maxWidth: '400px', animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PiggyBank size={20} style={{ color: 'var(--success)' }} />
            <h2 style={{ margin: 0 }}>Add Goal Savings</h2>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: '16px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Goal</span>
          <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{goal.name}</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            <span>Target: ₹{goal.targetAmount?.toLocaleString('en-IN')}</span>
            <span>Saved: ₹{goal.savedAmount?.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {error && (
          <div className="alert-pill danger" style={{ marginBottom: '20px' }}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label htmlFor="savings-amount">Amount to Deposit (₹)</label>
            <input
              id="savings-amount"
              type="number"
              step="0.01"
              required
              className="form-control"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ fontSize: '18px', fontWeight: 'bold' }}
              autoFocus
            />
          </div>

          {/* Exceed Toggle */}
          {parseFloat(amount || 0) + (goal.savedAmount || 0) > (goal.targetAmount || 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="savings-allow-exceed"
                type="checkbox"
                checked={allowExceed}
                onChange={(e) => setAllowExceed(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
              <label htmlFor="savings-allow-exceed" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', margin: 0, fontWeight: '700' }}>
                Allow saved amount to exceed target
              </label>
            </div>
          )}

          <button
            type="submit"
            className="glow-btn"
            style={{ width: '100%', justifyContent: 'center', background: 'var(--success)' }}
          >
            <Plus size={16} />
            <span>Deposit Savings</span>
          </button>
        </form>
      </div>
    </div>
  );
}
