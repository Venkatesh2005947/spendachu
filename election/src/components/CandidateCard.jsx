import { CheckCircle2 } from 'lucide-react'

/**
 * Generate a consistent background color from a name string
 */
function nameToColor(name) {
  const colors = [
    'from-emerald-600 to-teal-700',
    'from-blue-600 to-indigo-700',
    'from-purple-600 to-violet-700',
    'from-orange-500 to-amber-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-sky-600',
    'from-lime-500 to-green-600',
    'from-fuchsia-500 to-purple-600',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name) {
  const words = name.trim().split(' ').filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

export default function CandidateCard({ candidate, selected, onSelect, disabled }) {
  const initials = getInitials(candidate.candidate_name)
  const colorClass = nameToColor(candidate.candidate_name)

  return (
    <button
      id={`candidate-${candidate.id}`}
      type="button"
      onClick={() => !disabled && onSelect(candidate.id)}
      disabled={disabled}
      className={`
        w-full text-left glass-card p-5 transition-all duration-200
        border-2 cursor-pointer touch-manipulation select-none
        active:scale-[0.98]
        ${selected
          ? 'candidate-card-selected border-emerald-500'
          : 'border-transparent hover:border-emerald-500/30 hover:bg-emerald-900/20'
        }
        ${disabled ? 'cursor-not-allowed opacity-60' : ''}
      `}
      aria-pressed={selected}
      aria-label={`Select ${candidate.candidate_name}`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className={`
          w-14 h-14 rounded-2xl bg-gradient-to-br ${colorClass}
          flex items-center justify-center flex-shrink-0
          shadow-lg text-white font-bold text-xl
          ${selected ? 'shadow-emerald-500/30' : ''}
        `}>
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-bold text-base leading-tight truncate">
              {candidate.candidate_name}
            </h3>
            {selected && (
              <CheckCircle2
                size={18}
                className="text-emerald-400 flex-shrink-0 animate-fade-in"
                fill="currentColor"
              />
            )}
          </div>
          {candidate.candidate_description && (
            <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">
              {candidate.candidate_description}
            </p>
          )}
        </div>
      </div>

      {/* Selected indicator bar */}
      {selected && (
        <div className="mt-4 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full animate-fade-in" />
      )}
    </button>
  )
}
