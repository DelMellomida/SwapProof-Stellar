import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { formatDeadlineWithTime, isTimeoutPassed } from '@/lib/utils'
import { getCurrentLedger } from '@/lib/soroban/contract'
import { cn } from '@/lib/utils'

interface DealTimerCountdownProps {
  deadlineLedger: number
  className?: string
  passedLabel?: string
  onExpire?: () => void
}

export function DealTimerCountdown({
  deadlineLedger,
  className,
  passedLabel = 'Deadline has passed',
  onExpire,
}: DealTimerCountdownProps) {
  const [currentLedger, setCurrentLedger] = useState<number | null>(null)
  const [displayStr, setDisplayStr] = useState('Loading...')
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    const poll = async () => {
      try {
        const ledger = await getCurrentLedger()
        setCurrentLedger(ledger)
      } catch {
        // keep last display state
      }
    }

    void poll()
    interval = setInterval(() => {
      void poll()
    }, 30_000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (currentLedger === null) return

    const tick = () => {
      const passed = isTimeoutPassed(deadlineLedger, currentLedger)
      if (passed) {
        setExpired(true)
        setDisplayStr(passedLabel)
        onExpire?.()
      } else {
        setDisplayStr(formatDeadlineWithTime(deadlineLedger, currentLedger))
      }
    }

    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [currentLedger, deadlineLedger, onExpire, passedLabel])

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-sans',
        expired ? 'text-zinc-500' : 'text-muted-foreground',
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      {displayStr}
    </span>
  )
}
