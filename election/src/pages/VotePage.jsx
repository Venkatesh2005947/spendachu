import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShieldCheck, CheckCircle, AlertTriangle, Lock, Clock, Vote, ArrowLeft } from 'lucide-react'
import { validateToken, submitVote, getCandidates, getElectionSettings } from '../services/electionService'
import CandidateCard from '../components/CandidateCard'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { FullPageLoader } from '../components/ui/LoadingSpinner'

export default function VotePage() {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [voterState, setVoterState] = useState('checking') // checking | valid | already_voted | invalid | not_started | closed | submitted
  const [voterName, setVoterName] = useState('')
  const [candidates, setCandidates] = useState([])
  const [settings, setSettings] = useState(null)

  const [selectedCandidateId, setSelectedCandidateId] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    async function init() {
      if (!token) {
        setVoterState('invalid')
        setLoading(false)
        return
      }

      try {
        const [validation, candidatesList, settingsData] = await Promise.all([
          validateToken(token),
          getCandidates(),
          getElectionSettings().catch(() => null),
        ])

        setSettings(settingsData)

        if (!validation.valid) {
          if (validation.reason === 'already_voted') {
            setVoterState('already_voted')
          } else if (validation.reason === 'election_not_started') {
            setVoterState('not_started')
          } else if (validation.reason === 'election_closed') {
            setVoterState('closed')
          } else {
            setVoterState('invalid')
          }
        } else {
          setVoterName(validation.voterName || 'Voter')
          setCandidates(candidatesList)
          setVoterState('valid')
        }
      } catch (err) {
        console.error('Vote page init error:', err)
        setVoterState('invalid')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [token])

  const handleVoteSubmit = async () => {
    if (!selectedCandidateId || submitting) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await submitVote(token, selectedCandidateId)
      if (res.success) {
        setShowConfirmModal(false)
        setVoterState('submitted')
        // Automatically destroy token state locally
        window.history.replaceState(null, '', '/vote/used')
      } else {
        if (res.error === 'already_voted') {
          setVoterState('already_voted')
        } else if (res.error === 'rate_limited') {
          setSubmitError('Too many submission attempts. Please wait a few minutes.')
        } else if (res.error === 'election_closed') {
          setVoterState('closed')
        } else {
          setSubmitError('Failed to submit vote. Please try again.')
        }
        setShowConfirmModal(false)
      }
    } catch (err) {
      console.error('Error submitting vote:', err)
      setSubmitError('An unexpected error occurred. Please try again.')
      setShowConfirmModal(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <FullPageLoader message="Validating private voting token..." />

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId)

  // 1. ALREADY VOTED PAGE
  if (voterState === 'already_voted') {
    return (
      <div className="vote-bg min-h-screen flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 text-center animate-slide-up border-emerald-500/20">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
            <Lock className="text-amber-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Vote Already Submitted</h2>
          <p className="text-gray-300 text-base mb-6 leading-relaxed">
            Your vote has already been submitted.
          </p>
          <div className="bg-emerald-950/40 border border-emerald-500/15 rounded-2xl p-4 text-xs text-emerald-400/80 mb-6 flex items-center gap-2 text-left">
            <ShieldCheck size={20} className="shrink-0 text-emerald-400" />
            <span>Each private link can only be used once to ensure 100% election integrity.</span>
          </div>
          <Link to="/">
            <Button variant="secondary" size="md" className="w-full">
              Return to Election Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // 2. INVALID / USED LINK PAGE
  if (voterState === 'invalid') {
    return (
      <div className="vote-bg min-h-screen flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 text-center animate-slide-up border-red-500/20">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="text-red-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Invalid Voting Link</h2>
          <p className="text-gray-300 text-base mb-6 leading-relaxed">
            This private voting link is invalid, expired, or has already been used.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            If you believe this is an error, please contact your WhatsApp group admin for assistance.
          </p>
          <Link to="/">
            <Button variant="secondary" size="md" className="w-full">
              Go to Home Page
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // 3. ELECTION NOT STARTED YET
  if (voterState === 'not_started') {
    return (
      <div className="vote-bg min-h-screen flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 text-center animate-slide-up border-emerald-500/20">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <Clock className="text-emerald-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Voting Has Not Started</h2>
          <p className="text-gray-300 text-base mb-6 leading-relaxed">
            The election is scheduled to open soon. Please hold onto your link and return once voting commences.
          </p>
          {settings?.start_date && (
            <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl p-4 mb-6">
              <span className="text-xs text-emerald-400/70 block uppercase font-bold mb-1">Start Time</span>
              <span className="text-white font-bold text-lg">{new Date(settings.start_date).toLocaleString()}</span>
            </div>
          )}
          <Link to="/">
            <Button variant="secondary" size="md" className="w-full">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // 4. ELECTION CLOSED
  if (voterState === 'closed') {
    return (
      <div className="vote-bg min-h-screen flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 text-center animate-slide-up border-red-500/20">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <Clock className="text-red-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Voting Closed</h2>
          <p className="text-gray-300 text-base mb-6 leading-relaxed">
            This election has ended and no further votes are being accepted.
          </p>
          <Link to="/">
            <Button variant="secondary" size="md" className="w-full">
              View Election Info
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // 5. SUCCESSFUL SUBMISSION PAGE
  if (voterState === 'submitted') {
    return (
      <div className="vote-bg min-h-screen flex items-center justify-center p-4">
        <div className="glass-card max-w-lg w-full p-8 text-center animate-slide-up border-emerald-500/30">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/10">
            <CheckCircle className="text-emerald-400" size={44} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
            Vote Submitted Successfully
          </h2>
          <div className="bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-5 mb-6 text-emerald-200 text-base leading-relaxed font-medium">
            “Your vote has been submitted successfully. Your vote is anonymous and cannot be changed.”
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-emerald-400/70 mb-8">
            <ShieldCheck size={16} />
            <span>Your private link is now permanently deactivated.</span>
          </div>
          <Link to="/">
            <Button variant="secondary" size="md" className="w-full">
              Done
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // 6. ACTIVE VOTING FORM
  return (
    <div className="vote-bg min-h-screen p-4 sm:p-6 lg:p-12 pb-24">
      <header className="max-w-2xl mx-auto w-full mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Vote size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base">Cast Your Vote</h1>
              <span className="text-emerald-400/60 text-xs">{settings?.election_title || 'Group Admin Election'}</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
            <ShieldCheck size={14} />
            <span>Private Link Valid</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full space-y-6">
        {/* Welcome & Anonymity guarantee banner */}
        <div className="glass-card p-5 border-emerald-500/20">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 shrink-0 mt-0.5">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="text-white font-bold text-base mb-1">
                Hello, <span className="text-emerald-400">{voterName}</span>
              </h2>
              <p className="text-gray-300 text-xs leading-relaxed">
                Select <strong>only one candidate</strong> below. Your choice will be saved anonymously in a separate ballot container with no link back to your identity or token.
              </p>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm flex items-center gap-3">
            <AlertTriangle size={18} className="shrink-0 text-red-400" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Candidate List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400/70 px-1">
            Candidates ({candidates.length})
          </h3>

          {candidates.length === 0 ? (
            <div className="glass-card p-8 text-center text-gray-400 text-sm">
              No active candidates have been added to this election yet.
            </div>
          ) : (
            candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                selected={selectedCandidateId === candidate.id}
                onSelect={(id) => setSelectedCandidateId(id)}
                disabled={submitting}
              />
            ))
          )}
        </div>
      </main>

      {/* Sticky Bottom Vote Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-emerald-950/90 backdrop-blur-md border-t border-emerald-500/20 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="hidden sm:block text-xs text-gray-400">
            {selectedCandidate ? (
              <span>Selected: <strong className="text-emerald-400">{selectedCandidate.candidate_name}</strong></span>
            ) : (
              <span>Tap a candidate card to select</span>
            )}
          </div>
          <Button
            id="review-vote-btn"
            variant="primary"
            size="lg"
            className="w-full sm:w-auto min-w-[200px]"
            disabled={!selectedCandidateId || submitting}
            onClick={() => setShowConfirmModal(true)}
          >
            Review & Submit Vote
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => !submitting && setShowConfirmModal(false)}
        title="Confirm Your Vote"
      >
        <div className="space-y-5">
          <p className="text-gray-300 text-sm">
            Please confirm that you want to cast your vote for:
          </p>

          {selectedCandidate && (
            <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center text-lg">
                {selectedCandidate.candidate_name[0]}
              </div>
              <div>
                <h4 className="text-white font-bold text-base">{selectedCandidate.candidate_name}</h4>
                {selectedCandidate.candidate_description && (
                  <p className="text-xs text-gray-400 line-clamp-1">{selectedCandidate.candidate_description}</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-200/90 leading-relaxed flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 text-amber-400 mt-0.5" />
            <span>This action is <strong>permanent</strong>. Once submitted, your voting link will expire and your vote cannot be changed or recalled.</span>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={submitting}
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              id="confirm-submit-vote-btn"
              variant="primary"
              size="md"
              className="flex-1"
              loading={submitting}
              onClick={handleVoteSubmit}
            >
              Confirm Vote
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
