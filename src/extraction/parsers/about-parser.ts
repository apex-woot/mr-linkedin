import type { ParseInput, Parser } from './types'

export class AboutParser implements Parser<string> {
  readonly sectionName = 'about'

  parse(input: ParseInput): string | null {
    const texts = input.texts
      .map((text) => text.trim())
      .filter(Boolean)
      .filter((text) => text.toLowerCase() !== 'about')

    if (texts.length === 0) return null

    return texts.join('\n').trim() || null
  }

  validate(item: string): boolean {
    return item.length > 0
  }
}
