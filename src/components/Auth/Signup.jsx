import { useState } from 'react';
import { Mail, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup
} from 'firebase/auth';
import { auth, googleProvider, facebookProvider } from '../../services/firebase';

// Google icon SVG
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Facebook icon SVG
const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

function mapFirebaseError(code) {
  const map = {
    'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/popup-closed-by-user': 'Signup popup was closed. Please try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/account-exists-with-different-credential': 'This email is already linked to another login method.',
  };
  return map[code] || 'Registration failed. Please try again.';
}

export default function Signup({ onSignupSuccess, onLoginClick }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name.trim() });
      setSuccess('Account created! Welcome to SpendAchu! 🎉');
      setTimeout(() => {
        onSignupSuccess({
          id: result.user.uid,
          uid: result.user.uid,
          name: name.trim(),
          email: result.user.email,
          profile_picture: null,
          is_admin: false,
          isNewUser: true
        });
      }, 800);
    } catch (err) {
      setError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignup = async (provider, providerName) => {
    setError('');
    setSocialLoading(providerName);
    try {
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      onSignupSuccess({
        id: fbUser.uid,
        uid: fbUser.uid,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
        email: fbUser.email,
        profile_picture: fbUser.photoURL || null,
        is_admin: false,
        isNewUser: true
      });
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(mapFirebaseError(err.code));
      }
    } finally {
      setSocialLoading('');
    }
  };

  const isBusy = loading || !!socialLoading;

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
          <h2>Register & Save Cash! 🛡️</h2>
          <p>Join SpendAchu and keep your wallet healthy!</p>
        </div>

        {error && (
          <div className="alert-pill danger" style={{ marginBottom: '20px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert-pill success" style={{ marginBottom: '20px', background: 'var(--success-bg)', color: 'var(--success)', borderLeft: '3px solid var(--success)' }}>
            <AlertCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Social Signup Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <button
            id="btn-google-signup"
            type="button"
            className="outline-btn"
            style={{ width: '100%', justifyContent: 'center', gap: '10px', opacity: isBusy ? 0.7 : 1 }}
            onClick={() => handleSocialSignup(googleProvider, 'google')}
            disabled={isBusy}
          >
            <GoogleIcon />
            <span>{socialLoading === 'google' ? 'Connecting...' : 'Sign up with Google'}</span>
          </button>

          <button
            id="btn-facebook-signup"
            type="button"
            className="outline-btn"
            style={{ width: '100%', justifyContent: 'center', gap: '10px', opacity: isBusy ? 0.7 : 1 }}
            onClick={() => handleSocialSignup(facebookProvider, 'facebook')}
            disabled={isBusy}
          >
            <FacebookIcon />
            <span>{socialLoading === 'facebook' ? 'Connecting...' : 'Sign up with Facebook'}</span>
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>or sign up with email</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
        </div>

        <form onSubmit={handleEmailSignup}>
          <div className="form-group">
            <label htmlFor="signup-name">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                className="form-control"
                placeholder="John Doe"
                style={{ paddingLeft: '40px' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isBusy}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="signup-email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="username"
                className="form-control"
                placeholder="you@example.com"
                style={{ paddingLeft: '40px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isBusy}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="signup-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <input
                id="signup-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="form-control"
                placeholder="At least 6 characters"
                style={{ paddingLeft: '40px', paddingRight: '40px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isBusy}
              />
              <button
                type="button"
                className="close-btn"
                style={{ position: 'absolute', right: '8px', top: '7px' }}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password && password.length < 6 && (
              <p className="form-error">Password is too short (min 6 characters)</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="signup-confirm">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <input
                id="signup-confirm"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="form-control"
                placeholder="Confirm password"
                style={{ paddingLeft: '40px' }}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isBusy}
              />
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="form-error">Passwords do not match</p>
            )}
          </div>

          <button
            id="btn-email-signup"
            type="submit"
            className="glow-btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
            disabled={isBusy}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <a href="#login" className="auth-footer-link" onClick={(e) => { e.preventDefault(); onLoginClick(); }}>
            Sign In
          </a>
        </div>
      </div>
    </div>
  );
}
