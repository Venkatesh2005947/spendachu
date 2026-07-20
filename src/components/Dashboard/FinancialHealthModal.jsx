import React, { useState, useEffect } from 'react';
import { X, HeartPulse, ShieldCheck, TrendingUp, Target, Calendar, Lightbulb, Activity, ChevronRight } from 'lucide-react';
import { dbService } from '../../services/db';

export default function FinancialHealthModal({ healthData, onClose }) {
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchHistory() {
      try {
        setHistoryLoading(true);
        const data = await dbService.getFinancialHealthHistory();
        if (isMounted) setHistory(data || []);
      } catch (err) {
        console.error('Failed to load score history:', err);
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    }
    fetchHistory();
    return () => { isMounted = false; };
  }, []);

  const getLevelColor = (level) => {
    switch (level) {
      case 'Excellent': return 'var(--success)';
      case 'Very Good': return '#06b6d4';
      case 'Good': return 'var(--accent-primary)';
      case 'Fair': return 'var(--warning)';
      case 'Needs Attention':
      default: return 'var(--danger)';
    }
  };

  const levelColor = getLevelColor(healthData?.level);

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justify: 'center',
        padding: '20px'
      }}
    >
      <div 
        className="glass-card" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '750px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '24px',
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          padding: '28px'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '10px', borderRadius: '14px', color: 'var(--danger)' }}>
              <HeartPulse size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>
                Financial Health Details 🩺
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                In-depth breakdown of your score, component formulas & history
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="outline-btn"
            style={{ padding: '8px', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Score Banner */}
        <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '20px', border: '1px solid var(--card-border)', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Current Overall Score
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '48px', fontWeight: '900', lineHeight: '1', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {healthData?.totalScore || 0}
              </span>
              <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-muted)' }}>/ 100</span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: '900', 
              padding: '6px 14px', 
              borderRadius: '20px', 
              background: `${levelColor}1a`,
              color: levelColor,
              border: `1px solid ${levelColor}40`,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'inline-block',
              marginBottom: '6px'
            }}>
              {healthData?.level || 'Needs Attention'}
            </span>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>
              Snapshot Date: {healthData?.snapshotDate || 'Today'}
            </div>
          </div>
        </div>

        {/* 1. Component Detailed Breakdown */}
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
          <span>Weighted Component Breakdown</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
          <DetailComponentCard 
            title="Budget Control (Max 30 Pts)" 
            score={healthData?.components.budgetControl.score} 
            max={30}
            color="var(--accent-primary)"
            explanation="Evaluates how well you stick to your monthly budget limit. Full points if <=70% of budget used."
            details={healthData?.components.budgetControl.details}
          />
          <DetailComponentCard 
            title="Savings Habit (Max 25 Pts)" 
            score={healthData?.components.savingsHabit.score} 
            max={25}
            color="var(--success)"
            explanation="Calculated from your net savings rate: (Savings / Cashflow) * 100. Target is >=30% savings rate."
            details={healthData?.components.savingsHabit.details}
          />
          <DetailComponentCard 
            title="Spending Control (Max 20 Pts)" 
            score={healthData?.components.spendingControl.score} 
            max={20}
            color="#06b6d4"
            explanation="Evaluates large single transaction surges, month-to-month spending spikes, and duplicate expense entries."
            details={healthData?.components.spendingControl.details}
          />
          <DetailComponentCard 
            title="Financial Goal Progress (Max 15 Pts)" 
            score={healthData?.components.goalProgress.score} 
            max={15}
            color="#a855f7"
            explanation={healthData?.components.goalProgress.configured ? "Evaluates active goals, target progress, deadline health, and completed goals." : "Normalized: No financial goals configured. Total score scaled out of 85 points to avoid penalty."}
            details={healthData?.components.goalProgress.details}
          />
          <DetailComponentCard 
            title="Tracking Consistency (Max 10 Pts)" 
            score={healthData?.components.trackingConsistency.score} 
            max={10}
            color="var(--warning)"
            explanation="Evaluates active tracking days in the last 30 days and checks for long untracked gaps."
            details={healthData?.components.trackingConsistency.details}
          />
        </div>

        {/* 2. Score History Trend Chart */}
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={18} style={{ color: 'var(--success)' }} />
          <span>Score History & Trends</span>
        </h3>

        <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '18px', border: '1px solid var(--card-border)', marginBottom: '28px' }}>
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Loading score history...
            </div>
          ) : history.length <= 1 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
              📅 Score snapshot recorded for period <strong>{healthData?.periodKey}</strong>. Keep tracking over time to build your score history chart!
            </div>
          ) : (
            <ScoreHistoryChart history={history} />
          )}
        </div>

        {/* 3. Actionable Rule-Based Recommendations */}
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lightbulb size={18} style={{ color: 'var(--warning)' }} />
          <span>Actionable Personalised Recommendations</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {healthData?.suggestions?.map((rec, i) => (
            <div 
              key={i} 
              style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '12px', 
                padding: '14px 16px', 
                background: 'var(--bg-secondary)', 
                borderRadius: '14px', 
                border: '1px solid var(--card-border)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                lineHeight: '1.5'
              }}
            >
              <div style={{ background: 'var(--warning-bg)', padding: '6px', borderRadius: '8px', color: 'var(--warning)', display: 'flex', flexShrink: 0, marginTop: '2px' }}>
                <Lightbulb size={16} />
              </div>
              <div>{rec}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailComponentCard({ title, score, max, color, explanation, details }) {
  const percent = Math.min(((score || 0) / max) * 100, 100);
  return (
    <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ fontSize: '14px', fontWeight: '900', color: color }}>{score || 0} / {max} Pts</span>
      </div>

      <div style={{ height: '8px', background: 'var(--card-bg)', borderRadius: '99px', overflow: 'hidden', marginBottom: '10px' }}>
        <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: '99px', transition: 'width 0.5s ease' }}></div>
      </div>

      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
        {explanation}
      </p>
      {details && (
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '700', marginTop: '4px' }}>
          • {details}
        </div>
      )}
    </div>
  );
}

function ScoreHistoryChart({ history }) {
  const width = 650;
  const height = 140;
  const padding = 30;

  const scores = history.map(h => h.totalScore);
  const minScore = 0;
  const maxScore = 100;

  const points = history.map((h, index) => {
    const x = padding + (index / (history.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((h.totalScore - minScore) / (maxScore - minScore)) * (height - 2 * padding);
    return { x, y, score: h.totalScore, periodKey: h.periodKey };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Horizontal reference lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--card-border)" strokeDasharray="3 3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="var(--card-border)" strokeDasharray="3 3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--card-border)" strokeDasharray="3 3" />

        {/* Trend Polyline */}
        <polyline
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth="3"
          points={polylinePoints}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="var(--accent-primary)" stroke="var(--card-bg)" strokeWidth="2" />
            <text x={p.x} y={p.y - 10} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="800">
              {p.score}
            </text>
            <text x={p.x} y={height - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="700">
              {p.periodKey}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
