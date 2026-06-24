import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { dbService } from '../../services/db';

export default function ForgotPassword({ onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1); // 1: Enter email, 2: Reset password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }

    setLoading(true);

    try {
      await dbService.checkEmail(email);
      setStep(2);
    } catch (err) {
      setError(err.message || 'No account found with this email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await dbService.resetPassword(email, newPassword);
      setSuccess('Password updated successfully! Redirecting...');
      setTimeout(() => {
        onBackToLogin();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
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
          {step === 1 ? (
            <p>Verify your email and we'll fix it!</p>
          ) : (
            <p>Set a strong password this time!</p>
          )}
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

        {step === 1 ? (
          <form onSubmit={handleVerifyEmail}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="email"
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

            <button type="submit" className="glow-btn" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="newPassword"
                  type="password"
                  className="form-control"
                  placeholder="Minimum 6 characters"
                  style={{ paddingLeft: '40px' }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-control"
                  placeholder="Confirm new password"
                  style={{ paddingLeft: '40px' }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="glow-btn" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Resetting...' : 'Update Password'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <a href="#back" className="outline-btn" style={{ width: '100%', justifyContent: 'center', border: 'none' }} onClick={(e) => { e.preventDefault(); onBackToLogin(); }}>
            <ArrowLeft size={16} />
            <span>Back to Login</span>
          </a>
        </div>
      </div>
    </div>
  );
}
