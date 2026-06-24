import React, { useState } from 'react';
import { Send, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { dbService } from '../../services/db';

export default function FeedbackForm() {
  const [category, setCategory] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
    <div className="tab-pane active" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 0' }}>
      <div className="glass-card" style={{ padding: '30px', border: '3px solid var(--border-color)', boxShadow: 'var(--neo-shadow)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--border-color)',
            boxShadow: '2px 2px 0px var(--border-color)'
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
