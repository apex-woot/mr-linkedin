import type { Locator } from 'playwright'
import { log } from '../../utils/logger'

/**
 * Options for parsing items with standard error handling
 */
export interface ParseOptions<T> {
  /** Type of item being parsed (for logging) */
  itemType: string

  /** Optional predicate to skip items before parsing */
  shouldSkip?: (item: Locator, index: number) => Promise<boolean>

  /** Whether to log skipped items */
  logSkipped?: boolean

  /** Optional callback for successful parsing */
  onSuccess?: (item: T, index: number) => void

  /** Optional callback for parsing errors */
  onError?: (error: unknown, index: number) => void
}

/**
 * Parses a list of items with standard error handling.
 * Eliminates duplicated try-catch loops across all section scrapers.
 *
 * @param items - Array of Playwright Locators to parse
 * @param parser - Function that parses a single item (returns null to skip)
 * @param options - Configuration for parsing behavior
 * @returns Array of successfully parsed items
 *
 * @example
 * ```typescript
 * const patents = await parseItems(
 *   patentItems,
 *   parsePatentItem,
 *   { itemType: 'patent', logSkipped: true }
 * )
 * ```
 */
export async function parseItems<T>(
  items: Locator[],
  parser: (item: Locator, index: number) => Promise<T | null>,
  options: ParseOptions<T>,
): Promise<T[]> {
  const results: T[] = []

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    if (!item) continue

    try {
      // Check if this item should be skipped
      if (options.shouldSkip && (await options.shouldSkip(item, idx))) {
        if (options.logSkipped) log.skip(`Skipped ${options.itemType} at index ${idx}`)
        continue
      }

      // Parse the item
      const result = await parser(item, idx)
      if (result) {
        results.push(result)
        if (options.onSuccess) options.onSuccess(result, idx)
      }
    } catch (e) {
      log.debug(`Error parsing ${options.itemType} at index ${idx}: ${e}`)
      if (options.onError) options.onError(e, idx)
    }
  }

  return results
}

/**
 * Deduplicates items based on a key extractor function.
 *
 * @param items - Array of items to deduplicate
 * @param keyExtractor - Function that extracts a unique key from each item
 * @returns Deduplicated array (first occurrence of each key is kept)
 *
 * @example
 * ```typescript
 * const uniqueExperiences = deduplicateItems(
 *   experiences,
 *   (exp) => `${exp.company}|${exp.positions[0]?.title}`
 * )
 * ```
 */
export function deduplicateItems<T>(items: T[], keyExtractor: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyExtractor(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
