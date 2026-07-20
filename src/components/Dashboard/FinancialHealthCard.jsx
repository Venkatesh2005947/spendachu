import React from 'react';
import { HeartPulse, Activity, AlertCircle, ChevronRight, CheckCircle2, Info } from 'lucide-react';

export default function FinancialHealthCard({ healthData, loading, error, onOpenDetails }) {
  const getLevelColor = (level) => {
    switch (level) {
      case 'Excellent': return 'var(--success)';
      case 'Very Good': return '#06b6d4'; // Cyan
      case 'Good': return 'var(--accent-primary)';
      case 'Fair': return 'var(--warning)';
      case 'Needs Attention':
      default: return 'var(--danger)';
    }
  };

  const getLevelBadgeStyle = (level) => {
    const color = getLevelColor(level);
    return {
      background: `${color}1a`,
      color: color,
      border: `1px solid ${color}40`
    };
  };

  // SVG Gauge calculations
  const score = healthData?.totalScore || 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const levelColor = getLevelColor(healthData?.level);

  return (
    <div 
      className="glass-card" 
      style={{ 
        padding: '24px', 
        borderRadius: '24px', 
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '10px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HeartPulse size={22} style={{ color: 'var(--danger)' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Financial Health Score 🩺
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Backend-evaluated financial wellness indicator</p>
          </div>
        </div>

        {healthData?.hasEnoughData && (
          <button 
            onClick={onOpenDetails} 
            className="outline-btn"
            style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '12px' }}
          >
            <span>View Full Breakdown</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="scanning-spinner" style={{ width: '30px', height: '30px', border: '3px solid var(--card-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }}></div>
          <span style={{ fontSize: '13.5px', fontWeight: '700' }}>Evaluating financial health metrics...</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div style={{ padding: '20px', background: 'var(--danger-bg)', borderRadius: '16px', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '13px' }}>
          <AlertCircle size={18} style={{ marginBottom: '6px' }} />
          <div>{error}</div>
        </div>
      )}

      {/* Insufficient Data State */}
      {!loading && !error && healthData && !healthData.hasEnoughData && (
        <div style={{ padding: '24px', background: 'var(--bg-secondary)', borderRadius: '18px', border: '1px dashed var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--warning-bg)', padding: '8px', borderRadius: '10px', color: 'var(--warning)', display: 'flex' }}>
              <Info size={20} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>More Activity Needed</h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {healthData.message}
              </p>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg)', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--card-border)', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Requirements To Unlock Score:
            </span>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {healthData.missingData?.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Sufficient Data State */}
      {!loading && !error && healthData && healthData.hasEnoughData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'center' }}>
          {/* Left: Score Circle & Level */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'var(--bg-secondary)', padding: '20px 24px', borderRadius: '20px', border: '1px solid var(--card-border)' }}>
            <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="var(--card-border)"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={levelColor}
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <span style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)', lineHeight: '1', display: 'block' }}>
                  {score}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>/ 100</span>
              </div>
            </div>

            <div>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: '900', 
                padding: '4px 10px', 
                borderRadius: '20px', 
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'inline-block',
                marginBottom: '8px',
                ...getLevelBadgeStyle(healthData.level)
              }}>
                {healthData.level}
              </span>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Overall Financial Health
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Based on your monthly cashflow & habits
              </p>
            </div>
          </div>

          {/* Right: Component Mini Progress Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ComponentBar 
              label="Budget Control" 
              score={healthData.components.budgetControl.score} 
              max={healthData.components.budgetControl.maxPoints} 
              color="var(--accent-primary)"
            />
            <ComponentBar 
              label="Savings Habit" 
              score={healthData.components.savingsHabit.score} 
              max={healthData.components.savingsHabit.maxPoints} 
              color="var(--success)"
            />
            <ComponentBar 
              label="Spending Control" 
              score={healthData.components.spendingControl.score} 
              max={healthData.components.spendingControl.maxPoints} 
              color="#06b6d4"
            />
            <ComponentBar 
              label="Financial Goal Progress" 
              score={healthData.components.goalProgress.score} 
              max={healthData.components.goalProgress.maxPoints} 
              color="#a855f7"
              note={!healthData.components.goalProgress.configured ? 'Normalized (No goals set)' : null}
            />
            <ComponentBar 
              label="Tracking Consistency" 
              score={healthData.components.trackingConsistency.score} 
              max={healthData.components.trackingConsistency.maxPoints} 
              color="var(--warning)"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ComponentBar({ label, score, max, color, note }) {
  const percent = Math.min((score / max) * 100, 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', marginBottom: '4px' }}>
        <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {label}
          {note && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>({note})</span>}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>{score} / {max} pts</span>
      </div>
      <div style={{ height: '7px', background: 'var(--bg-secondary)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: '99px', transition: 'width 0.5s ease' }}></div>
      </div>
    </div>
  );
}
