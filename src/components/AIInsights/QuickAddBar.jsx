import React, { useState } from 'react';
import { Sparkles, Check, X, CreditCard, Calendar, Tag, FileText, IndianRupee } from 'lucide-react';
import { aiService } from '../../services/ai';

export default function QuickAddBar({ onAddExpense }) {
  const [inputText, setInputText] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);
  const [error, setError] = useState('');

  const handleProcessText = (e) => {
    e.preventDefault();
    setError('');
    
    if (!inputText.trim()) {
      setError('Please type something first!');
      return;
    }

    const parsed = aiService.parseNaturalLanguageExpense(inputText);
    if (!parsed || parsed.amount === null) {
      setError("We couldn't detect an amount. Please specify a number (e.g. 'Spent 500 for dinner').");
      setParsedPreview(null);
      return;
    }

    setParsedPreview(parsed);
  };

  const handleConfirm = async () => {
    if (!parsedPreview) return;

    try {
      await onAddExpense({
        amount: parsedPreview.amount,
        description: parsedPreview.description,
        category: parsedPreview.category,
        date: parsedPreview.date,
        paymentMethod: parsedPreview.paymentMethod
      });
      
      // Reset input state
      setInputText('');
      setParsedPreview(null);
    } catch (err) {
      setError('Failed to add expense. Please try again.');
    }
  };

  const handleCancel = () => {
    setParsedPreview(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginBottom: '24px' }}>
      <form onSubmit={handleProcessText} className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', gap: '10px' }}>
        <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}>
          <Sparkles size={20} className="glow-effect" />
        </div>
        
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="AI Quick-Add: Type 'Spent 300 for pizza today by Card' and press Enter..."
          disabled={!!parsedPreview}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '14px',
            padding: '10px 0'
          }}
        />
        
        {!parsedPreview ? (
          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}
          >
            Process
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCancel}
            className="btn-secondary"
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={14} /> Clear
          </button>
        )}
      </form>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '13px', paddingLeft: '12px' }}>
          ⚠️ {error}
        </div>
      )}

      {parsedPreview && (
        <div className="glass-card glow-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(99, 102, 241, 0.03)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>
              🤖 AI Preview Details
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleConfirm}
                className="btn-primary"
                style={{ background: 'var(--success)', color: 'white', padding: '6px 14px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', border: 'none' }}
              >
                <Check size={14} /> Confirm & Add
              </button>
              <button
                onClick={handleCancel}
                className="btn-secondary"
                style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
              >
                Cancel
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IndianRupee size={16} style={{ color: 'var(--success)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Amount</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>₹{parsedPreview.amount}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} style={{ color: 'var(--accent-primary)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Description</span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{parsedPreview.description}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={16} style={{ color: 'var(--warning)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Category</span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{parsedPreview.category}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Date</span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{parsedPreview.date}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={16} style={{ color: 'var(--info)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Payment Method</span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{parsedPreview.paymentMethod}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
