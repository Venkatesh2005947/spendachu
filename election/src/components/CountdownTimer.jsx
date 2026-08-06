import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

function pad(n) {
  return String(n).padStart(2, '0')
}

function getTimeLeft(targetDate) {
  const now = new Date()
  const target = new Date(targetDate)
  const diff = target - now
  if (diff <= 0) return null
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return { days, hours, minutes, seconds }
}

export default function CountdownTimer({ targetDate, label = 'Closes in' }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate))
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  if (!timeLeft) return null

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-emerald-400/70 text-sm font-medium">
        <Clock size={14} />
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1">
        {timeLeft.days > 0 && (
          <>
            <TimeUnit value={timeLeft.days} unit="d" />
            <span className="text-emerald-500/50 font-bold text-lg">:</span>
          </>
        )}
        <TimeUnit value={timeLeft.hours} unit="h" />
        <span className="text-emerald-500/50 font-bold text-lg">:</span>
        <TimeUnit value={timeLeft.minutes} unit="m" />
        <span className="text-emerald-500/50 font-bold text-lg">:</span>
        <TimeUnit value={timeLeft.seconds} unit="s" />
      </div>
    </div>
  )
}

function TimeUnit({ value, unit }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-white font-bold text-lg leading-none font-mono">
        {pad(value)}
      </span>
      <span className="text-emerald-400/50 text-[10px] uppercase tracking-wider">{unit}</span>
    </div>
  )
}
