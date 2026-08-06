import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserCheck, BarChart3, Settings, Clock, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react'
import { getElectionResults, getElectionSettings } from '../../services/electionService'
import CountdownTimer from '../../components/CountdownTimer'
import Button from '../../components/ui/Button'
import { FullPageLoader } from '../../components/ui/LoadingSpinner'

export default function DashboardPage() {
  const [results, setResults] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [resData, settingsData] = await Promise.all([
          getElectionResults().catch(() => null),
          getElectionSettings().catch(() => null),
        ])
        setResults(resData)
        setSettings(settingsData)
      } catch (err) {
        console.error('Error loading dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [])

  if (loading) return <FullPageLoader message="Loading dashboard statistics..." />

  const totalVoters = results?.total_voters || 0
  const totalVoted = results?.total_voted || 0
  const totalNotVoted = results?.total_not_voted || 0
  const turnOutPercentage = totalVoters > 0 ? Math.round((totalVoted / totalVoters) * 100) : 0

  const now = new Date()
  const startDate = settings?.start_date ? new Date(settings.start_date) : null
  const endDate = settings?.end_date ? new Date(settings.end_date) : null

  const isNotStarted = startDate && now < startDate
  const isClosed = endDate && now > endDate
  const isActive = (!startDate || now >= startDate) && (!endDate || now <= endDate)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/15 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {settings?.election_title || 'Election Dashboard'}
          </h1>
          <p className="text-sm text-emerald-400/70 mt-1">
            Real-time voter participation tracking & election status
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admin/voters">
            <Button variant="primary" size="md">Manage Voters & Links</Button>
          </Link>
        </div>
      </div>

      {/* Security Guarantee Notice */}
      <div className="bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 text-xs text-emerald-200">
        <ShieldAlert size={20} className="shrink-0 text-emerald-400" />
        <span>
          <strong>Security Guarantee:</strong> Live per-candidate vote counts are strictly hidden until the election officially closes. Only overall participation numbers (Voted vs Not Voted) are displayed below.
        </span>
      </div>

      {/* Election Timing Card */}
      <div className="glass-card p-6 border-emerald-500/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Status</span>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : isClosed ? 'bg-red-400' : 'bg-amber-400'}`} />
                <h3 className="text-lg font-bold text-white">
                  {isActive ? 'Voting In Progress' : isClosed ? 'Election Closed' : 'Election Scheduled'}
                </h3>
              </div>
            </div>
          </div>

          <div>
            {isActive && endDate && <CountdownTimer targetDate={endDate} label="Closes in" />}
            {isNotStarted && startDate && <CountdownTimer targetDate={startDate} label="Opens in" />}
            {isClosed && <span className="text-xs text-red-400 font-semibold">Voting ended on {endDate?.toLocaleString()}</span>}
          </div>
        </div>
      </div>

      {/* Participation Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Voters */}
        <div className="glass-card p-6 border-emerald-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Voters</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Users size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{totalVoters}</div>
          <span className="text-xs text-gray-400 mt-1 block">Registered eligible voters</span>
        </div>

        {/* Card 2: Voted */}
        <div className="glass-card p-6 border-emerald-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Votes Cast</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400">{totalVoted}</div>
          <span className="text-xs text-emerald-400/70 mt-1 block">{turnOutPercentage}% turnout rate</span>
        </div>

        {/* Card 3: Yet to Vote */}
        <div className="glass-card p-6 border-emerald-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Pending Votes</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-400">{totalNotVoted}</div>
          <span className="text-xs text-amber-400/70 mt-1 block">Members yet to vote</span>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/admin/voters" className="glass-card p-5 hover:border-emerald-500/40 transition-all group">
          <Users className="text-emerald-400 mb-3 group-hover:scale-110 transition-transform" size={24} />
          <h4 className="text-white font-bold text-base mb-1">Voters & Links</h4>
          <p className="text-xs text-gray-400">Add voters, generate private WhatsApp links, & track voting status.</p>
        </Link>

        <Link to="/admin/candidates" className="glass-card p-5 hover:border-emerald-500/40 transition-all group">
          <UserCheck className="text-emerald-400 mb-3 group-hover:scale-110 transition-transform" size={24} />
          <h4 className="text-white font-bold text-base mb-1">Manage Candidates</h4>
          <p className="text-xs text-gray-400">Add or edit election candidates and descriptions.</p>
        </Link>

        <Link to="/admin/results" className="glass-card p-5 hover:border-emerald-500/40 transition-all group">
          <BarChart3 className="text-emerald-400 mb-3 group-hover:scale-110 transition-transform" size={24} />
          <h4 className="text-white font-bold text-base mb-1">Final Results</h4>
          <p className="text-xs text-gray-400">View anonymous final vote counts after election closes.</p>
        </Link>

        <Link to="/admin/settings" className="glass-card p-5 hover:border-emerald-500/40 transition-all group">
          <Settings className="text-emerald-400 mb-3 group-hover:scale-110 transition-transform" size={24} />
          <h4 className="text-white font-bold text-base mb-1">Election Settings</h4>
          <p className="text-xs text-gray-400">Configure election title, start time, and closing time.</p>
        </Link>
      </div>
    </div>
  )
}
