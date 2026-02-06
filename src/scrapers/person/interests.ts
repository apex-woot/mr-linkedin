import type { Locator, Page } from 'playwright'
import { InterestPageExtractor } from '../../extraction/page-extractors'
import type { Interest } from '../../models'
import { log } from '../../utils/logger'
import { parseItems } from './common-patterns'
import {
  extractUniqueTextsFromElement,
  toPlainText,
} from './utils'

export async function getInterests(
  page: Page,
  baseUrl: string,
): Promise<Interest[]> {
  try {
    const extraction = await new InterestPageExtractor().extract({
      page,
      baseUrl,
    })
    if (extraction.kind !== 'list' || extraction.items.length === 0) {
      return []
    }

    const parsed = await parseItems(
      extraction.items.map((item) => item.locator),
      async (item, idx) =>
        await parseInterestItem(
          item,
          extraction.items[idx]?.context.category ?? 'unknown',
        ),
      { itemType: 'interest item' },
    )

    return parsed
  } catch (e) {
    log.warning(`Error getting interests: ${e}`)
    return []
  }
}

async function parseInterestItem(
  item: Locator,
  category: string,
): Promise<Interest | null> {
  try {
    const link = item.locator('a, link').first()
    if ((await link.count()) === 0) return null
    const href = (await link.getAttribute('href')) ?? undefined

    const uniqueTexts = await extractUniqueTextsFromElement(item)
    const name = uniqueTexts.length > 0 ? (uniqueTexts[0] ?? null) : null

    if (name && href)
      return {
        name,
        category,
        linkedinUrl: href,
        plainText: toPlainText(uniqueTexts),
      }
    return null
  } catch (e) {
    log.debug(`Error parsing interest: ${e}`)
    return null
  }
}
