import React from 'react';
import { X, Award, Sparkles, Check } from 'lucide-react';

export default function GoalCompletedModal({ goal, onClose }) {
  if (!goal) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 12100 }}>
      <div 
        className="glass-card modal-container" 
        style={{ 
          maxWidth: '440px', 
          textAlign: 'center', 
          border: '2px solid var(--success)',
          boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)',
          padding: '36px 30px',
          animation: 'scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-20px', marginRight: '-15px' }}>
          <button 
            className="close-btn" 
            onClick={onClose} 
            aria-label="Close"
            style={{ width: '28px', height: '28px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Big Celebration Icon */}
        <div 
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            position: 'relative'
          }}
        >
          <Award size={42} style={{ color: 'var(--success)' }} />
          <Sparkles 
            size={18} 
            style={{ 
              color: 'var(--accent-primary)', 
              position: 'absolute', 
              top: '5px', 
              right: '5px',
              animation: 'pulse 1.5s infinite' 
            }} 
          />
        </div>

        <span style={{ 
          fontSize: '11px', 
          fontWeight: '900', 
          color: 'var(--success)', 
          textTransform: 'uppercase', 
          letterSpacing: '1.5px',
          display: 'block',
          marginBottom: '8px'
        }}>
          Goal Achieved! 🎉
        </span>
        
        <h2 style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)', margin: '0 0 12px 0', lineHeight: '1.2' }}>
          Congratulations!
        </h2>

        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 auto 24px auto', maxWidth: '320px' }}>
          You have successfully reached your target for <strong style={{ color: 'var(--text-primary)' }}>{goal.name}</strong> by saving <strong style={{ color: 'var(--success)' }}>₹{goal.targetAmount?.toLocaleString('en-IN')}</strong>!
        </p>

        <div 
          style={{ 
            background: 'var(--bg-secondary)', 
            padding: '16px', 
            borderRadius: '16px', 
            border: '1px solid var(--card-border)',
            marginBottom: '24px'
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
            Final Status
          </span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--success)', fontWeight: '800', fontSize: '18px' }}>
            <Check size={18} />
            <span>₹{goal.savedAmount?.toLocaleString('en-IN')} Saved</span>
          </div>
        </div>

        <button 
          onClick={onClose} 
          className="glow-btn"
          style={{ 
            width: '100%', 
            justifyContent: 'center', 
            background: 'var(--success)',
            padding: '14px',
            fontSize: '15px'
          }}
        >
          <span>Sema! Let's Celebrate 🥳</span>
        </button>
      </div>
    </div>
  );
}
