import React, { useState, useEffect } from 'react';
import { Send, AlertCircle, CheckCircle, Mail, Bell, BellOff } from 'lucide-react';
import { dbService } from '../../services/db';

export default function FeedbackForm() {
  const [category, setCategory] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reminder Settings State
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      const data = await dbService.getUserSettings();
      setRemindersEnabled(data.inactiveRemindersEnabled !== false);
    } catch (err) {
      console.warn('Failed to load user settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleToggleReminders = async (e) => {
    const newValue = e.target.checked;
    setRemindersEnabled(newValue);
    setSettingsMessage('');
    try {
      await dbService.updateReminderSettings(newValue);
      setSettingsMessage(newValue ? 'Inactivity email reminders enabled 🔔' : 'Inactivity email reminders disabled 🔕');
      setTimeout(() => setSettingsMessage(''), 4000);
    } catch (err) {
      setRemindersEnabled(!newValue);
      alert('Failed to update email preferences.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!message.trim()) {
      setError('Please type your feedback message.');
      return;
    }

    setLoading(true);
    try {
      await dbService.submitFeedback({ category, message });
      setSuccess(true);
      setMessage('');
    } catch (err) {
      setError(err.message || 'Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-pane active" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Email Notification Settings Card */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '10px', borderRadius: '12px', color: 'var(--accent-primary)', display: 'flex' }}>
              {remindersEnabled ? <Bell size={20} /> : <BellOff size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Inactive User Reminder Emails
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Receive helpful nudges if you haven't logged in for 7, 14, or 30 days
              </p>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
            <input 
              type="checkbox" 
              checked={remindersEnabled}
              onChange={handleToggleReminders}
              disabled={settingsLoading}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <span>{remindersEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        {settingsMessage && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--success)', fontWeight: '700' }}>
            {settingsMessage}
          </div>
        )}
      </div>

      {/* Feedback Form Card */}
      <div className="glass-card" style={{ padding: '30px', borderRadius: '24px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--text-primary)',
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Mail size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '900', margin: 0 }}>Send Feedback</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              Suggestions, bugs or questions? We are listening!
            </p>
          </div>
        </div>

        {error && (
          <div className="alert-pill danger" style={{ marginBottom: '20px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert-pill success" style={{ marginBottom: '20px', background: 'var(--success-bg)', color: 'var(--success)', borderLeft: '3px solid var(--success)' }}>
            <CheckCircle size={16} />
            <span>Thank you! Your feedback has been sent to <strong>spendachu@gmail.com</strong>. 📩</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="category">Feedback Category</label>
            <select
              id="category"
              className="form-control"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '4px',
                border: '2px solid var(--border-color)',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-color)',
                fontFamily: 'inherit',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
            >
              <option value="suggestion">💡 Suggestion or Feature Request</option>
              <option value="bug">🐛 Bug Report</option>
              <option value="question">❓ Question / Inquiry</option>
              <option value="other">💬 Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="message">Your Message</label>
            <textarea
              id="message"
              rows="6"
              className="form-control"
              placeholder="Tell us what's on your mind..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '4px',
                border: '2px solid var(--border-color)',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-color)',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical'
              }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="glow-btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '15px', padding: '12px' }}
            disabled={loading}
          >
            {loading ? (
              <span>Sending...</span>
            ) : (
              <>
                <Send size={16} />
                <span>Submit Feedback</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
