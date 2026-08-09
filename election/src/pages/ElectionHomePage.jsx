import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Vote, ShieldCheck, Lock, CheckCircle2, AlertTriangle, BarChart2 } from 'lucide-react'
import { getElectionSettings, getCandidates } from '../services/electionService'
import { isSupabaseConfigured } from '../lib/supabase'
import CountdownTimer from '../components/CountdownTimer'
import Button from '../components/ui/Button'
import { FullPageLoader } from '../components/ui/LoadingSpinner'

export default function ElectionHomePage() {
  const [settings, setSettings] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        if (isSupabaseConfigured) {
          const [settingsData, candidatesData] = await Promise.all([
            getElectionSettings().catch(() => null),
            getCandidates().catch(() => []),
          ])
          setSettings(settingsData)
          setCandidates(candidatesData)
        }
      } catch (err) {
        console.error('Error loading home data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) return <FullPageLoader message="Loading election details..." />

  const now = new Date()
  const startDate = settings?.start_date ? new Date(settings.start_date) : null
  const endDate = settings?.end_date ? new Date(settings.end_date) : null

  const isNotStarted = startDate && now < startDate
  const isClosed = endDate && now > endDate
  const isActive = (!startDate || now >= startDate) && (!endDate || now <= endDate)

  const orgName = settings?.organization_name || 'WhatsApp Group'

  return (
    <div className="vote-bg min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-12">
      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Vote className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-white font-black text-lg tracking-tight">VoteSecure</h1>
            <span className="text-emerald-400/80 text-xs font-semibold uppercase tracking-wider">{orgName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/results">
            <Button variant="outline" size="sm">
              <BarChart2 size={16} />
              Results
            </Button>
          </Link>
          <Link to="/admin">
            <Button variant="ghost" size="sm">Admin Portal</Button>
          </Link>
        </div>
      </header>

      {/* Main Hero Card */}
      <main className="max-w-2xl mx-auto w-full my-8 space-y-6">
        {!isSupabaseConfigured && (
          <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-5 text-amber-200 text-sm animate-fade-in flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 block mb-1">Supabase Credentials Required</strong>
              <span>
                To connect to your database, create a <code>.env</code> file in <code>d:\AI website\election\</code> with your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>. See <a href="file:///d:/AI%20website/election/SETUP.md" className="underline font-bold text-emerald-400">SETUP.md</a> for instructions.
              </span>
            </div>
          </div>
        )}

        <div className="glass-card p-6 sm:p-10 border border-emerald-500/20 relative overflow-hidden animate-slide-up">
          {/* Subtle glow circle */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-6 border" style={{
            background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isActive ? '#34d399' : '#f87171',
            borderColor: isActive ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)',
          }}>
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isActive ? 'ELECTION ACTIVE' : isNotStarted ? 'UPCOMING ELECTION' : 'ELECTION CLOSED'}
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-3 leading-tight">
            {settings?.election_title || 'Group Admin Election'}
          </h2>

          {settings?.election_description && (
            <p className="text-gray-300 text-base mb-6 leading-relaxed">
              {settings.election_description}
            </p>
          )}

          {/* Countdown / Schedule Info */}
          {(startDate || endDate) && (
            <div className="bg-emerald-950/40 border border-emerald-500/15 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                {isNotStarted && startDate && (
                  <CountdownTimer targetDate={startDate} label="Voting Opens In" />
                )}
                {isActive && endDate && (
                  <CountdownTimer targetDate={endDate} label="Voting Closes & Results Unlock In" />
                )}
                {isClosed && (
                  <div className="text-gray-400 text-sm font-medium">
                    Voting officially closed on {endDate ? endDate.toLocaleString() : 'scheduled time'}.
                  </div>
                )}
              </div>

              <Link to="/results">
                <Button variant="secondary" size="sm" className="w-full sm:w-auto shrink-0">
                  <BarChart2 size={16} />
                  View Live Countdown / Results
                </Button>
              </Link>
            </div>
          )}

          {/* Instructions Box for Voters */}
          <div className="border-t border-emerald-500/15 pt-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400/80">How to Vote</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Check your WhatsApp messages for your <strong>personal one-time private link</strong> sent by the group admin.</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Your token is completely unique to you. Your vote selection remains <strong>100% anonymous</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <Lock size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Each link can only be used once. Once submitted, your vote is permanent.</span>
              </li>
            </ul>
          </div>

          {/* Candidates list summary */}
          {candidates.length > 0 && (
            <div className="mt-8 pt-6 border-t border-emerald-500/15">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400/80 mb-4">
                Participating Candidates ({candidates.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {candidates.map((c) => (
                  <div key={c.id} className="bg-emerald-900/20 border border-emerald-500/10 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm">
                      {c.candidate_name[0]}
                    </div>
                    <span className="text-white text-sm font-semibold truncate">{c.candidate_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 text-emerald-400/40 text-xs">
        <p>VoteSecure &bull; {orgName} Official Election System</p>
      </footer>
    </div>
  )
}
