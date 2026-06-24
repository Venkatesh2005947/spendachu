import React from 'react';
import { Sparkles, AlertTriangle, Lightbulb, TrendingUp, Info } from 'lucide-react';
import { aiService } from '../../services/ai';

export default function InsightsPanel({ expenses, budgets }) {
  const insights = aiService.generateInsights(expenses, budgets);

  const getAlertIcon = (type) => {
    if (type === 'danger') return <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />;
    return <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Primary Summary Header Card */}
      <div className="glass-card" style={{ padding: '28px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative ambient bulb */}
        <div style={{ position: 'absolute', right: '-40px', bottom: '-40px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ padding: '8px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', color: 'var(--success)', display: 'flex', alignItems: 'center' }}>
            <Sparkles size={20} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>AI Advisor Summary</h2>
        </div>

        <p style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-primary)', marginBottom: '18px' }}>
          {insights.summary}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          <TrendingUp size={16} style={{ color: 'var(--accent-primary)' }} />
          <span>{insights.comparisonText}</span>
        </div>
      </div>

      {/* Grid of Alert Logs and Suggestion Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        
        {/* Budget Alarms / Warnings Panel */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
            <span>Budget Notifications & Alarms</span>
          </h3>

          {!insights.hasAlerts ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--success)', fontSize: '13.5px' }}>
              <Info size={16} />
              <span>All budgets are healthy! No overruns or warnings detected.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {insights.alerts.map((alert, index) => (
                <div key={index} className={`alert-pill ${alert.type}`}>
                  {getAlertIcon(alert.type)}
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Savings Suggestions List */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lightbulb size={18} style={{ color: 'var(--warning)' }} />
            <span>Smart Recommendations</span>
          </h3>

          <ul className="insights-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {insights.tips.map((tip, index) => {
              // Highlight the first word if it matches tags
              const isAdvice = tip.startsWith("💡");
              return (
                <li key={index} style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  fontSize: '13.5px', 
                  lineHeight: '1.5',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                    {isAdvice ? null : <span style={{ color: 'var(--accent-primary)', marginRight: '4px' }}>•</span>}
                  </div>
                  <span dangerouslySetInnerHTML={{ __html: tip.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
