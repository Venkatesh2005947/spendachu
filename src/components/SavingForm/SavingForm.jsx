import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';

export default function SavingForm({ onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const amtFloat = parseFloat(amount);
    if (isNaN(amtFloat) || amtFloat <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    const payload = {
      amount: amtFloat,
      description: description.trim()
    };

    try {
      onSave(payload);
    } catch (err) {
      setError(err.message || 'Failed to save entry.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-card modal-container">
        <div className="modal-header">
          <h2>Add Saving</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert-pill danger" style={{ marginBottom: '20px' }}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Amount input */}
          <div className="form-group">
            <label htmlFor="amount">Amount (₹)</label>
            <input
              id="amount"
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

          {/* Short Note input */}
          <div className="form-group">
            <label htmlFor="description">Short Note (Optional)</label>
            <input
              id="description"
              type="text"
              className="form-control"
              placeholder="e.g. Monthly salary stash, Cash backup, Gift money"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Submit Action */}
          <button 
            type="submit" 
            className="glow-btn" 
            style={{ width: '100%', justifyContent: 'center', marginTop: '10px', background: 'var(--success)' }}
          >
            <PlusCircle size={18} />
            <span>Add Saving</span>
          </button>
        </form>
      </div>
    </div>
  );
}
