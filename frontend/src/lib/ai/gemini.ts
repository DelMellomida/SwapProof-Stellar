/**
 * Google Gemini AI integration for SwapProof
 * Uses free tier API for title optimization
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
  }>
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

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('No content in API response')
    }

    const optimizedTitle = data.candidates[0].content.parts[0].text.trim().replace(/^"|"$/g, '')
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

function enforceMaxTitleLength(title: string, maxLength: number): string {
  const normalized = title.trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  const truncated = normalized.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > 0 ? truncated.slice(0, lastSpace).trim() : truncated.trim()
}
