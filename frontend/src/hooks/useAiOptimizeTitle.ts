import { useState } from 'react'
import { optimizeItemTitle } from '@/lib/ai/gemini'

export interface UseAiOptimizeTitleReturn {
  suggestion: string | null
  loading: boolean
  error: string | null
  optimizeTitle: (itemTitle: string) => Promise<void>
  clearSuggestion: () => void
}

/**
 * Hook to manage AI title optimization
 * Handles loading, error states, and suggestion management
 */
export function useAiOptimizeTitle(): UseAiOptimizeTitleReturn {
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const optimizeTitle = async (itemTitle: string) => {
    setLoading(true)
    setError(null)
    setSuggestion(null)

    try {
      const optimized = await optimizeItemTitle(itemTitle)
      setSuggestion(optimized)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to optimize title'
      setError(message)
      setSuggestion(null)
    } finally {
      setLoading(false)
    }
  }

  const clearSuggestion = () => {
    setSuggestion(null)
    setError(null)
  }

  return {
    suggestion,
    loading,
    error,
    optimizeTitle,
    clearSuggestion,
  }
}
