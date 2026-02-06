import type { ParseInput, Parser } from './types'

export interface TopCardResult {
  name: string
  headline: string | null
  origin: string | null
}

export class TopCardParser implements Parser<TopCardResult> {
  readonly sectionName = 'top-card'

  parse(input: ParseInput): TopCardResult | null {
    const texts = input.texts.map((text) => text.trim()).filter(Boolean)
    if (texts.length === 0) return null

    const name = texts[0] ?? 'Unknown'
    const headline = texts.length > 1 ? (texts[1] ?? null) : null
    let origin = texts.length > 2 ? (texts[2] ?? null) : null

    if (origin) origin = origin.replace(/\bContact info\b.*/i, '').trim() || null

    return {
      name,
      headline: headline === name ? null : headline,
      origin,
    }
  }

  validate(item: TopCardResult): boolean {
    return !!item.name && item.name !== 'Unknown'
  }
}
