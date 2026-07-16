import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, RotateCcw, X, Calendar, Clock, Tag, CreditCard, User, Landmark, HelpCircle, FileText } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function ReceiptPreview({ result, onSave, onScanAgain, onCancel }) {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Others');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [tax, setTax] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  // Auto-populate when scan result is available
  useEffect(() => {
    if (result) {
      setMerchant(result.merchant || '');
      setAmount(result.amount !== null && result.amount !== undefined ? result.amount.toString() : '');
      setCategory(result.category || 'Others');
      setDate(result.date || new Date().toISOString().split('T')[0]);
      setTime(result.time || '');
      setTax(result.tax !== null && result.tax !== undefined ? result.tax.toString() : '');
      setPaymentMethod(result.paymentMethod || 'Cash');
      setNotes(result.notes || '');
    }
  }, [result]);

  const categories = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Others'];
  const paymentMethods = ['Cash', 'Card', 'UPI', 'Bank Transfer'];

  const confidence = result?.confidence || {};

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    onSave({
      merchant,
      amount: parseFloat(amount),
      category,
      date,
      time,
      tax: tax ? parseFloat(tax) : 0,
      paymentMethod,
      notes,
      description: merchant 
        ? `${merchant}${notes ? ' - ' + notes : ''}`
        : (notes || 'Scanned Receipt')
    });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 11000 }}>
      <div 
        className="glass-card modal-container receipt-preview-card"
        style={{
          width: '95%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '24px',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--shadow-lg)',
          padding: '24px',
          animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>AI Receipt Extraction ✨</span>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)' }}>Verify Details 🧾</h2>
          </div>
          <button 
            onClick={onCancel}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}
            title="Cancel"
          >
            <X size={24} />
          </button>
        </div>

        {/* Global low-confidence banner if any main field is low confidence */}
        {Object.values(confidence).includes(false) && (
          <div 
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              borderLeft: '4px solid var(--warning)',
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--warning-text)', lineHeight: '1.4' }}>
              Achu highlighted fields in yellow below. Please double-check them before saving.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Merchant Name */}
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Merchant Name</span>
              {confidence.merchant === false && (
                <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <AlertTriangle size={10} /> Verify
                </span>
              )}
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                className="form-control"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. Starbucks, Walmart"
                style={{ 
                  paddingLeft: '40px',
                  borderColor: confidence.merchant === false ? 'var(--warning)' : 'var(--card-border)',
                  background: confidence.merchant === false ? 'rgba(245, 158, 11, 0.04)' : ''
                }}
              />
            </div>
          </div>

          {/* Row for Amount and Tax */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Amount (₹)</span>
                {confidence.amount === false && (
                  <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <AlertTriangle size={10} /> Verify
                  </span>
                )}
              </label>
              <input 
                type="number"
                step="0.01"
                className="form-control"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                style={{ 
                  borderColor: confidence.amount === false ? 'var(--warning)' : 'var(--card-border)',
                  background: confidence.amount === false ? 'rgba(245, 158, 11, 0.04)' : ''
                }}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Tax (₹)</span>
                {confidence.tax === false && (
                  <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <AlertTriangle size={10} /> Verify
                  </span>
                )}
              </label>
              <input 
                type="number"
                step="0.01"
                className="form-control"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                placeholder="0.00"
                style={{ 
                  borderColor: confidence.tax === false ? 'var(--warning)' : 'var(--card-border)',
                  background: confidence.tax === false ? 'rgba(245, 158, 11, 0.04)' : ''
                }}
              />
            </div>
          </div>

          {/* Row for Date and Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Date</span>
                {confidence.date === false && (
                  <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <AlertTriangle size={10} /> Verify
                  </span>
                )}
              </label>
              <div style={{ position: 'relative' }}>
                <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="date"
                  className="form-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  style={{ 
                    paddingLeft: '36px',
                    borderColor: confidence.date === false ? 'var(--warning)' : 'var(--card-border)',
                    background: confidence.date === false ? 'rgba(245, 158, 11, 0.04)' : ''
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Time</span>
                {confidence.time === false && (
                  <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <AlertTriangle size={10} /> Verify
                  </span>
                )}
              </label>
              <div style={{ position: 'relative' }}>
                <Clock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="time"
                  className="form-control"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="HH:MM"
                  style={{ 
                    paddingLeft: '36px',
                    borderColor: confidence.time === false ? 'var(--warning)' : 'var(--card-border)',
                    background: confidence.time === false ? 'rgba(245, 158, 11, 0.04)' : ''
                  }}
                />
              </div>
            </div>
          </div>

          {/* Category Suggestion & Manual Override */}
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Category</span>
              <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                ✨ AI Suggested
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <Tag size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <select 
                className="form-control"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ paddingLeft: '40px' }}
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method */}
          <div className="form-group">
            <label>Payment Method</label>
            <div style={{ position: 'relative' }}>
              <CreditCard size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <select 
                className="form-control"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ paddingLeft: '40px' }}
              >
                {paymentMethods.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label>Notes / Description</label>
            <div style={{ position: 'relative' }}>
              <FileText size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                className="form-control"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Milk, Eggs, Weekly grocery run"
                style={{ paddingLeft: '40px' }}
              />
            </div>
          </div>

          {/* Buttons Actions */}
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px', 
              marginTop: '16px' 
            }}
          >
            <button 
              type="submit" 
              className="glow-btn"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', borderRadius: '14px', fontSize: '15px' }}
            >
              <Check size={18} />
              <span>Save Expense</span>
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                type="button" 
                onClick={onScanAgain}
                className="outline-btn"
                style={{ justifyContent: 'center', padding: '12px', borderRadius: '12px', fontSize: '14px' }}
              >
                <RotateCcw size={16} />
                <span>Scan Again</span>
              </button>
              <button 
                type="button" 
                onClick={onCancel}
                className="outline-btn"
                style={{ justifyContent: 'center', padding: '12px', borderRadius: '12px', fontSize: '14px', borderColor: 'var(--error)', color: 'var(--error)' }}
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
