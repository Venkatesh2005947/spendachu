import { useState, useEffect } from 'react'
import { Settings, Clock, Save, ShieldCheck, RefreshCw, AlertTriangle, MessageSquare, Building } from 'lucide-react'
import { getElectionSettings } from '../../services/electionService'
import { updateElectionSettings, resetElectionData } from '../../services/adminService'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { FullPageLoader } from '../../components/ui/LoadingSpinner'

/**
 * Converts an HTML datetime-local string (e.g. "2026-08-07T13:19")
 * representing the user's local time into a clean ISO 8601 UTC string for DB storage.
 */
function localDateTimeToIso(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Converts a UTC ISO string from DB (e.g. "2026-08-07T07:49:00.000Z")
 * back into a local HTML datetime-local input string (e.g. "2026-08-07T13:19").
 */
function isoToLocalDateTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const [organizationName, setOrganizationName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [whatsappTemplate, setWhatsappTemplate] = useState('')
  const [rulesText, setRulesText] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Reset Election modal state
  const [showResetModal, setShowResetModal] = useState(false)
  const [clearCandidates, setClearCandidates] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getElectionSettings()
        if (data) {
          setOrganizationName(data.organization_name || 'WhatsApp Group')
          setTitle(data.election_title || '')
          setDescription(data.election_description || '')
          
          let rawTpl = data.whatsapp_message_template || 'Hi {voter_name},\n\nHere is your private one-time link to vote in our {election_title}:\n\n{link}\n\nYour vote is 100% secret and anonymous.'
          rawTpl = rawTpl.replace(/\/n/g, '\n')
          setWhatsappTemplate(rawTpl)

          setRulesText(data.rules_text || '1. Select only one candidate.\n2. Voting link works only once.\n3. Vote cannot be changed after submission.')
          
          // Use isoToLocalDateTime to preserve local timezone formatting in input
          setStartDate(isoToLocalDateTime(data.start_date))
          setEndDate(isoToLocalDateTime(data.end_date))
        }
      } catch (err) {
        console.error('Error loading settings:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!title.trim() || submitting) return
    setSubmitting(true)
    setSuccessMsg(false)
    setErrorMsg(null)

    try {
      const cleanedTpl = whatsappTemplate.replace(/\/n/g, '\n')

      await updateElectionSettings({
        organizationName,
        title,
        description,
        whatsappMessageTemplate: cleanedTpl,
        rulesText,
        startDate: localDateTimeToIso(startDate),
        endDate: localDateTimeToIso(endDate),
      })
      setSuccessMsg(true)
      setTimeout(() => setSuccessMsg(false), 4000)
    } catch (err) {
      console.error('Failed to update settings:', err)
      setErrorMsg(err.message || 'Failed to update election settings.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetElection = async () => {
    if (resetting) return
    setResetting(true)

    try {
      await resetElectionData(clearCandidates)
      setShowResetModal(false)
      alert('Election data has been successfully reset! You can now start a fresh election.')
      window.location.reload()
    } catch (err) {
      console.error('Failed to reset election:', err)
      alert(err.message || 'Failed to reset election.')
    } finally {
      setResetting(false)
    }
  }

  if (loading) return <FullPageLoader message="Loading settings..." />

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="border-b border-emerald-500/15 pb-6">
        <h1 className="text-2xl font-extrabold text-white">Election Settings & Customization</h1>
        <p className="text-sm text-emerald-400/70 mt-1">
          Customize group branding, messaging templates, schedules, or reset for a new election
        </p>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-2xl p-4 text-emerald-300 text-sm flex items-center gap-3 animate-fade-in">
          <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
          <span>Election settings and schedule saved successfully!</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-500/15 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm flex items-center gap-3 animate-fade-in">
          <AlertTriangle size={20} className="text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="glass-card p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-org-name" className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2 flex items-center gap-1.5">
              <Building size={14} />
              Organization / Group Name
            </label>
            <input
              id="settings-org-name"
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g. Greenwood Residents Association"
              className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-3.5 text-white placeholder-gray-500 text-sm focus:border-emerald-400 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="settings-title-input" className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2">
              Election Title
            </label>
            <input
              id="settings-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Group Admin Election 2026"
              className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-3.5 text-white placeholder-gray-500 text-sm focus:border-emerald-400 transition-colors"
            />
          </div>
        </div>

        <div>
          <label htmlFor="settings-description-input" className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2">
            Description / Group Banner Message
          </label>
          <textarea
            id="settings-description-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instructions or rules displayed on the election landing page..."
            className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-3.5 text-white placeholder-gray-500 text-sm focus:border-emerald-400 transition-colors resize-none"
          />
        </div>

        {/* WhatsApp Message Template */}
        <div>
          <label htmlFor="settings-whatsapp-template" className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2 flex items-center gap-1.5">
            <MessageSquare size={14} />
            WhatsApp Message Template
          </label>
          <textarea
            id="settings-whatsapp-template"
            rows={4}
            value={whatsappTemplate}
            onChange={(e) => setWhatsappTemplate(e.target.value)}
            placeholder="Hi {voter_name}, here is your link: {link}"
            className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-3.5 text-white font-mono text-xs placeholder-gray-500 focus:border-emerald-400 transition-colors resize-none"
          />
          <p className="text-[11px] text-gray-400 mt-1.5">
            Placeholders available: <code>{'{voter_name}'}</code>, <code>{'{election_title}'}</code>, <code>{'{link}'}</code>
          </p>
        </div>

        {/* Schedule grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-emerald-500/15 pt-6">
          <div>
            <label htmlFor="settings-start-date-input" className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2 flex items-center gap-1.5">
              <Clock size={14} />
              Voting Start Date & Time
            </label>
            <input
              id="settings-start-date-input"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-3 text-white text-sm focus:border-emerald-400 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="settings-end-date-input" className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2 flex items-center gap-1.5">
              <Clock size={14} />
              Voting Closing Date & Time
            </label>
            <input
              id="settings-end-date-input"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-3 text-white text-sm focus:border-emerald-400 transition-colors"
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            id="save-settings-btn"
            type="submit"
            variant="primary"
            size="lg"
            className="w-full sm:w-auto min-w-[200px]"
            loading={submitting}
          >
            <Save size={18} />
            Save Election Settings
          </Button>
        </div>
      </form>

      {/* DANGER ZONE — Start New Election */}
      <div className="glass-card p-6 border-red-500/30 bg-red-500/5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
            <RefreshCw size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">Start a New Election</h3>
            <p className="text-xs text-red-300/80">
              Clear previous voters, ballots, and token hashes to reuse this app for a new group election.
            </p>
          </div>
        </div>

        <Button
          id="trigger-reset-election-btn"
          variant="danger"
          size="md"
          onClick={() => setShowResetModal(true)}
        >
          Reset Election Data
        </Button>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => !resetting && setShowResetModal(false)}
        title="Confirm Reset for New Election"
      >
        <div className="space-y-5">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
            <div className="text-xs text-red-200 leading-relaxed">
              <strong>Warning:</strong> This action will permanently delete all registered voters, anonymous submitted ballots, and vote attempts from the database.
            </div>
          </div>

          <div className="flex items-center gap-3 bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-4">
            <input
              id="clear-candidates-checkbox"
              type="checkbox"
              checked={clearCandidates}
              onChange={(e) => setClearCandidates(e.target.checked)}
              className="w-4 h-4 rounded bg-emerald-950 border-emerald-500/30 text-emerald-500 focus:ring-emerald-400"
            />
            <label htmlFor="clear-candidates-checkbox" className="text-sm text-gray-300 cursor-pointer">
              Also delete all candidates (check if starting completely fresh)
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={resetting}
              onClick={() => setShowResetModal(false)}
            >
              Cancel
            </Button>
            <Button
              id="confirm-reset-election-btn"
              variant="danger"
              size="md"
              className="flex-1"
              loading={resetting}
              onClick={handleResetElection}
            >
              Yes, Reset Everything
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
