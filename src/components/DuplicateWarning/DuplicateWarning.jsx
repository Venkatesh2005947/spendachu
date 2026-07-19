import React from 'react';
import { AlertTriangle, AlertCircle, X, Eye, PlusCircle } from 'lucide-react';

/**
 * DuplicateWarning
 * Shown when the backend detects a possible or exact duplicate expense.
 *
 * Props:
 *   confidence    – 'exact' | 'possible'
 *   existing      – { merchant, amount, date, time, category, paymentMethod }
 *   onCancel      – () => void
 *   onAddAnyway   – () => void
 *   onViewExisting– () => void
 */
export default function DuplicateWarning({ confidence, existing, onCancel, onAddAnyway, onViewExisting }) {
  const isExact = confidence === 'exact';

  const formatDate = (d) => {
    if (!d) return '—';
    const [year, month, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
  };

  const formatAmount = (amt) => {
    const num = parseFloat(amt);
    return isNaN(num) ? '—' : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 13000 }}
      role="alertdialog"
      aria-modal="true"
      aria-label="Duplicate expense warning"
    >
      <div
        className="glass-card"
        style={{
          width: '95%',
          maxWidth: '440px',
          borderRadius: '24px',
          border: `1px solid ${isExact ? 'var(--error)' : 'var(--warning)'}`,
          boxShadow: 'var(--shadow-lg)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          animation: 'scaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: isExact ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isExact
                ? <AlertCircle size={22} color="var(--error)" />
                : <AlertTriangle size={22} color="var(--warning)" />
              }
            </div>
            <div>
              <span style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: isExact ? 'var(--error)' : 'var(--warning)',
                marginBottom: '2px'
              }}>
                {isExact ? '🔁 Exact Duplicate' : '⚠️ Possible Duplicate'}
              </span>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>
                Already recorded?
              </h2>
            </div>
          </div>
          <button
            id="duplicate-warning-close"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Existing expense details */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            border: '1px solid var(--card-border)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Existing Expense
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Merchant */}
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Merchant</span>
              <p style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                {existing?.merchant || '—'}
              </p>
            </div>
            {/* Amount */}
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Amount</span>
              <p style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: '800', color: 'var(--accent-primary)' }}>
                {formatAmount(existing?.amount)}
              </p>
            </div>
            {/* Date */}
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Date</span>
              <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {formatDate(existing?.date)}
              </p>
            </div>
            {/* Time (only when available) */}
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Time</span>
              <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {existing?.time || '—'}
              </p>
            </div>
          </div>

          {/* Category pill */}
          {existing?.category && (
            <span style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: '800',
              padding: '4px 10px',
              borderRadius: '99px',
              background: 'var(--accent-primary)',
              color: '#fff',
              width: 'fit-content',
              marginTop: '2px'
            }}>
              {existing.category}
            </span>
          )}
        </div>

        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.55', textAlign: 'center' }}>
          {isExact
            ? 'This looks like the same expense you already saved. Do you want to add it again?'
            : 'This might be a duplicate. Check the existing record before saving again.'
          }
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* View Existing */}
          <button
            id="duplicate-view-existing-btn"
            type="button"
            onClick={onViewExisting}
            className="outline-btn"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', borderRadius: '14px', fontSize: '14px', fontWeight: '700' }}
          >
            <Eye size={16} />
            <span>View Existing Expense</span>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Cancel */}
            <button
              id="duplicate-cancel-btn"
              type="button"
              onClick={onCancel}
              className="outline-btn"
              style={{ justifyContent: 'center', padding: '12px', borderRadius: '14px', fontSize: '14px', fontWeight: '700' }}
            >
              <X size={15} />
              <span>Cancel</span>
            </button>
            {/* Add Anyway */}
            <button
              id="duplicate-add-anyway-btn"
              type="button"
              onClick={onAddAnyway}
              className="glow-btn"
              style={{ justifyContent: 'center', padding: '12px', borderRadius: '14px', fontSize: '14px', fontWeight: '700' }}
            >
              <PlusCircle size={15} />
              <span>Add Anyway</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
