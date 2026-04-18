import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { formatTimeout, isTimeoutPassed, ledgerToDate } from '@/lib/utils'
import { getCurrentLedger } from '@/lib/soroban/contract'
import { cn } from '@/lib/utils'

interface DealTimerCountdownProps {
  timeoutLedger: number
  className?: string
  /** Called when timeout transitions from pending → passed */
  onExpire?: () => void
}

export function DealTimerCountdown({
  timeoutLedger,
  className,
  onExpire,
}: DealTimerCountdownProps) {
  const [currentLedger, setCurrentLedger] = useState<number | null>(null)
  const [displayStr, setDisplayStr] = useState('Loading...')
  const [expired, setExpired] = useState(false)

  // Fetch current ledger on mount and every 30s
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    const poll = async () => {
      try {
        const ledger = await getCurrentLedger()
        setCurrentLedger(ledger)
      } catch {
        // silently ignore — display will say "Loading..."
      }
    }

    poll()
    interval = setInterval(poll, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Update display string every second using the ledger estimate
  useEffect(() => {
    if (currentLedger === null) return

    const tick = () => {
      const passed = isTimeoutPassed(timeoutLedger, currentLedger)
      if (passed) {
        setExpired(true)
        setDisplayStr('Timeout has passed')
        onExpire?.()
      } else {
        setDisplayStr(formatTimeout(timeoutLedger, currentLedger))
      }
    }

    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [currentLedger, timeoutLedger, onExpire])

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
