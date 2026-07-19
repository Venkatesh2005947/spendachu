import React, { useState } from 'react';
import { 
  Trophy, Star, Lock, CheckCircle2, Flame, Award, 
  TrendingUp, Camera, Target, Calendar, PiggyBank, Coins, Sparkles, HelpCircle 
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function AchievementsList({ achievementsData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const { achievements = [], totalPoints = 0 } = achievementsData || {};

  const categories = [
    { id: 'all', label: 'All 🌟' },
    { id: 'expense tracking', label: 'Expenses 💸' },
    { id: 'savings', label: 'Savings 🐷' },
    { id: 'budget', label: 'Budget 📊' },
    { id: 'financial goals', label: 'Goals 🎯' },
    { id: 'consistency', label: 'Streaks ⚡' },
    { id: 'receipt scanning', label: 'Scans 📸' }
  ];

  // Helper to map icon names to Lucide icons
  const getIconComponent = (iconName, unlocked) => {
    const props = { 
      size: 24, 
      style: { 
        color: unlocked ? 'var(--accent-primary)' : 'var(--text-muted)',
        fill: unlocked ? 'var(--accent-primary)' : 'none'
      } 
    };

    switch (iconName) {
      case 'Award': return <Award {...props} />;
      case 'TrendingUp': return <TrendingUp {...props} />;
      case 'Flame': return <Flame {...props} />;
      case 'Camera': return <Camera {...props} />;
      case 'Target': return <Target {...props} />;
      case 'CheckCircle2': return <CheckCircle2 {...props} />;
      case 'Calendar': return <Calendar {...props} />;
      case 'Sparkles': return <Sparkles {...props} />;
      case 'PiggyBank': return <PiggyBank {...props} />;
      case 'Coins': return <Coins {...props} />;
      default: return <Trophy {...props} />;
    }
  };

  const getFilteredAchievements = () => {
    if (activeFilter === 'all') return achievements;
    return achievements.filter(a => a.category.toLowerCase() === activeFilter.toLowerCase());
  };

  const filtered = getFilteredAchievements();
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const progressPercent = achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0;

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(Number(timestamp));
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Overview Card */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '24px 30px', 
          background: 'linear-gradient(135deg, var(--bg-secondary), var(--card-bg))', 
          border: '1px solid var(--border-color)', 
          borderRadius: '24px', 
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px'
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: '900', 
            textTransform: 'uppercase', 
            letterSpacing: '1px', 
            color: 'var(--accent-primary)',
            display: 'block',
            marginBottom: '4px'
          }}>
            Your Milestones 🏆
          </span>
          <h2 style={{ fontSize: '32px', fontWeight: '900', margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
            Achievements Progress
          </h2>
          
          {/* Progress Bar */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '800', marginBottom: '6px' }}>
              <span>{unlockedCount} of {achievements.length} Unlocked</span>
              <span>{progressPercent.toFixed(0)}%</span>
            </div>
            <div style={{ height: '12px', background: 'var(--bg-primary)', borderRadius: '99px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${progressPercent}%`, 
                  backgroundColor: 'var(--accent-primary)', 
                  transition: 'width 0.5s ease' 
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Total Points Display */}
        <div 
          style={{ 
            background: 'rgba(250, 203, 5, 0.12)', 
            border: '2px dashed var(--accent-primary)', 
            padding: '20px 30px', 
            borderRadius: '20px', 
            textAlign: 'center',
            minWidth: '160px',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Total Points
          </span>
          <span style={{ fontSize: '42px', fontWeight: '900', color: 'var(--accent-primary)', fontFamily: 'var(--font-heading)', display: 'block', lineHeight: '1' }}>
            {totalPoints}
          </span>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            PTS EARNED
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', borderBottom: '1px solid var(--card-border)' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveFilter(cat.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              background: activeFilter === cat.id ? 'var(--accent-primary)' : 'transparent',
              color: activeFilter === cat.id ? '#000' : 'var(--text-secondary)',
              fontWeight: '800',
              fontSize: '12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="scanning-spinner" style={{ width: '35px', height: '35px', border: '3px solid var(--card-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }}></div>
          <span style={{ fontSize: '15px', fontWeight: '700' }}>Evaluating milestones...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center', borderRadius: '20px' }}>
          <Trophy size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.4 }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>No Achievements Found</h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>No milestones under this category filter yet.</p>
        </div>
      )}

      {/* Achievements Grid */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '20px' }}>
          {filtered.map(ach => {
            const hasProgress = !ach.unlocked && ach.progress > 0;
            const progressPercent = ach.ruleValue > 0 ? (ach.progress / ach.ruleValue) * 100 : 0;

            return (
              <div 
                key={ach.id} 
                className="glass-card" 
                style={{ 
                  padding: '20px', 
                  borderRadius: '20px', 
                  border: '1px solid var(--border-color)', 
                  display: 'flex', 
                  gap: '16px',
                  alignItems: 'flex-start',
                  position: 'relative',
                  opacity: ach.unlocked ? 1 : 0.72,
                  transition: 'all 0.2s ease',
                  background: ach.unlocked ? 'var(--card-bg)' : 'rgba(30, 41, 59, 0.4)'
                }}
              >
                {/* Icon Column */}
                <div 
                  style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '14px', 
                    background: ach.unlocked ? 'rgba(250, 203, 5, 0.12)' : 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {getIconComponent(ach.icon, ach.unlocked)}
                </div>

                {/* Content Column */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ach.name}
                    </h4>
                    {/* Points Badge */}
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: '900', 
                      color: ach.unlocked ? 'var(--accent-primary)' : 'var(--text-muted)', 
                      background: ach.unlocked ? 'rgba(250, 203, 5, 0.1)' : 'var(--bg-primary)',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      flexShrink: 0
                    }}>
                      +{ach.points} PTS
                    </span>
                  </div>
                  
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {ach.description}
                  </p>

                  {/* Progress Display */}
                  {hasProgress && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>Progress</span>
                        <span>{ach.progress.toLocaleString('en-IN')} / {ach.ruleValue.toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{ height: '5px', background: 'var(--bg-primary)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            width: `${progressPercent}%`, 
                            background: 'var(--text-secondary)',
                            borderRadius: '99px' 
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Unlocked date */}
                  {ach.unlocked && ach.unlockedAt && (
                    <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <CheckCircle2 size={11} />
                      Unlocked on {formatDate(ach.unlockedAt)}
                    </span>
                  )}
                  
                  {/* Locked indicator */}
                  {!ach.unlocked && !hasProgress && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <Lock size={11} />
                      Locked
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
