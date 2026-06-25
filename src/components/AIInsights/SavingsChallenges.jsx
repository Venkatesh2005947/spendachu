import React, { useState, useEffect } from 'react';
import { Target, Trophy, Play, Check, RefreshCw, Star, Info } from 'lucide-react';
import { aiService } from '../../services/ai';

export default function SavingsChallenges({ expenses, onAddSaving }) {
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [badges, setBadges] = useState([]);
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    // Load active challenge from localStorage
    const savedChallenge = localStorage.getItem('spendachu_active_challenge');
    if (savedChallenge) {
      setActiveChallenge(JSON.parse(savedChallenge));
    }

    // Load badges
    const savedBadges = localStorage.getItem('spendachu_badges');
    if (savedBadges) {
      setBadges(JSON.parse(savedBadges));
    }
  }, []);

  useEffect(() => {
    setChallenges(aiService.getSavingsChallenges(expenses));
  }, [expenses]);

  const handleStartChallenge = (challenge) => {
    const newActive = {
      ...challenge,
      startDate: new Date().toISOString(),
      currentSpend: 0
    };
    localStorage.setItem('spendachu_active_challenge', JSON.stringify(newActive));
    setActiveChallenge(newActive);
  };

  const handleAbandon = () => {
    localStorage.removeItem('spendachu_active_challenge');
    setActiveChallenge(null);
  };

  // Calculate current progress of the active challenge
  const getChallengeProgress = () => {
    if (!activeChallenge) return null;

    const startDate = new Date(activeChallenge.startDate);
    const now = new Date();
    
    // Calculate days elapsed
    const diffTime = Math.abs(now - startDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, activeChallenge.targetDays - diffDays);

    // Calculate expenses in the challenge category since start date
    const challengeExpenses = expenses.filter(e => {
      const expDate = new Date(e.date);
      return e.category === activeChallenge.category && expDate >= startDate;
    });

    const totalSpent = challengeExpenses.reduce((sum, e) => sum + e.amount, 0);
    const failed = totalSpent > 0;
    const completed = diffDays >= activeChallenge.targetDays && !failed;

    return {
      daysElapsed: diffDays,
      daysLeft,
      totalSpent,
      failed,
      completed
    };
  };

  const progress = getChallengeProgress();

  const handleClaimReward = async () => {
    if (!activeChallenge) return;

    // Add badge
    const newBadges = [...badges, activeChallenge.rewardBadge];
    localStorage.setItem('spendachu_badges', JSON.stringify(newBadges));
    setBadges(newBadges);

    // Automatically add reward savings to their Savings Goal
    try {
      await onAddSaving({
        amount: activeChallenge.targetSavings,
        description: `Completed AI Challenge: ${activeChallenge.title} ${activeChallenge.rewardBadge}`
      });
      alert(`Congratulations! You earned the "${activeChallenge.rewardBadge}" badge, and ₹${activeChallenge.targetSavings} was automatically added to your savings! 🎉`);
    } catch (err) {
      console.error("Failed to auto-save challenge reward:", err);
    }

    // Reset challenge
    localStorage.removeItem('spendachu_active_challenge');
    setActiveChallenge(null);
  };

  const handleClearBadges = () => {
    localStorage.removeItem('spendachu_badges');
    setBadges([]);
  };

  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={20} style={{ color: 'var(--accent-primary)' }} />
          <span>AI Savings Challenges</span>
        </h3>
        {badges.length > 0 && (
          <button 
            onClick={handleClearBadges} 
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw size={10} /> Clear Badges
          </button>
        )}
      </div>

      {/* Badges Cabinet */}
      {badges.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Trophy size={12} style={{ color: 'var(--warning)' }} /> Achievement Badges ({badges.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            {badges.map((b, idx) => (
              <span key={idx} className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Star size={12} fill="#f59e0b" /> {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Active Challenge Status */}
      {activeChallenge && progress ? (
        <div className="glass-card glow-card" style={{ padding: '20px', border: progress.failed ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)', background: progress.failed ? 'rgba(239, 68, 68, 0.02)' : 'rgba(16, 185, 129, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span className={`alert-pill ${progress.failed ? 'danger' : 'success'}`} style={{ display: 'inline-flex', fontSize: '10.5px', marginBottom: '8px' }}>
                {progress.failed ? 'FAILED' : progress.completed ? 'COMPLETED' : 'ACTIVE CHALLENGE'}
              </span>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold' }}>{activeChallenge.title}</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{activeChallenge.description}</p>
            </div>
            <button
              onClick={handleAbandon}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Give Up
            </button>
          </div>

          {/* Progress Indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span>Challenge Target: **{activeChallenge.targetDays} Days**</span>
              <span>Time Left: **{progress.daysLeft} Days**</span>
            </div>
            
            {/* Custom styled progress bar */}
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${Math.min(100, ((activeChallenge.targetDays - progress.daysLeft) / activeChallenge.targetDays) * 100)}%`, 
                  height: '100%', 
                  background: progress.failed ? 'var(--danger)' : 'var(--success)',
                  transition: 'width 0.3s' 
                }} 
              />
            </div>
          </div>

          {/* Result Alert Box */}
          {progress.failed ? (
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--danger)' }}>
              😭 **Failed**: You recorded an expense of **₹{progress.totalSpent}** in {activeChallenge.category} during the challenge. You can restart another challenge anytime!
            </div>
          ) : progress.completed ? (
            <button
              onClick={handleClaimReward}
              className="btn-primary"
              style={{ width: '100%', background: 'var(--success)', color: 'white', border: 'none', padding: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Check size={18} /> Claim Badge & Save ₹{activeChallenge.targetSavings}!
            </button>
          ) : (
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--success)' }}>
              💪 **Success So Far**: You have spent **₹0** in {activeChallenge.category}. Keep going for {progress.daysLeft} more days!
            </div>
          )}
        </div>
      ) : (
        /* Challenges Selection List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {challenges.map((c) => (
            <div 
              key={c.id} 
              className="glass-card" 
              style={{ 
                padding: '16px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                gap: '12px',
                border: c.isRecommended ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(255,255,255,0.05)',
                background: c.isRecommended ? 'rgba(99, 102, 241, 0.02)' : 'none'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold' }}>{c.title}</h4>
                  {c.isRecommended && (
                    <span 
                      style={{ 
                        fontSize: '9.5px', 
                        padding: '2px 6px', 
                        background: 'rgba(99, 102, 241, 0.15)', 
                        color: 'var(--accent-primary)', 
                        borderRadius: '10px', 
                        fontWeight: 'bold' 
                      }}
                    >
                      ⭐ AI RECOMMENDED
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{c.description}</p>
                <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  <span>Target: **{c.targetDays} days**</span>
                  <span>Goal: **Save ₹{c.targetSavings}**</span>
                  <span>Reward: **{c.rewardBadge}**</span>
                </div>
              </div>
              <button
                onClick={() => handleStartChallenge(c)}
                className="btn-primary"
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
              >
                <Play size={12} fill="white" /> Start
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
