import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Vote, Lock, Mail, AlertTriangle } from 'lucide-react'
import { adminSignIn } from '../../services/adminService'
import { isSupabaseConfigured } from '../../lib/supabase'
import Button from '../../components/ui/Button'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) return

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in election/.env file.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await adminSignIn(email, password)
      navigate('/admin/dashboard')
    } catch (err) {
      console.error('Admin login failed:', err)
      const msg = err.message || ''
      if (msg.includes('Failed to fetch') || err.name === 'TypeError') {
        setError('Connection failed. Please check that your VITE_SUPABASE_URL in .env is correct and your database is online.')
      } else {
        setError(msg || 'Invalid email or password.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="vote-bg min-h-screen flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-8 border-emerald-500/20 animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/25">
            <Vote size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-xs text-emerald-400/70 mt-1">WhatsApp Group Election Management</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 text-amber-200 text-xs mb-6 flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-amber-400 mt-0.5" />
            <span>
              <strong>Database Not Configured:</strong> Set valid Supabase credentials in <code>election/.env</code> before logging in.
            </span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm mb-6 flex items-start gap-3">
            <AlertTriangle size={18} className="shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-gray-400" size={18} />
              <input
                id="admin-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl py-3 pl-11 pr-4 text-white placeholder-gray-500 text-sm focus:border-emerald-400 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
              <input
                id="admin-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl py-3 pl-11 pr-4 text-white placeholder-gray-500 text-sm focus:border-emerald-400 transition-colors"
              />
            </div>
          </div>

          <Button
            id="admin-login-submit-btn"
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            loading={loading}
          >
            Sign In to Dashboard
          </Button>
        </form>

        <div className="mt-8 text-center border-t border-emerald-500/15 pt-6 text-xs text-gray-400">
          Protected route &bull; Admin authentication required
        </div>
      </div>
    </div>
  )
}
