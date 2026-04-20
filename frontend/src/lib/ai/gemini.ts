/**
 * Google Gemini AI integration for SwapProof
 * Uses free tier API for title optimization
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
  }>
}

function extractCandidateText(data: GeminiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const combined = parts
    .map((part) => part.text?.trim())
    .filter((text): text is string => Boolean(text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!combined) {
    throw new Error('No content in API response')
  }

  return combined
}

function sanitizeModelText(text: string): string {
  return text
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\s+/g, ' ')
}

function isCredibilitySummaryUsable(text: string): boolean {
  const normalized = text.trim()
  const words = normalized.split(/\s+/).filter(Boolean)
  const hasSentenceEnding = /[.!?]/.test(normalized)
  const hasActionCue = /(wait|verify|confirm|review|claim|check|avoid|proceed)/i.test(normalized)
  const hasUrgencyCue = /(deadline|urgency|expires|window|remaining|time)/i.test(normalized)
  const genericOnly = /^(the seller|seller wallet)\.?$/i.test(normalized)

  return (
    !genericOnly &&
    words.length >= 20 &&
    normalized.length >= 110 &&
    hasSentenceEnding &&
    hasActionCue &&
    hasUrgencyCue
  )
}

async function callGeminiText(prompt: string, maxOutputTokens: number, temperature: number): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set VITE_GEMINI_API_KEY in .env.local')
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens,
        temperature,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`)
  }

  const data = (await response.json()) as GeminiResponse
  return sanitizeModelText(extractCandidateText(data))
}

export interface SellerCredibilitySummaryInput {
  sellerAddress: string
  dealStatus: 'PendingPayment' | 'FundedAwaitingShipment' | 'ShippedAwaitingReceipt'
  itemName: string
  escrowAmountXlm: string
  shippingUrgency: string
  buyerReviewUrgency: string
  tierLabel: string
  reasons: string[]
}

export function isGeminiConfigured(): boolean {
  return Boolean(GEMINI_API_KEY)
}

/**
 * Call Gemini API to optimize an item title for e-commerce
 * @param itemTitle - Raw item title from user
 * @returns Optimized title suggestion
 */
export async function optimizeItemTitle(itemTitle: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set VITE_GEMINI_API_KEY in .env.local')
  }

  if (!itemTitle.trim()) {
    throw new Error('Item title cannot be empty')
  }

  const prompt = `You are an e-commerce expert. Optimize this item title to make it more attractive and searchable. 
Title: "${itemTitle}"

Rules:
- Keep it under 80 characters
- Include key details (brand, model, condition, specs if applicable)
- Make it catchy but professional
- Use proper capitalization

Respond with ONLY the optimized title, no explanation or quotes.`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 50,
          temperature: 0.7,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = (await response.json()) as GeminiResponse
    const optimizedTitle = sanitizeModelText(extractCandidateText(data))
    const safeTitle = enforceMaxTitleLength(optimizedTitle, 80)

    if (!safeTitle) {
      throw new Error('Gemini returned an invalid title')
    }

    return safeTitle
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to optimize title with AI')
  }
}

export async function generateSellerCredibilitySummary(
  input: SellerCredibilitySummaryInput,
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set VITE_GEMINI_API_KEY in .env.local')
  }

  const basePrompt = `You are assisting a buyer in an escrow app.

You must summarize seller credibility using ONLY these provided facts:
- Seller wallet: ${input.sellerAddress}
- Deal status: ${input.dealStatus}
- Item: ${input.itemName}
- Escrow amount: ${input.escrowAmountXlm} XLM
- Tier: ${input.tierLabel}
- Reasons: ${input.reasons.join(' | ')}
- Shipping urgency: ${input.shippingUrgency}
- Buyer review urgency: ${input.buyerReviewUrgency}

Rules:
- Never claim identity verification or guaranteed trust.
- Never invent historical reputation not in the facts above.
- Keep language cautious and practical for buyer decisions.
- Mention that signals are limited to on-chain and wallet activity context.

Required format:
Signal: one concise sentence explaining the current credibility signal from facts.
Action: one concise sentence with the buyer's safest next step.
Urgency: one concise sentence mentioning the active deadline/window urgency.

Write 3 sentences total, between 30 and 65 words total, and avoid generic phrases like "the seller" alone.`

  const retryPrompt = `${basePrompt}

Regenerate with stronger specificity:
- Include at least one concrete reason from the provided Reasons list.
- Include either "shipping deadline" or "review window" explicitly.
- Do not output fragments or sentence prefixes.`

  try {
    let summary = await callGeminiText(basePrompt, 220, 0.45)

    if (!isCredibilitySummaryUsable(summary)) {
      summary = await callGeminiText(retryPrompt, 220, 0.5)
    }

    if (!isCredibilitySummaryUsable(summary)) {
      throw new Error('Gemini returned a low-quality credibility summary')
    }

    return summary
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to generate seller credibility summary')
  }
}

function enforceMaxTitleLength(title: string, maxLength: number): string {
  const normalized = title.trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  const truncated = normalized.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > 0 ? truncated.slice(0, lastSpace).trim() : truncated.trim()
}
