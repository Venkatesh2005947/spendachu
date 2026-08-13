import React, { useState, useEffect } from 'react';
import { X, Save, Sparkles, Check } from 'lucide-react';

export default function GoalForm({ goal, onClose, onSave }) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState('medium');
  const [notes, setNotes] = useState('');
  const [allowExceed, setAllowExceed] = useState(false);
  const [error, setError] = useState('');

  const categories = ['General', 'Travel', 'Education', 'Gadgets', 'Home', 'Vehicle', 'Emergency', 'Retirement', 'Others'];
  const priorities = [
    { value: 'low', label: 'Low 🥱' },
    { value: 'medium', label: 'Medium ⚡' },
    { value: 'high', label: 'High 🔥' }
  ];

  useEffect(() => {
    if (goal) {
      setName(goal.name || '');
      setTargetAmount(goal.targetAmount?.toString() || '');
      setSavedAmount(goal.savedAmount?.toString() || '0');
      setDeadline(goal.deadline || '');
      setCategory(goal.category || 'General');
      setPriority(goal.priority || 'medium');
      setNotes(goal.notes || '');
      setAllowExceed(goal.savedAmount > goal.targetAmount);
    } else {
      // Default deadline to 6 months from now
      const future = new Date();
      future.setMonth(future.getMonth() + 6);
      setDeadline(future.toISOString().split('T')[0]);
    }
  }, [goal]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const target = parseFloat(targetAmount);
    const saved = parseFloat(savedAmount || 0);

    if (!name.trim()) {
      setError('Please enter a goal name.');
      return;
    }

    if (isNaN(target) || target <= 0) {
      setError('Target amount must be a positive number greater than zero.');
      return;
    }

    if (isNaN(saved) || saved < 0) {
      setError('Saved amount cannot be negative.');
      return;
    }

    if (saved > target && !allowExceed) {
      setError('Saved amount cannot exceed target amount unless explicitly allowed.');
      return;
    }

    if (!deadline) {
      setError('Please select a valid deadline.');
      return;
    }

    const payload = {
      name: name.trim(),
      targetAmount: target,
      savedAmount: saved,
      deadline,
      category,
      priority,
      notes: notes.trim(),
      allowExceed
    };

    if (goal) {
      payload.status = goal.status;
    }

    onSave(payload);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 12000 }}>
      <div className="glass-card modal-container" style={{ maxWidth: '500px', animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="modal-header">
          <h2>{goal ? 'Edit Financial Goal' : 'Set New Goal 🎯'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert-pill danger" style={{ marginBottom: '20px' }}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Goal Name */}
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label htmlFor="goal-name">Goal Name</label>
            <input
              id="goal-name"
              type="text"
              required
              className="form-control"
              placeholder="e.g. Buy Macbook Pro, Trip to Bali, Emergency Fund"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>

          {/* Amount Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: '0' }}>
              <label htmlFor="target-amount">Target Amount (₹)</label>
              <input
                id="target-amount"
                type="number"
                step="0.01"
                required
                className="form-control"
                placeholder="0.00"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '0' }}>
              <label htmlFor="saved-amount">Already Saved (₹)</label>
              <input
                id="saved-amount"
                type="number"
                step="0.01"
                required
                className="form-control"
                placeholder="0.00"
                value={savedAmount}
                onChange={(e) => setSavedAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Exceed Toggle */}
          {parseFloat(savedAmount) > parseFloat(targetAmount || 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="allow-exceed"
                type="checkbox"
                checked={allowExceed}
                onChange={(e) => setAllowExceed(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
              <label htmlFor="allow-exceed" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', margin: 0, fontWeight: '700' }}>
                Allow saved amount to exceed target
              </label>
            </div>
          )}

          {/* Deadline */}
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label htmlFor="goal-deadline">Deadline</label>
            <input
              id="goal-deadline"
              type="date"
              required
              className="form-control"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {/* Category & Priority Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: '0' }}>
              <label htmlFor="goal-category">Category</label>
              <select
                id="goal-category"
                className="form-control"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '0' }}>
              <label htmlFor="goal-priority">Priority</label>
              <select
                id="goal-priority"
                className="form-control"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {priorities.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label htmlFor="goal-notes">Notes / Plan (Optional)</label>
            <textarea
              id="goal-notes"
              className="form-control"
              placeholder="e.g. Save ₹5,000 every month from side income..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Actions */}
          <button 
            type="submit" 
            className="glow-btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '14px', borderRadius: '12px' }}
          >
            <Save size={18} />
            <span>{goal ? 'Save Changes' : 'Create Goal 🚀'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
