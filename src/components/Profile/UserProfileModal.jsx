import { useRef, useState } from 'react';
import { X, LogOut, ShieldCheck, DollarSign, UserCheck, Award, Camera, Trash2 } from 'lucide-react';
import './UserProfileModal.css';

const UserProfileModal = ({
  user,
  onClose,
  onLogout,
  onUpdateProfilePicture,
  currencyCode = 'INR',
  onCurrencyChange,
  expensesCount = 0,
  savingsCount = 0,
  goalsCount = 0
}) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const getInitials = (nameStr) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size is too large. Please select a photo under 5MB.');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const targetSize = 240;
        canvas.width = targetSize;
        canvas.height = targetSize;

        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

        if (onUpdateProfilePicture) {
          onUpdateProfilePicture(compressedBase64).finally(() => setUploading(false));
        } else {
          setUploading(false);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    if (onUpdateProfilePicture && confirm('Remove profile photo?')) {
      setUploading(true);
      onUpdateProfilePicture(null).finally(() => setUploading(false));
    }
  };

  return (
    <div className="upm-backdrop" onClick={onClose}>
      <div className="upm-card" onClick={(e) => e.stopPropagation()}>
        {/* Banner with Close Button */}
        <div className="upm-banner">
          <button className="upm-close-btn" onClick={onClose} title="Close Profile">
            <X size={18} />
          </button>
        </div>

        {/* Avatar & Role */}
        <div className="upm-header-body">
          <div className="upm-avatar-wrapper">
            <div 
              className="upm-avatar" 
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              title="Click to upload profile photo"
            >
              {user.profile_picture ? (
                <img src={user.profile_picture} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                getInitials(user.name)
              )}
              <div className="upm-avatar-overlay">
                <Camera size={20} />
              </div>
            </div>
            <div className="upm-online-badge" title="Account Active" />
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user.profile_picture && (
              <button 
                onClick={handleRemovePhoto}
                title="Remove photo"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  borderRadius: '9999px',
                  padding: '5px 10px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Trash2 size={12} />
                <span>Remove Photo</span>
              </button>
            )}
            {user.is_admin && (
              <div className="upm-role-pill">
                <ShieldCheck size={14} />
                <span>Admin Account</span>
              </div>
            )}
          </div>
        </div>

        {/* User Details */}
        <div className="upm-user-details">
          <h2 className="upm-user-name">{user.name || 'SpendAchu User'}</h2>
          <p className="upm-user-email">{user.email || 'user@example.com'}</p>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '4px', fontWeight: '600', cursor: 'pointer' }} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            {uploading ? '⏳ Uploading photo...' : '📷 Click profile avatar to upload photo'}
          </div>
        </div>

        {/* Quick Activity Stats */}
        <div className="upm-stats-grid">
          <div className="upm-stat-box">
            <div className="upm-stat-val">{expensesCount}</div>
            <div className="upm-stat-lbl">Expenses</div>
          </div>
          <div className="upm-stat-box">
            <div className="upm-stat-val">{savingsCount}</div>
            <div className="upm-stat-lbl">Savings</div>
          </div>
          <div className="upm-stat-box">
            <div className="upm-stat-val">{goalsCount}</div>
            <div className="upm-stat-lbl">Goals</div>
          </div>
        </div>

        {/* Account Settings / Preferences Section */}
        <div className="upm-section">
          <div className="upm-section-title">Account Preferences</div>
          
          <div className="upm-settings-row">
            <div className="upm-settings-info">
              <DollarSign size={18} style={{ color: 'var(--accent-primary)' }} />
              <span className="upm-settings-lbl">Default Currency</span>
            </div>
            <select
              className="upm-currency-select"
              value={currencyCode}
              onChange={(e) => onCurrencyChange && onCurrencyChange(e.target.value)}
            >
              <option value="INR">₹ INR (Indian Rupee)</option>
              <option value="USD">$ USD (US Dollar)</option>
              <option value="EUR">€ EUR (Euro)</option>
              <option value="GBP">£ GBP (British Pound)</option>
            </select>
          </div>
        </div>

        {/* Security & Verification Section */}
        <div className="upm-section" style={{ paddingBottom: '24px' }}>
          <div className="upm-section-title">Security & Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <UserCheck size={16} style={{ color: '#10b981' }} />
              <span>JWT Authentication Active & Protected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <Award size={16} style={{ color: '#3b82f6' }} />
              <span>PostgreSQL Enterprise Data Storage</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="upm-footer">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            SpendAchu v1.0.0
          </div>
          <button className="upm-logout-btn" onClick={() => { onClose(); onLogout(); }}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
