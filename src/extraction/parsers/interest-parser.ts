import type { Interest } from '../../models'
import { toPlainText } from '../../scrapers/person/utils'
import type { ParseInput, Parser } from './types'

export class InterestParser implements Parser<Interest> {
  readonly sectionName = 'interest'

  parse(input: ParseInput): Interest | null {
    const texts = input.texts.map((text) => text.trim()).filter(Boolean)
    const name = texts[0]
    if (!name) return null

    const linkedinUrl = input.links[0]?.url
    if (!linkedinUrl) return null

    return {
      name,
      category: input.context.category ?? 'unknown',
      linkedinUrl,
      plainText: toPlainText(texts),
    }
  }

  validate(item: Interest): boolean {
    return !!item.name && !!item.linkedinUrl
  }
}
