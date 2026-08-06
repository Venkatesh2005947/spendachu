import { useEffect, useState } from 'react'
import { Trophy, BarChart2, ShieldCheck, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getElectionResults, getElectionSettings } from '../../services/electionService'
import CountdownTimer from '../../components/CountdownTimer'
import { FullPageLoader } from '../../components/ui/LoadingSpinner'

export default function ResultsPage() {
  const [results, setResults] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchResults() {
      try {
        const [resData, settingsData] = await Promise.all([
          getElectionResults(),
          getElectionSettings().catch(() => null),
        ])
        setResults(resData)
        setSettings(settingsData)
      } catch (err) {
        console.error('Error loading results:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchResults()
  }, [])

  if (loading) return <FullPageLoader message="Calculating election results..." />

  const isClosed = results?.election_closed || false
  const totalVoters = results?.total_voters || 0
  const totalVoted = results?.total_voted || 0
  const totalNotVoted = results?.total_not_voted || 0

  const candidates = results?.candidates || []
  const maxVotes = Math.max(0, ...candidates.map(c => c.vote_count || 0))

  // Detect winner or tie
  const topCandidates = candidates.filter(c => (c.vote_count || 0) === maxVotes && maxVotes > 0)
  const isTie = isClosed && topCandidates.length > 1
  const winner = isClosed && topCandidates.length === 1 ? topCandidates[0] : null

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner */}
      <div className="border-b border-emerald-500/15 pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Election Results</h1>
        <p className="text-sm text-emerald-400/70 mt-1">
          {isClosed ? 'Official Anonymous Final Vote Tallies' : 'Real-time turnout & live security lock'}
        </p>
      </div>

      {/* Participation Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Eligible Voters</span>
          <div className="text-2xl font-black text-white mt-1">{totalVoters}</div>
        </div>

        <div className="glass-card p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total Votes Submitted</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{totalVoted}</div>
        </div>

        <div className="glass-card p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Total Members Yet to Vote</span>
          <div className="text-2xl font-black text-amber-400 mt-1">{totalNotVoted}</div>
        </div>
      </div>

      {/* BEFORE ELECTION CLOSES NOTICE */}
      {!isClosed && (
        <div className="glass-card p-8 text-center border-amber-500/20 max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Lock size={32} className="text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Live Candidate Counts are Hidden</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Per election rules, individual candidate vote counts remain hidden while voting is active to prevent bias and strategic voting.
          </p>

          {settings?.end_date && (
            <div className="bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-4 inline-block">
              <CountdownTimer targetDate={settings.end_date} label="Full Results Unlock In" />
            </div>
          )}

          <div className="bg-emerald-950/40 border border-emerald-500/15 rounded-xl p-3 text-xs text-emerald-400/80 flex items-center justify-center gap-2">
            <ShieldCheck size={16} />
            <span>Final tallies will automatically unlock once the election end time is reached.</span>
          </div>
        </div>
      )}

      {/* AFTER ELECTION CLOSES — FINAL RESULTS */}
      {isClosed && (
        <div className="space-y-6">
          {/* Winner / Tie Banner */}
          {isTie && (
            <div className="glass-card p-6 border-amber-500/40 bg-amber-500/10 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-300">TIE RESULT DETECTED!</h2>
                <p className="text-sm text-amber-200/80">
                  Top candidates tied with {maxVotes} votes each: <strong>{topCandidates.map(c => c.candidate_name).join(', ')}</strong>.
                </p>
              </div>
            </div>
          )}

          {winner && (
            <div className="glass-card p-8 border-emerald-500/40 bg-gradient-to-r from-emerald-900/30 to-teal-900/30 flex flex-col sm:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/20 text-white">
                <Trophy size={40} />
              </div>
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Declared Winner</span>
                <h2 className="text-3xl font-black text-white mt-1">{winner.candidate_name}</h2>
                <p className="text-sm text-emerald-300/80 mt-1">
                  Received {winner.vote_count} votes ({totalVoted > 0 ? Math.round((winner.vote_count / totalVoted) * 100) : 0}% of total votes)
                </p>
              </div>
            </div>
          )}

          {/* Breakdown by Candidate */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Candidate Breakdown</h3>

            <div className="space-y-3">
              {candidates.map((candidate) => {
                const votes = candidate.vote_count || 0
                const pct = totalVoted > 0 ? Math.round((votes / totalVoted) * 100) : 0
                const isTop = votes === maxVotes && maxVotes > 0

                return (
                  <div key={candidate.candidate_id} className={`glass-card p-5 transition-all ${isTop ? 'border-emerald-500/40' : ''}`}>
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm">
                          {candidate.candidate_name[0]}
                        </div>
                        <div>
                          <h4 className="text-white font-bold text-base flex items-center gap-2">
                            {candidate.candidate_name}
                            {isTop && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 text-xs font-bold">
                                {isTie ? 'Tied' : 'Winner'}
                              </span>
                            )}
                          </h4>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xl font-black text-white">{votes}</span>
                        <span className="text-xs text-gray-400 block">{pct}% of votes</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-3 bg-emerald-950 rounded-full overflow-hidden p-0.5 border border-emerald-500/10">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
