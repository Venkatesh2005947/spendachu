import { useState, useEffect } from 'react'
import { Plus, Copy, Check, Trash2, Search, Share2, ShieldCheck, MessageSquare } from 'lucide-react'
import { getVoters, addVoter, deleteVoter } from '../../services/adminService'
import { getElectionSettings } from '../../services/electionService'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { FullPageLoader } from '../../components/ui/LoadingSpinner'

export default function VotersPage() {
  const [voters, setVoters] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Add voter modal & state
  const [showAddModal, setShowAddModal] = useState(false)
  const [newVoterName, setNewVoterName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Generated Link Modal state
  const [generatedLinkData, setGeneratedLinkData] = useState(null) // { voterName, link }
  const [copiedVoterId, setCopiedVoterId] = useState(null)

  useEffect(() => {
    fetchVotersAndSettings()
  }, [])

  async function fetchVotersAndSettings() {
    try {
      const [votersData, settingsData] = await Promise.all([
        getVoters(),
        getElectionSettings().catch(() => null),
      ])
      setVoters(votersData)
      setSettings(settingsData)
    } catch (err) {
      console.error('Error fetching voters:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddVoter = async (e) => {
    e.preventDefault()
    if (!newVoterName.trim() || submitting) return
    setSubmitting(true)

    try {
      const { voter, rawToken } = await addVoter(newVoterName)
      const link = `${window.location.origin}/vote/${rawToken}`

      setGeneratedLinkData({
        voterName: voter.voter_name,
        link,
      })

      setNewVoterName('')
      setShowAddModal(false)
      fetchVotersAndSettings()
    } catch (err) {
      console.error('Failed to add voter:', err)
      alert(err.message || 'Failed to add voter.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteVoter = async (voterId, name) => {
    if (!confirm(`Are you sure you want to remove voter "${name}"?`)) return
    try {
      await deleteVoter(voterId)
      fetchVotersAndSettings()
    } catch (err) {
      console.error('Failed to delete voter:', err)
      alert('Cannot delete voter who has already voted.')
    }
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedVoterId(id)
    setTimeout(() => setCopiedVoterId(null), 2500)
  }

  const getFormattedMessage = (voterName, link) => {
    const template = settings?.whatsapp_message_template || 'Hi {voter_name},\n\nHere is your private one-time link to vote in our {election_title}:\n\n{link}\n\nYour vote is 100% secret and anonymous.'
    const title = settings?.election_title || 'Group Election'
    return template
      .replace(/\{voter_name\}/g, voterName)
      .replace(/\{election_title\}/g, title)
      .replace(/\{link\}/g, link)
  }

  const shareToWhatsApp = (voterName, link) => {
    const text = getFormattedMessage(voterName, link)
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const filteredVoters = voters.filter(v =>
    v.voter_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <FullPageLoader message="Loading registered voters..." />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/15 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Voter Management</h1>
          <p className="text-sm text-emerald-400/70 mt-1">
            Generate one-time private voting links & monitor participation status
          </p>
        </div>

        <Button
          id="add-voter-modal-trigger"
          variant="primary"
          size="md"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={18} />
          Add New Voter
        </Button>
      </div>

      {/* Security Privacy Notice */}
      <div className="bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 text-xs text-emerald-200">
        <ShieldCheck size={20} className="shrink-0 text-emerald-400" />
        <span>
          <strong>Admin Privacy Notice:</strong> You can only see whether each voter has <strong>Voted</strong> or <strong>Not Voted</strong>. There is no database link between a voter and their candidate selection.
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-4 flex items-center gap-3">
        <Search className="text-gray-400 shrink-0" size={18} />
        <input
          id="voter-search-input"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search voter name..."
          className="bg-transparent w-full text-white placeholder-gray-500 text-sm focus:outline-none"
        />
      </div>

      {/* Voters List Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-emerald-500/15 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-400/80">
          <span>Voter Name</span>
          <span>Participation Status</span>
        </div>

        {filteredVoters.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {search ? 'No voters match your search.' : 'No voters added yet. Click "Add New Voter" to begin.'}
          </div>
        ) : (
          <div className="divide-y divide-emerald-500/10">
            {filteredVoters.map((voter) => (
              <div key={voter.id} className="p-4 flex items-center justify-between gap-4 hover:bg-emerald-900/10 transition-colors">
                <div>
                  <h3 className="text-white font-semibold text-base">{voter.voter_name}</h3>
                  <span className="text-xs text-gray-400">
                    Added {new Date(voter.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Badge */}
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${voter.has_voted ? 'badge-voted' : 'badge-not-voted'}`}>
                    {voter.has_voted ? '✓ Voted' : '⏳ Not Voted'}
                  </span>

                  {/* Delete button (only if not voted) */}
                  {!voter.has_voted && (
                    <button
                      onClick={() => handleDeleteVoter(voter.id, voter.voter_name)}
                      className="p-2 text-gray-400 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-colors"
                      title="Remove voter"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Voter Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => !submitting && setShowAddModal(false)}
        title="Add New Voter"
      >
        <form onSubmit={handleAddVoter} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2">
              Voter Full Name
            </label>
            <input
              id="voter-name-input"
              type="text"
              required
              value={newVoterName}
              onChange={(e) => setNewVoterName(e.target.value)}
              placeholder="e.g. Ayyanar Raj"
              className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-3.5 text-white placeholder-gray-500 text-sm focus:border-emerald-400 transition-colors"
            />
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Adding a voter generates a unique 64-character token hash in the database. The raw voting link is created once for you to copy and send via WhatsApp.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={submitting}
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              id="submit-add-voter-btn"
              type="submit"
              variant="primary"
              size="md"
              className="flex-1"
              loading={submitting}
            >
              Generate Voting Link
            </Button>
          </div>
        </form>
      </Modal>

      {/* Generated Link Popup Modal */}
      <Modal
        isOpen={!!generatedLinkData}
        onClose={() => setGeneratedLinkData(null)}
        title="Private Voting Link Ready"
      >
        {generatedLinkData && (
          <div className="space-y-5">
            <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-4">
              <span className="text-xs text-emerald-400/70 font-semibold block mb-1">Voter</span>
              <h3 className="text-white font-bold text-lg">{generatedLinkData.voterName}</h3>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2 flex items-center justify-between">
                <span>Message Preview</span>
                <span className="text-[10px] text-gray-400 font-normal">Dynamic template</span>
              </label>
              <div className="bg-emerald-950/80 border border-emerald-500/20 rounded-2xl p-3 text-xs text-emerald-300 font-mono whitespace-pre-wrap break-all">
                {getFormattedMessage(generatedLinkData.voterName, generatedLinkData.link)}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => copyToClipboard(getFormattedMessage(generatedLinkData.voterName, generatedLinkData.link), 'modal')}
              >
                {copiedVoterId === 'modal' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                {copiedVoterId === 'modal' ? 'Copied Message!' : 'Copy Message'}
              </Button>

              <Button
                variant="primary"
                size="md"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                onClick={() => shareToWhatsApp(generatedLinkData.voterName, generatedLinkData.link)}
              >
                <Share2 size={16} />
                Send via WhatsApp
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
