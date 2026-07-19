import React, { useState } from 'react';
import { 
  Target, Plus, Edit2, Trash2, Pause, Play, PiggyBank, Calendar, 
  Tag, AlertCircle, ArrowUpRight, CheckCircle2, ChevronRight, HelpCircle
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

export default function FinancialGoals({ 
  goals, 
  onAddGoal, 
  onUpdateGoal, 
  onDeleteGoal,
  onAddGoalSavings,
  loading
}) {
  const [statusFilter, setStatusFilter] = useState('all');

  const getPriorityColor = (p) => {
    switch (p) {
      case 'high': return 'var(--danger)';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--text-muted)';
      default: return 'var(--text-muted)';
    }
  };

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case 'completed': return { bg: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', label: 'Completed 🎉' };
      case 'paused': return { bg: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', label: 'Paused ⏸️' };
      case 'cancelled': return { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', label: 'Cancelled 🛑' };
      case 'active':
      default:
        return { bg: 'rgba(250, 203, 5, 0.12)', color: 'var(--accent-primary)', label: 'Active 🎯' };
    }
  };

  const calcMonthlySavingRequired = (target, saved, deadlineStr) => {
    if (saved >= target) return 0;
    const deadlineDate = new Date(deadlineStr + 'T23:59:59');
    const today = new Date();
    
    const diffTime = deadlineDate - today;
    if (diffTime <= 0) return target - saved; // Goal deadline passed, full remaining required
    
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.4375);
    const monthsRemaining = Math.max(diffMonths, 0.1);
    
    return (target - saved) / monthsRemaining;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const filteredGoals = goals.filter(g => {
    if (statusFilter === 'all') return true;
    return g.status === statusFilter;
  });

  return (
    <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', background: 'var(--card-bg)' }}>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(250, 203, 5, 0.15)', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={22} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>Financial Goals 🎯</h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Save up systematically for your future milestones</p>
          </div>
        </div>

        <button 
          onClick={onAddGoal} 
          className="glow-btn"
          style={{ padding: '10px 18px', borderRadius: '12px', fontSize: '13px' }}
        >
          <Plus size={16} />
          <span>New Goal</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', overflowX: 'auto' }}>
        {['all', 'active', 'completed', 'paused'].map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              background: statusFilter === tab ? 'var(--accent-primary)' : 'transparent',
              color: statusFilter === tab ? '#000' : 'var(--text-secondary)',
              fontWeight: '800',
              fontSize: '12px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="scanning-spinner" style={{ width: '30px', height: '30px', border: '3px solid var(--card-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }}></div>
          <span style={{ fontSize: '14px', fontWeight: '700' }}>Loading your goals...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredGoals.length === 0 && (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px dashed var(--card-border)' }}>
          <Target size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.5 }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>No Goals Found</h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
            {statusFilter === 'all' 
              ? 'Start your saving journey by setting your first target today!'
              : `You have no goals under "${statusFilter}" status.`}
          </p>
          {statusFilter === 'all' && (
            <button 
              onClick={onAddGoal} 
              className="outline-btn"
              style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '13px' }}
            >
              <span>Setup a Goal</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* Goals Grid */}
      {!loading && filteredGoals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {filteredGoals.map(goal => {
            const progress = Math.min(((goal.savedAmount || 0) / (goal.targetAmount || 1)) * 100, 100);
            const remaining = Math.max((goal.targetAmount || 0) - (goal.savedAmount || 0), 0);
            const monthlyRequired = calcMonthlySavingRequired(goal.targetAmount, goal.savedAmount, goal.deadline);
            const badge = getStatusBadgeStyles(goal.status);
            const isCompleted = goal.status === 'completed';
            const isPaused = goal.status === 'paused';

            return (
              <div 
                key={goal.id} 
                className="glass-card" 
                style={{ 
                  padding: '20px', 
                  borderRadius: '20px', 
                  border: '1px solid var(--card-border)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px',
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'var(--card-bg)'
                }}
              >
                {/* Top Badge Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Category */}
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: '800', 
                      background: 'var(--bg-secondary)', 
                      color: 'var(--text-secondary)',
                      padding: '4px 8px', 
                      borderRadius: '6px',
                      textTransform: 'uppercase',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Tag size={10} />
                      {goal.category}
                    </span>

                    {/* Priority */}
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: '900', 
                      background: 'var(--bg-secondary)', 
                      color: getPriorityColor(goal.priority),
                      padding: '4px 8px', 
                      borderRadius: '6px',
                      textTransform: 'uppercase'
                    }}>
                      {goal.priority}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span style={{ 
                    fontSize: '10px', 
                    fontWeight: '900', 
                    background: badge.bg, 
                    color: badge.color,
                    padding: '4px 8px', 
                    borderRadius: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {badge.label}
                  </span>
                </div>

                {/* Title & Notes */}
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {goal.name}
                  </h4>
                  {goal.notes && (
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {goal.notes}
                    </p>
                  )}
                </div>

                {/* Progress Details */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '800', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--success)' }}>{formatCurrency(goal.savedAmount || 0)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>of {formatCurrency(goal.targetAmount || 0)}</span>
                  </div>
                  {/* Progress Bar */}
                  <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${progress}%`, 
                        background: isCompleted ? 'var(--success)' : isPaused ? 'var(--text-muted)' : 'var(--accent-primary)',
                        borderRadius: '99px',
                        transition: 'width 0.4s ease'
                      }}
                    ></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    <span>{progress.toFixed(0)}% Saved</span>
                    {remaining > 0 && <span>{formatCurrency(remaining)} Left</span>}
                  </div>
                </div>

                {/* Deadline & Required Saved row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '12px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Target Date</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Calendar size={12} />
                      {formatDate(goal.deadline)}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Monthly Required</span>
                    <span style={{ 
                      fontSize: '12px', 
                      fontWeight: '800', 
                      color: isCompleted ? 'var(--success)' : monthlyRequired > 10000 ? 'var(--danger)' : 'var(--text-primary)',
                      display: 'block', 
                      marginTop: '2px' 
                    }}>
                      {isCompleted ? 'Goal Met! 🎉' : isPaused ? 'Paused ⏸️' : `${formatCurrency(monthlyRequired)}/mo`}
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', borderTop: '1px solid var(--card-border)', paddingTop: '12px' }}>
                  {/* Add Savings */}
                  {!isCompleted && !isPaused && (
                    <button
                      onClick={() => onAddGoalSavings(goal)}
                      className="outline-btn"
                      style={{ 
                        flex: 1, 
                        justifyContent: 'center', 
                        padding: '8px 12px', 
                        borderRadius: '10px', 
                        fontSize: '12px',
                        background: 'rgba(16, 185, 129, 0.08) !important',
                        borderColor: 'rgba(16, 185, 129, 0.2)',
                        color: 'var(--success) !important'
                      }}
                      title="Deposit savings into this goal"
                    >
                      <PiggyBank size={14} />
                      <span>Deposit</span>
                    </button>
                  )}

                  {/* Pause / Resume */}
                  {!isCompleted && (
                    <button
                      onClick={() => onUpdateGoal(goal.id, { ...goal, status: isPaused ? 'active' : 'paused' })}
                      className="outline-btn"
                      style={{ padding: '8px 12px', borderRadius: '10px', fontSize: '12px' }}
                      title={isPaused ? 'Resume Goal' : 'Pause Goal'}
                    >
                      {isPaused ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                  )}

                  {/* Edit */}
                  <button
                    onClick={() => onUpdateGoal(goal.id, null)} // Pass null as updatedData to trigger editing form modal
                    className="outline-btn"
                    style={{ padding: '8px 12px', borderRadius: '10px', fontSize: '12px' }}
                    title="Edit Goal Details"
                  >
                    <Edit2 size={14} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete goal "${goal.name}"?`)) {
                        onDeleteGoal(goal.id);
                      }
                    }}
                    className="outline-btn"
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: '10px', 
                      fontSize: '12px',
                      borderColor: 'rgba(239, 68, 68, 0.2)',
                      color: 'var(--danger) !important'
                    }}
                    title="Delete Goal"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
