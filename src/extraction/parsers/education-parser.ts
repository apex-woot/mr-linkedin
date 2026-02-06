import type { Education } from '../../models'
import { parseDateRange, toPlainText } from '../../scrapers/person/utils'
import type { ParseInput, Parser } from './types'

export class EducationParser implements Parser<Education> {
  readonly sectionName = 'education'

  parse(input: ParseInput): Education | null {
    const texts = input.texts.map((t) => t.trim()).filter(Boolean)
    if (texts.length === 0) return null

    const institutionName = texts[0] ?? ''
    if (!institutionName) return null

    let degree: string | undefined
    let dateStr = ''

    if (texts.length >= 3) {
      degree = texts[1] || undefined
      dateStr = texts[2] ?? ''
    } else if (texts.length === 2) {
      const second = texts[1] ?? ''
      if (second.includes(' - ') || /\d/.test(second)) dateStr = second
      else {
        degree = second || undefined
      }
    }

    const { fromDate, toDate } = parseDateRange(dateStr)
    const description = texts.length > 3 ? texts.slice(3).join('\n').trim() || undefined : undefined

    return {
      institutionName,
      degree: degree?.trim() || undefined,
      linkedinUrl: input.links[0]?.url,
      fromDate: fromDate ?? undefined,
      toDate: toDate ?? undefined,
      description,
      plainText: toPlainText(texts),
    }
  }

  validate(item: Education): boolean {
    return !!item.institutionName && item.institutionName.length > 0
  }
}
