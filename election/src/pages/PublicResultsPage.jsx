import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Vote, Lock, AlertTriangle, ShieldCheck, ArrowLeft, Sparkles } from 'lucide-react'
import { getElectionResults, getElectionSettings } from '../services/electionService'
import CountdownTimer from '../components/CountdownTimer'
import Confetti from '../components/Confetti'
import Button from '../components/ui/Button'
import { FullPageLoader } from '../components/ui/LoadingSpinner'

export default function PublicResultsPage() {
  const [results, setResults] = useState(null)
  const [settingsFallback, setSettingsFallback] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchResults = useCallback(async () => {
    try {
      // Single authoritative call to get_election_results
      const resData = await getElectionResults()
      setResults(resData)

      // Fallback for end_date if missing in RPC
      if (!resData?.end_date) {
        const setRes = await getElectionSettings().catch(() => null)
        if (setRes) setSettingsFallback(setRes)
      }
    } catch (err) {
      console.error('Error loading election results:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchResults()

    // Poll every 2 seconds while results are locked to auto-unlock immediately when backend time is reached
    const interval = setInterval(() => {
      fetchResults()
    }, 2000)

    return () => clearInterval(interval)
  }, [fetchResults])

  if (loading) return <FullPageLoader message="Checking election results status..." />

  const endDate = results?.end_date || settingsFallback?.end_date || null
  const orgName = results?.organization_name || settingsFallback?.organization_name || 'WhatsApp Group'

  // STRICT UNLOCK CONDITION:
  // Results UNLOCK ONLY when backend released/results_unlocked is true OR when client time has passed endDate
  const isTimeExpired = endDate ? (new Date() >= new Date(endDate)) : false
  const isUnlocked = Boolean(results?.released === true || results?.results_unlocked === true || isTimeExpired)

  const totalVoters = results?.total_voters || 0
  const totalVoted = results?.total_voted || 0
  const totalNotVoted = results?.total_not_voted || 0

  const candidates = results?.candidates || []
  const maxVotes = Math.max(0, ...candidates.map(c => c.vote_count || 0))

  const topCandidates = candidates.filter(c => (c.vote_count || 0) === maxVotes && maxVotes > 0)
  const isTie = isUnlocked && topCandidates.length > 1
  const winner = isUnlocked && topCandidates.length === 1 ? topCandidates[0] : null

  return (
    <div className="vote-bg min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-12 relative overflow-hidden">
      {/* Celebration Confetti Animation ONLY when unlocked! */}
      {isUnlocked && <Confetti />}

      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Vote className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-white font-black text-lg tracking-tight">VoteSecure</h1>
            <span className="text-emerald-400/80 text-xs font-semibold uppercase tracking-wider">{orgName} Election Results</span>
          </div>
        </div>

        <Link to="/">
          <Button variant="secondary" size="sm">
            <ArrowLeft size={16} />
            Home
          </Button>
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto w-full my-6 space-y-6 z-10">
        {/* Participation Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Voters</span>
            <div className="text-2xl font-black text-white mt-1">{totalVoters}</div>
          </div>

          <div className="glass-card p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Votes Submitted</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{totalVoted}</div>
          </div>

          <div className="glass-card p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Pending Votes</span>
            <div className="text-2xl font-black text-amber-400 mt-1">{totalNotVoted}</div>
          </div>
        </div>

        {/* LOCKED STATE — Before Scheduled Release Time */}
        {!isUnlocked && (
          <div className="glass-card p-8 sm:p-10 text-center border-amber-500/30 max-w-xl mx-auto space-y-6 animate-slide-up">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/5">
              <Lock size={40} className="text-amber-400" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-white mb-2">Official Results Are Locked</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Candidate vote counts are strictly encrypted & hidden from everyone (including group admins) until the scheduled release time.
              </p>
            </div>

            {endDate ? (
              <div className="bg-emerald-950/80 border border-emerald-500/30 rounded-2xl p-6 shadow-inner space-y-3">
                <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider block">
                  Official Result Release In
                </span>
                <div className="flex justify-center py-2">
                  <CountdownTimer targetDate={endDate} label="" onExpire={fetchResults} />
                </div>
                <span className="text-xs text-gray-400 block font-medium">
                  Scheduled Release: {new Date(endDate).toLocaleString()}
                </span>
              </div>
            ) : (
              <div className="bg-emerald-950/40 border border-emerald-500/15 rounded-2xl p-4 text-xs text-emerald-400 flex items-center justify-center gap-2">
                <Sparkles size={16} className="text-amber-400 animate-pulse" />
                <span>Waiting for admin to schedule election closing time...</span>
              </div>
            )}

            <div className="bg-emerald-950/40 border border-emerald-500/15 rounded-xl p-3 text-xs text-emerald-400/80 flex items-center justify-center gap-2">
              <ShieldCheck size={16} />
              <span>Results will automatically unlock on this page when the countdown finishes!</span>
            </div>
          </div>
        )}

        {/* UNLOCKED STATE — Official Final Results */}
        {isUnlocked && (
          <div className="space-y-6 animate-slide-up">
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
              <div className="glass-card p-8 border-emerald-500/40 bg-gradient-to-r from-emerald-900/40 to-teal-900/40 flex flex-col sm:flex-row items-center gap-6 shadow-2xl animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/20 text-white shrink-0">
                  <Trophy size={40} />
                </div>
                <div className="text-center sm:text-left space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-center sm:justify-start gap-1">
                    <Sparkles size={14} /> Official Election Winner
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-amber-300 leading-snug">
                    Congratulations! Mr. {winner.candidate_name} is your new Group Admin! 🎉
                  </h2>
                  <p className="text-sm text-emerald-300/80 mt-2 font-medium">
                    Received {winner.vote_count} votes ({totalVoted > 0 ? Math.round((winner.vote_count / totalVoted) * 100) : 0}% of total votes cast)
                  </p>
                </div>
              </div>
            )}

            {/* Candidate Breakdown */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Final Vote Tally</h3>

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
                          <span className="text-xs text-gray-400 block">{pct}% of votes cast</span>
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
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 text-emerald-400/40 text-xs z-10">
        <p>VoteSecure &bull; {orgName} Official Election System</p>
      </footer>
    </div>
  )
}
