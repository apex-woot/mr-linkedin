import type { Locator } from 'playwright'

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

/**
 * Parses a work duration string like "Jan 2020 - Present · 1 yr 2 mos"
 */
export function parseWorkTimes(workTimes: string): {
  fromDate: string | null
  toDate: string | null
  duration: string | null
} {
  if (!workTimes) return { fromDate: null, toDate: null, duration: null }

  try {
    const parts = workTimes.split('·')
    const times = parts.length > 0 ? (parts[0]?.trim() ?? '') : ''
    const duration = parts.length > 1 ? (parts[1]?.trim() ?? null) : null

    let fromDate: string | null = null
    let toDate: string | null = null

    if (times?.includes(' - ')) {
      const dateParts = times.split(' - ')
      fromDate = dateParts[0]?.trim() ?? null
      toDate = dateParts.length > 1 ? (dateParts[1]?.trim() ?? null) : null
    } else {
      fromDate = times || null
      toDate = null
    }

    return { fromDate, toDate, duration }
  } catch (e) {
    console.debug(`Error parsing work times '${workTimes}': ${e}`)
    return { fromDate: null, toDate: null, duration: null }
  }
}

/**
 * Parses education time strings.
 */
export function parseEducationTimes(times: string): {
  fromDate: string | null
  toDate: string | null
} {
  if (!times) return { fromDate: null, toDate: null }

  try {
    if (times.includes(' - ')) {
      const parts = times.split(' - ')
      const fromDate = parts[0]?.trim() ?? null
      const toDate = parts.length > 1 ? (parts[1]?.trim() ?? null) : null
      return { fromDate, toDate }
    } else {
      const year = times.trim()
      return { fromDate: year, toDate: year }
    }
  } catch (e) {
    console.debug(`Error parsing education times '${times}': ${e}`)
    return { fromDate: null, toDate: null }
  }
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
