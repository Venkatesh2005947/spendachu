import React, { useEffect } from 'react';
import { X, Trophy, Star, Sparkles } from 'lucide-react';

export default function AchievementUnlockModal({ achievements, onClose }) {
  // If no achievements to display, return null
  if (!achievements || achievements.length === 0) return null;

  // We show the first achievement in the queue
  const current = achievements[0];

  return (
    <div className="modal-overlay" style={{ zIndex: 14000 }}>
      <div 
        className="glass-card modal-container" 
        style={{ 
          maxWidth: '420px', 
          textAlign: 'center', 
          border: '2px solid var(--accent-primary)',
          boxShadow: '0 0 30px rgba(250, 203, 5, 0.3)',
          padding: '36px 28px',
          animation: 'scaleUp 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        {/* Close Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-20px', marginRight: '-15px' }}>
          <button 
            className="close-btn" 
            onClick={() => onClose(current.id)} 
            aria-label="Close"
            style={{ width: '28px', height: '28px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Celebration Trophy Icon */}
        <div 
          style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            background: 'rgba(250, 203, 5, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto',
            position: 'relative'
          }}
        >
          <Trophy size={48} style={{ color: 'var(--accent-primary)', animation: 'pulse 2s infinite' }} />
          <Sparkles 
            size={20} 
            style={{ 
              color: 'var(--success)', 
              position: 'absolute', 
              top: '2px', 
              right: '2px',
              animation: 'pulse 1.2s infinite'
            }} 
          />
        </div>

        <span style={{ 
          fontSize: '11px', 
          fontWeight: '900', 
          color: 'var(--accent-primary)', 
          textTransform: 'uppercase', 
          letterSpacing: '2px',
          display: 'block',
          marginBottom: '8px'
        }}>
          Achievement Unlocked! 🏆
        </span>

        <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', margin: '0 0 12px 0', lineHeight: '1.25' }}>
          {current.name}
        </h2>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 auto 24px auto', maxWidth: '300px' }}>
          {current.description}
        </p>

        {/* Points Badge */}
        <div 
          style={{ 
            background: 'var(--bg-secondary)', 
            padding: '16px', 
            borderRadius: '16px', 
            border: '1px solid var(--card-border)',
            marginBottom: '26px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            justifyContent: 'center'
          }}
        >
          <Star size={18} style={{ color: 'var(--accent-primary)', fill: 'var(--accent-primary)' }} />
          <span style={{ fontWeight: '900', fontSize: '18px', color: 'var(--text-primary)' }}>
            +{current.points} Points
          </span>
        </div>

        <button 
          onClick={() => onClose(current.id)} 
          className="glow-btn"
          style={{ 
            width: '100%', 
            justifyContent: 'center', 
            padding: '14px',
            fontSize: '15px'
          }}
        >
          <span>Sema! Continue 🚀</span>
        </button>
      </div>
    </div>
  );
}
