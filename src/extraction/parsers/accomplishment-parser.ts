import type { Accomplishment } from '../../models'
import { toPlainText } from '../../scrapers/person/utils'
import type { ParseInput, Parser } from './types'

export class AccomplishmentParser implements Parser<Accomplishment> {
  readonly sectionName = 'accomplishment'

  parse(input: ParseInput): Accomplishment | null {
    const texts = input.texts.map((text) => text.trim()).filter(Boolean)
    const title = texts[0]

    if (!title || title.length > 200) return null

    const category = input.context.category ?? 'unknown'
    let issuer: string | undefined
    let issuedDate: string | undefined
    let credentialId: string | undefined
    let description: string | undefined

    for (const text of texts.slice(1)) {
      if (text.includes('Issued by')) {
        const parts = text.split('·').map((part) => part.trim())
        issuer = parts[0]?.replace('Issued by', '').trim() || issuer
        issuedDate = parts[1] || issuedDate
        continue
      }

      if (text.startsWith('Issued ')) {
        issuedDate = text.replace('Issued ', '').trim() || issuedDate
        continue
      }

      if (text.startsWith('Credential ID')) {
        credentialId = text.replace('Credential ID', '').trim() || credentialId
        continue
      }

      if (!issuer) {
        issuer = text
        continue
      }

      if (!issuedDate && looksLikeDate(text)) {
        issuedDate = text.includes('·') ? text.split('·')[0]?.trim() || text : text
        continue
      }

      if (!description && looksLikeDescription(text)) description = text
    }

    const credentialUrl =
      input.links.find((link) => link.url.includes('credential') || link.url.includes('verify'))?.url ??
      input.links[0]?.url

    return {
      category,
      title,
      issuer,
      issuedDate,
      credentialId,
      credentialUrl,
      description,
      plainText: toPlainText(input.texts),
    }
  }

  validate(item: Accomplishment): boolean {
    return !!item.title && item.title.length <= 200
  }
}

function looksLikeDate(text: string): boolean {
  return /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(text)
}

function looksLikeDescription(text: string): boolean {
  return text.split(/\s+/).length > 8 || text.length > 80
}
