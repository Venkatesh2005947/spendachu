import React, { useState } from 'react';
import { Mail, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../services/firebase';

export default function ForgotPassword({ onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess(`Password reset email sent to ${email}! Check your inbox (and spam folder). Click the link to reset your password.`);
    } catch (err) {
      const errorMap = {
        'auth/user-not-found': 'No account found with this email address.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/too-many-requests': 'Too many requests. Please try again after a few minutes.',
        'auth/network-request-failed': 'Network error. Check your internet connection.',
      };
      setError(errorMap[err.code] || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-glow-blob one"></div>
      <div className="auth-glow-blob two"></div>

      <div className="glass-card auth-card">
        <div className="auth-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: '900' }}>SpendAchu</span>
        </div>

        <div className="auth-header">
          <h2>Forgot Password? 🤔</h2>
          <p>
            {success
              ? 'Reset link sent! Check your inbox.'
              : 'Enter your email and we\'ll send you a reset link!'}
          </p>
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
            <span>{success}</span>
          </div>
        )}

        {!success ? (
          <form onSubmit={handleSendReset}>
            <div className="form-group">
              <label htmlFor="reset-email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="reset-email"
                  type="email"
                  className="form-control"
                  placeholder="you@example.com"
                  style={{ paddingLeft: '40px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              id="btn-send-reset"
              type="submit"
              className="glow-btn"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <button
            id="btn-resend-reset"
            type="button"
            className="outline-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setSuccess(''); setEmail(''); }}
          >
            Send to a different email
          </button>
        )}

        <div className="auth-footer">
          <a
            href="#back"
            className="outline-btn"
            style={{ width: '100%', justifyContent: 'center', border: 'none' }}
            onClick={(e) => { e.preventDefault(); onBackToLogin(); }}
          >
            <ArrowLeft size={16} />
            <span>Back to Login</span>
          </a>
        </div>
      </div>
    </div>
  );
}
