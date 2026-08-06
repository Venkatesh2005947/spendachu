import { useState, useEffect } from 'react'
import { Plus, UserCheck, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { getAllCandidates, addCandidate, updateCandidate, deleteCandidate } from '../../services/adminService'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import CandidateCard from '../../components/CandidateCard'
import { FullPageLoader } from '../../components/ui/LoadingSpinner'

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)

  // Add/Edit Modal
  const [showModal, setShowModal] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState(null) // null for add, object for edit
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCandidates()
  }, [])

  async function fetchCandidates() {
    try {
      const data = await getAllCandidates()
      setCandidates(data)
    } catch (err) {
      console.error('Error fetching candidates:', err)
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingCandidate(null)
    setName('')
    setDescription('')
    setIsActive(true)
    setShowModal(true)
  }

  const openEditModal = (candidate) => {
    setEditingCandidate(candidate)
    setName(candidate.candidate_name)
    setDescription(candidate.candidate_description || '')
    setIsActive(candidate.is_active)
    setShowModal(true)
  }

  const handleSaveCandidate = async (e) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)

    try {
      if (editingCandidate) {
        await updateCandidate(editingCandidate.id, {
          candidateName: name,
          candidateDescription: description,
          isActive,
        })
      } else {
        await addCandidate({
          candidateName: name,
          candidateDescription: description,
        })
      }
      setShowModal(false)
      fetchCandidates()
    } catch (err) {
      console.error('Failed to save candidate:', err)
      alert(err.message || 'Failed to save candidate.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCandidate = async (candidateId, candidateName) => {
    if (!confirm(`Are you sure you want to delete candidate "${candidateName}"?`)) return
    try {
      await deleteCandidate(candidateId)
      fetchCandidates()
    } catch (err) {
      console.error('Failed to delete candidate:', err)
      alert('Cannot delete a candidate who has already received votes.')
    }
  }

  if (loading) return <FullPageLoader message="Loading candidates list..." />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/15 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Manage Candidates</h1>
          <p className="text-sm text-emerald-400/70 mt-1">
            Add or edit election candidates and profiles
          </p>
        </div>

        <Button
          id="add-candidate-modal-trigger"
          variant="primary"
          size="md"
          onClick={openAddModal}
        >
          <Plus size={18} />
          Add Candidate
        </Button>
      </div>

      {/* Candidate list grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {candidates.length === 0 ? (
          <div className="md:col-span-2 glass-card p-12 text-center text-gray-400 text-sm">
            No candidates added yet. Click "Add Candidate" above to get started.
          </div>
        ) : (
          candidates.map((candidate) => (
            <div key={candidate.id} className="relative group">
              <CandidateCard
                candidate={candidate}
                selected={false}
                onSelect={() => {}}
                disabled={false}
              />

              {/* Action Toolbar */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={() => openEditModal(candidate)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                  title="Edit candidate"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDeleteCandidate(candidate.id, candidate.candidate_name)}
                  className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                  title="Delete candidate"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal for Add / Edit Candidate */}
      <Modal
        isOpen={showModal}
        onClose={() => !submitting && setShowModal(false)}
        title={editingCandidate ? 'Edit Candidate' : 'Add New Candidate'}
      >
        <form onSubmit={handleSaveCandidate} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2">
              Candidate Name
            </label>
            <input
              id="candidate-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ayyanar Raj"
              className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-3.5 text-white placeholder-gray-500 text-sm focus:border-emerald-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2">
              Description / Manifesto
            </label>
            <textarea
              id="candidate-description-input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of experience, goals, or why group members should vote for this candidate..."
              className="w-full bg-emerald-950/60 border border-emerald-500/20 rounded-2xl p-3.5 text-white placeholder-gray-500 text-sm focus:border-emerald-400 transition-colors resize-none"
            />
          </div>

          {editingCandidate && (
            <div className="flex items-center gap-3">
              <input
                id="candidate-active-checkbox"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded bg-emerald-950 border-emerald-500/30 text-emerald-500 focus:ring-emerald-400"
              />
              <label htmlFor="candidate-active-checkbox" className="text-sm text-gray-300">
                Active candidate (visible on voting ballot)
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={submitting}
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              id="submit-candidate-btn"
              type="submit"
              variant="primary"
              size="md"
              className="flex-1"
              loading={submitting}
            >
              {editingCandidate ? 'Save Changes' : 'Add Candidate'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
