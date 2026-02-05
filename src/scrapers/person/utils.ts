import type { Locator } from 'playwright'
import { DATE_PATTERNS, SCRAPING_CONSTANTS } from '../../config/constants'

/**
 * Extracts unique text content from an element's children.
 * Useful for filtering out duplicate hidden text (e.g. accessibility labels).
 */
export async function extractUniqueTextsFromElement(
  element: Locator,
): Promise<string[]> {
  let textElements = await element
    .locator('span[aria-hidden="true"], div > span')
    .all()

  if (textElements.length === 0)
    textElements = await element.locator('span, div').all()

  const seenTexts = new Set<string>()
  const uniqueTexts: string[] = []

  for (const el of textElements) {
    const text = await el.textContent()
    if (text?.trim()) {
      const trimmed = text.trim()
      if (
        !seenTexts.has(trimmed) &&
        trimmed.length < 200 &&
        !Array.from(seenTexts).some(
          (t) =>
            (t.length > 3 && trimmed.includes(t)) ||
            (trimmed.length > 3 && t.includes(trimmed)),
        )
      ) {
        seenTexts.add(trimmed)
        uniqueTexts.push(trimmed)
      }
    }
  }

  return uniqueTexts
}

export interface DateParseResult {
  fromDate: string | null
  toDate: string | null
  duration?: string | null
}

export function parseDateRange(
  dateString: string,
  options: { includeDuration?: boolean } = {},
): DateParseResult {
  if (!dateString) {
    const result: DateParseResult = { fromDate: null, toDate: null }
    if (options.includeDuration) {
      result.duration = null
    }
    return result
  }

  try {
    let dateRangePart = dateString
    let duration: string | null = null

    // Extract duration if requested (e.g., "Jan 2020 - Present · 1 yr 2 mos")
    if (options.includeDuration && dateString.includes('·')) {
      const parts = dateString.split('·')
      dateRangePart = parts[0]?.trim() ?? ''
      duration = parts[1]?.trim() ?? null
    }

    // Parse date range (e.g., "Jan 2020 - Present" or "2018 - 2020")
    let fromDate: string | null = null
    let toDate: string | null = null

    if (dateRangePart.includes(' - ')) {
      const dateParts = dateRangePart.split(' - ')
      fromDate = dateParts[0]?.trim() ?? null
      toDate = dateParts[1]?.trim() ?? null

      // Normalize "current" keywords to standard "Present"
      if (toDate) {
        for (const keyword of DATE_PATTERNS.CURRENT_KEYWORDS) {
          if (toDate === keyword || toDate.toLowerCase() === keyword.toLowerCase()) {
            toDate = 'Present'
            break
          }
        }
      }
    } else {
      // Single date (common in education: "2020")
      const singleDate = dateRangePart.trim()
      fromDate = singleDate || null
      // For education (no duration), single year means both from and to
      // For work (with duration), single date means only fromDate
      toDate = options.includeDuration ? null : singleDate || null
    }

    const result: DateParseResult = { fromDate, toDate }
    if (options.includeDuration) {
      result.duration = duration
    }
    return result
  } catch (e) {
    console.debug(`Error parsing date range '${dateString}': ${e}`)
    const result: DateParseResult = { fromDate: null, toDate: null }
    if (options.includeDuration) {
      result.duration = null
    }
    return result
  }
}

/**
 * @deprecated Use parseDateRange() with includeDuration option instead
 */
export function parseWorkTimes(workTimes: string): {
  fromDate: string | null
  toDate: string | null
  duration: string | null
} {
  const result = parseDateRange(workTimes, { includeDuration: true })
  return {
    fromDate: result.fromDate,
    toDate: result.toDate,
    duration: result.duration ?? null,
  }
}

/**
 * @deprecated Use parseDateRange() without options instead
 */
export function parseEducationTimes(times: string): {
  fromDate: string | null
  toDate: string | null
} {
  const result = parseDateRange(times)
  return { fromDate: result.fromDate, toDate: result.toDate }
}

export function mapInterestTabToCategory(tabName: string): string {
  const tabLower = tabName.toLowerCase()
  if (tabLower.includes('compan')) return 'company'
  if (tabLower.includes('group')) return 'group'
  if (tabLower.includes('school')) return 'school'
  if (tabLower.includes('newsletter')) return 'newsletter'
  if (tabLower.includes('voice') || tabLower.includes('influencer'))
    return 'influencer'
  return tabLower
}

export function mapContactHeadingToType(heading: string): string | null {
  const lower = heading.toLowerCase()
  if (lower.includes('profile')) return 'linkedin'
  if (lower.includes('website')) return 'website'
  if (lower.includes('email')) return 'email'
  if (lower.includes('phone')) return 'phone'
  if (lower.includes('twitter') || lower.includes('x.com')) return 'twitter'
  if (lower.includes('birthday')) return 'birthday'
  if (lower.includes('address')) return 'address'
  return null
}

/**
 * Determines if a text string looks like a date line (with dates, duration, or "Present").
 * Used to differentiate date lines from location or description text.
 */
export function isDateLine(text: string): boolean {
  const hasDateSeparator = text.includes(DATE_PATTERNS.DATE_RANGE_SEPARATOR)
  const hasCurrentKeyword = DATE_PATTERNS.CURRENT_KEYWORDS.some((kw) =>
    text.includes(kw),
  )
  const hasDuration = DATE_PATTERNS.DURATION_REGEX.test(text)
  const hasYear = DATE_PATTERNS.YEAR_REGEX.test(text)
  return (hasDateSeparator || hasCurrentKeyword) && (hasDuration || hasYear)
}

/**
 * Determines if a text string looks like a location (short, no numbers, no duration separator).
 */
export function isLocationLike(text: string): boolean {
  return (
    text.length < SCRAPING_CONSTANTS.MAX_LOCATION_LENGTH &&
    !text.includes(DATE_PATTERNS.DURATION_SEPARATOR) &&
    !/\d/.test(text) &&
    text.split(/\s+/).length <= SCRAPING_CONSTANTS.MAX_LOCATION_WORD_COUNT
  )
}

/**
 * Determines if a text string looks like a description (long text with many words).
 */
export function isDescriptionLike(text: string): boolean {
  return (
    text.split(/\s+/).length > SCRAPING_CONSTANTS.MIN_DESCRIPTION_WORD_COUNT ||
    text.length > SCRAPING_CONSTANTS.MIN_DESCRIPTION_LENGTH
  )
}
