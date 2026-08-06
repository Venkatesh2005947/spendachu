import { LoadingSpinner } from './LoadingSpinner'

const variants = {
  primary: `bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600
    text-white font-bold shadow-lg shadow-emerald-500/25
    hover:shadow-emerald-400/35 disabled:opacity-50`,
  secondary: `bg-white/10 hover:bg-white/15 active:bg-white/5
    text-white font-semibold border border-white/15
    hover:border-white/25 disabled:opacity-50`,
  danger: `bg-red-500/90 hover:bg-red-500 active:bg-red-600
    text-white font-bold disabled:opacity-50`,
  ghost: `bg-transparent hover:bg-white/8 active:bg-white/5
    text-emerald-400 font-semibold disabled:opacity-50`,
  outline: `bg-transparent border border-emerald-500/50 hover:border-emerald-400
    text-emerald-400 hover:text-emerald-300 font-semibold disabled:opacity-50`,
}

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-xl',
  md: 'px-6 py-3 text-base rounded-2xl',
  lg: 'px-8 py-4 text-lg rounded-2xl',
  xl: 'w-full px-8 py-4 text-lg rounded-2xl',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  id,
}) {
  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        transition-all duration-200 cursor-pointer
        select-none touch-manipulation
        ${variants[variant]}
        ${sizes[size]}
        ${(disabled || loading) ? 'cursor-not-allowed' : 'active:scale-[0.97]'}
        ${className}
      `}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  )
}
