import type { Experience, Position } from '../../models/person'
import { isDateLine, isDescriptionLike, isLocationLike, parseDateRange, toPlainText } from '../../scrapers/person/utils'
import type { ExtractedLink } from '../text-extractors'
import type { ParseInput, Parser } from './types'

export class ExperienceParser implements Parser<Experience> {
  readonly sectionName = 'experience'

  parse(input: ParseInput): Experience | null {
    const texts = input.texts.map((t) => t.trim()).filter(Boolean)
    if (texts.length === 0) return null

    if (input.subItems && input.subItems.length > 0) {
      const company = texts[0] ?? undefined
      const positions = input.subItems
        .map((subItem) => parsePosition(subItem.texts))
        .filter((position): position is Position => !!position)

      if (positions.length === 0) return null

      return {
        company,
        companyUrl: input.links[0]?.url,
        plainText: toPlainText(input.texts),
        positions,
      }
    }

    const parsed = parseSingleExperience(texts, input.links)
    if (!parsed) return null

    return {
      company: parsed.company,
      companyUrl: input.links[0]?.url,
      plainText: toPlainText(input.texts),
      positions: [parsed.position],
    }
  }

  validate(item: Experience): boolean {
    if (!item.positions || item.positions.length === 0) return false

    const primary = item.positions[0]
    const hasPositionSignal = !!primary?.title || !!primary?.fromDate || !!primary?.location || !!primary?.description

    return !!item.company || hasPositionSignal
  }
}

function parseSingleExperience(
  texts: string[],
  links: ExtractedLink[],
): { company?: string; position: Position } | null {
  const title = texts[0]
  if (!title) return null

  const second = texts[1] ?? ''
  let company = second || undefined
  let employmentType: string | undefined

  if (second.includes(' · ') && !isDateLine(second)) {
    const parts = second.split(' · ').map((part) => part.trim())
    company = parts[0] || undefined
    employmentType = parts[1] || undefined
  }

  const meta = extractMeta(texts.slice(2))

  const position: Position = {
    title,
    employmentType,
    fromDate: meta.fromDate,
    toDate: meta.toDate,
    duration: meta.duration,
    location: meta.location,
    description: meta.description,
    plainText: toPlainText(texts),
  }

  return {
    company: company || links[0]?.text || undefined,
    position,
  }
}

function parsePosition(texts: string[]): Position | null {
  const lines = texts.map((t) => t.trim()).filter(Boolean)
  if (lines.length === 0) return null

  const title = lines[0]
  let employmentType: string | undefined

  if (lines[1] && !isDateLine(lines[1]) && !isLocationLike(lines[1])) employmentType = lines[1]

  const metaStart = employmentType ? 2 : 1
  const meta = extractMeta(lines.slice(metaStart))

  return {
    title,
    employmentType,
    fromDate: meta.fromDate,
    toDate: meta.toDate,
    duration: meta.duration,
    location: meta.location,
    description: meta.description,
    plainText: toPlainText(lines),
  }
}

function extractMeta(lines: string[]): {
  fromDate?: string
  toDate?: string
  duration?: string
  location?: string
  description?: string
} {
  let fromDate: string | undefined
  let toDate: string | undefined
  let duration: string | undefined
  let location: string | undefined
  let description: string | undefined

  for (const line of lines) {
    if (!fromDate && isDateLine(line)) {
      const parsed = parseDateRange(line, { includeDuration: true })
      fromDate = parsed.fromDate ?? undefined
      toDate = parsed.toDate ?? undefined
      duration = parsed.duration ?? undefined
      continue
    }

    if (!location && isLocationLike(line)) {
      location = line
      continue
    }

    if (!description && isDescriptionLike(line)) description = line
  }

  return {
    fromDate,
    toDate,
    duration,
    location,
    description,
  }
}
