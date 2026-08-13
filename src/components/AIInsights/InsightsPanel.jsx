import React, { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, Lightbulb, TrendingUp, TrendingDown, Minus, Info, Calendar, PiggyBank, Star } from 'lucide-react';
import { aiService } from '../../services/ai';

export default function InsightsPanel({ expenses, budgets, savings }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  const insights    = aiService.generateInsights(expenses, budgets);
  const trend       = aiService.getSpendingTrend(expenses);
  const savingsRate = aiService.getSavingsRate(expenses, savings);
  const dowPattern  = aiService.getDayOfWeekPattern(expenses);
  const merchants   = aiService.getTopMerchants(expenses);

  const hasExpenses = expenses && expenses.length > 0;

  /* ── helpers ─────────────────────────────────────────── */
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const TrendIcon = trend.trend === 'Rising' ? TrendingUp : trend.trend === 'Falling' ? TrendingDown : Minus;
  const trendColor = trend.trend === 'Rising' ? 'var(--danger)' : trend.trend === 'Falling' ? 'var(--success)' : 'var(--warning)';

  const ringDeg = Math.min(savingsRate.rate, 100) * 3.6; // 0–360

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ══════ CARD 1 — AI Summary ══════ */}
      <div className="glass-card insights-summary-card" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
        {/* ambient glow */}
        <div style={{ position: 'absolute', right: '-60px', top: '-60px', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div style={{ padding: '9px', background: 'rgba(99,102,241,0.15)', borderRadius: '12px', color: '#818cf8', display: 'flex' }}>
            <Sparkles size={20} />
          </div>
          <h2 style={{ fontSize: '19px', fontWeight: '800', margin: 0 }}>AI Advisor Summary</h2>
        </div>

        <p style={{ fontSize: '15px', lineHeight: '1.7', color: 'var(--text-primary)', marginBottom: '20px' }}>
          {insights.summary}
        </p>

        {/* Month comparison pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div className="insight-pill" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>This Month</span>
            <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>{fmt(insights.thisMonthTotal)}</span>
          </div>
          <div className="insight-pill" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Last Month</span>
            <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>{fmt(insights.lastMonthTotal)}</span>
          </div>
          {insights.lastMonthTotal > 0 && (
            <div className="insight-pill" style={{ background: insights.percentChange > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${insights.percentChange > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Change</span>
              <span style={{ fontSize: '17px', fontWeight: '800', color: insights.percentChange > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {insights.percentChange > 0 ? '▲' : '▼'} {Math.abs(insights.percentChange).toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <TrendingUp size={14} style={{ color: '#818cf8' }} />
          <span>{insights.comparisonText}</span>
        </div>
      </div>

      {/* ══════ CARDS 2+3 — Trend & Savings Rate (side by side on desktop) ══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>

        {/* ── CARD 2 — 7-Day Spending Trend ── */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ padding: '8px', background: `${trendColor}22`, borderRadius: '10px', color: trendColor, display: 'flex' }}>
              <TrendIcon size={18} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>7-Day Spending Trend</h3>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last 7 Days</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>{fmt(trend.last7Total)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prior 7 Days</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>{fmt(trend.prior7Total)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', borderRadius: '12px', background: `${trendColor}11`, border: `1px solid ${trendColor}33` }}>
            <TrendIcon size={20} style={{ color: trendColor }} />
            <span style={{ fontWeight: '800', fontSize: '15px', color: trendColor }}>{trend.trend}</span>
            {trend.prior7Total > 0 && (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                ({trend.delta > 0 ? '+' : ''}{trend.delta.toFixed(0)}% vs prior week)
              </span>
            )}
          </div>

          {!hasExpenses && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '10px' }}>No data yet — start logging expenses!</p>
          )}
        </div>

        {/* ── CARD 3 — Savings Rate Ring ── */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ padding: '8px', background: 'rgba(34,197,94,0.12)', borderRadius: '10px', color: 'var(--success)', display: 'flex' }}>
              <PiggyBank size={18} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Savings Rate</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Ring gauge */}
            <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0 }}>
              <div style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: `conic-gradient(${savingsRate.statusColor} 0deg, ${savingsRate.statusColor} ${animated ? ringDeg : 0}deg, var(--card-border) ${animated ? ringDeg : 0}deg 360deg)`,
                transition: 'background 1s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <span style={{ fontSize: '16px', fontWeight: '900', color: savingsRate.statusColor, lineHeight: 1 }}>{savingsRate.rate.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: savingsRate.statusColor, marginBottom: '10px', padding: '4px 10px', background: `${savingsRate.statusColor}18`, borderRadius: '20px', display: 'inline-block' }}>
                {savingsRate.status}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Saved</span>
                  <span style={{ fontWeight: '700', color: 'var(--success)' }}>{fmt(savingsRate.totalSaved)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Spent</span>
                  <span style={{ fontWeight: '700', color: 'var(--danger)' }}>{fmt(savingsRate.totalSpent)}</span>
                </div>
              </div>
            </div>
          </div>

          {savingsRate.rate < 15 && (
            <div style={{ marginTop: '14px', fontSize: '12.5px', color: 'var(--text-secondary)', padding: '10px', background: 'rgba(234,179,8,0.08)', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.2)' }}>
              💡 Try the <strong>50/30/20 rule</strong>: 50% needs, 30% wants, 20% savings!
            </div>
          )}
        </div>
      </div>

      {/* ══════ CARD 4 — Day-of-Week Pattern ══════ */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ padding: '8px', background: 'rgba(168,85,247,0.12)', borderRadius: '10px', color: '#a855f7', display: 'flex' }}>
            <Calendar size={18} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Day-of-Week Spending</h3>
          {hasExpenses && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', padding: '4px 10px', background: 'rgba(168,85,247,0.12)', color: '#a855f7', borderRadius: '20px', fontWeight: '700' }}>
              Peak: {dowPattern.peakDay}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '100px' }}>
          {dowPattern.days.map((day, i) => {
            const pct = dowPattern.maxVal > 0 ? (dowPattern.totals[i] / dowPattern.maxVal) * 100 : 0;
            const isPeak = dowPattern.totals[i] === Math.max(...dowPattern.totals) && dowPattern.totals[i] > 0;
            return (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '72px' }}>
                  <div
                    title={`${day}: ${fmt(dowPattern.totals[i])}`}
                    style={{
                      width: '100%', maxWidth: '36px',
                      height: animated ? `${Math.max(pct, 4)}%` : '4%',
                      background: isPeak ? 'linear-gradient(180deg, #a855f7, #7c3aed)' : 'var(--accent-primary)',
                      borderRadius: '6px 6px 2px 2px',
                      transition: 'height 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                      opacity: pct === 0 ? 0.2 : 1,
                      cursor: 'default'
                    }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: isPeak ? '#a855f7' : 'var(--text-secondary)', fontWeight: isPeak ? '800' : '500' }}>{day}</span>
              </div>
            );
          })}
        </div>

        {!hasExpenses && (
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '10px' }}>Log expenses to see your weekly spending pattern.</p>
        )}
      </div>

      {/* ══════ CARDS 5+6 side-by-side ══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>

        {/* ── CARD 5 — Budget Alarms ── */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '10px', color: 'var(--danger)', display: 'flex' }}>
              <AlertTriangle size={18} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Budget Alarms</h3>
          </div>

          {!insights.hasAlerts ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'rgba(34,197,94,0.08)', borderRadius: '10px', color: 'var(--success)', fontSize: '13.5px', border: '1px solid rgba(34,197,94,0.2)' }}>
              <Info size={16} />
              <span>All budgets are healthy! No overruns detected. 🎉</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {insights.alerts.map((alert, i) => (
                <div key={i} className={`alert-pill ${alert.type}`} style={{ fontSize: '13px' }}>
                  <AlertTriangle size={16} style={{ color: alert.type === 'danger' ? 'var(--danger)' : 'var(--warning)', flexShrink: 0 }} />
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── CARD 6 — Smart Recommendations ── */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ padding: '8px', background: 'rgba(234,179,8,0.1)', borderRadius: '10px', color: 'var(--warning)', display: 'flex' }}>
              <Lightbulb size={18} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Smart Recommendations</h3>
          </div>

          <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', listStyle: 'none', padding: 0, margin: 0 }}>
            {insights.tips.map((tip, i) => (
              <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '13.5px', lineHeight: '1.55', alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(234,179,8,0.05)', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.15)' }}>
                <Star size={14} style={{ color: 'var(--warning)', marginTop: '2px', flexShrink: 0 }} />
                <span dangerouslySetInnerHTML={{ __html: tip.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^💡 /, '') }} />
              </li>
            ))}
            {/* Extra tip based on savings rate */}
            {savingsRate.rate < 10 && (
              <li style={{ display: 'flex', gap: '10px', fontSize: '13.5px', lineHeight: '1.55', alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(234,179,8,0.05)', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.15)' }}>
                <Star size={14} style={{ color: 'var(--warning)', marginTop: '2px', flexShrink: 0 }} />
                <span>Your savings rate is very low! Try automating a small deposit to savings every payday. 💰</span>
              </li>
            )}
            {/* Extra tip for weekend heavy spenders */}
            {(dowPattern.peakDay === 'Sat' || dowPattern.peakDay === 'Sun') && hasExpenses && (
              <li style={{ display: 'flex', gap: '10px', fontSize: '13.5px', lineHeight: '1.55', alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(234,179,8,0.05)', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.15)' }}>
                <Star size={14} style={{ color: 'var(--warning)', marginTop: '2px', flexShrink: 0 }} />
                <span>You spend the most on <strong>weekends</strong>! Plan free or low-cost activities to reduce impulse buys. 🌳</span>
              </li>
            )}
          </ul>
        </div>
      </div>

    </div>
  );
}
