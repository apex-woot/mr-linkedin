import type { Patent } from '../../models/person'
import { normalizePlainTextLines, toPlainText } from '../../scrapers/person/utils'
import type { ParseInput, Parser } from './types'

export class PatentParser implements Parser<Patent> {
  readonly sectionName = 'patent'

  parse(input: ParseInput): Patent | null {
    const lines = normalizePlainTextLines(input.texts)

    if (lines.length === 1 && lines[0] === 'Patents') return null
    if (lines.some((line) => line.includes('adds will appear here'))) return null
    if (lines.length === 0) return null

    const title = lines[0]
    if (!title) return null

    let issuer: string | undefined
    let number: string | undefined
    let issuedDate: string | undefined
    let description: string | undefined

    const metadataLine = lines.slice(1).find(looksLikePatentMetadataLine)
    if (metadataLine) {
      const parsed = parsePatentSubtitle(metadataLine)
      issuer = parsed.issuer
      number = parsed.number
      issuedDate = parsed.issuedDate
    }

    const descriptionLines = lines
      .slice(1)
      .filter((line) => line !== metadataLine && !looksLikePatentMetadataLine(line))
    if (descriptionLines.length > 0) description = descriptionLines.join('\n')

    const url = input.links
      .filter((link) => {
        const text = link.text.toLowerCase()
        return text.includes('show patent') || link.url.includes('patent')
      })
      .map((link) => decodeLinkedInRedirect(link.url))
      .at(0)

    return {
      title,
      issuer,
      number,
      issuedDate,
      url,
      description,
      plainText: toPlainText(lines),
    }
  }

  validate(item: Patent): boolean {
    return !!item.title && item.title.length <= 300
  }
}

function looksLikePatentMetadataLine(line: string): boolean {
  const normalized = line.trim()
  if (!normalized) return false

  if (/\bissued\b/i.test(normalized)) return true

  const idLike = /^[A-Z]{2}\s+[A-Z0-9,\-]+(?:\s+[A-Z0-9,\-]+)*$/.test(normalized)
  return idLike && /\d/.test(normalized)
}

function parsePatentSubtitle(subtitle: string): {
  issuer?: string
  number?: string
  issuedDate?: string
} {
  let issuer: string | undefined
  let number: string | undefined
  let issuedDate: string | undefined

  try {
    const parts = subtitle.split('·').map((s) => s.trim())
    const idPart = parts[0]

    if (idPart) {
      if (idPart.toLowerCase().startsWith('issued')) issuedDate = idPart.replace(/issued/i, '').trim() || issuedDate
      else {
        const match = idPart.match(/^([A-Z]{2})\s+(.+)$/)
        if (match) {
          issuer = match[1]
          number = match[2]
        } else {
          number = idPart
        }
      }
    }

    const datePart = parts[1]
    if (datePart) {
      if (datePart.toLowerCase().startsWith('issued')) issuedDate = datePart.replace(/issued/i, '').trim() || issuedDate
      else {
        issuedDate = datePart
      }
    }
  } catch {
    // Ignore malformed subtitles.
  }

  return { issuer, number, issuedDate }
}

function decodeLinkedInRedirect(url: string): string {
  if (!url.includes('linkedin.com/redir/redirect')) return url

  const match = url.match(/url=([^&]+)/)
  if (!match?.[1]) return url

  try {
    return decodeURIComponent(match[1])
  } catch {
    return url
  }
}
