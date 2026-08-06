export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }
  return (
    <div
      className={`${sizes[size]} rounded-full border-emerald-900 border-t-emerald-400 animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}

export function FullPageLoader({ message = 'Loading…' }) {
  return (
    <div className="vote-bg flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
        <span className="text-2xl">🗳️</span>
      </div>
      <LoadingSpinner size="md" />
      <p className="text-emerald-400/70 text-sm font-medium">{message}</p>
    </div>
  )
}
