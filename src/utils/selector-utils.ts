import type { Locator, Page } from 'playwright'
import type { SelectorGroup } from '../config/selectors'
import { log } from './logger'

/**
 * Result from attempting to find an element with multiple selectors
 */
export interface SelectorResult<T> {
  /** The value extracted/found */
  value: T
  /** Which selector succeeded */
  usedSelector: string
  /** Whether this was from primary or fallback selectors */
  usedFallback: boolean
}

/**
 * Tries multiple selectors in order until one succeeds
 *
 * @param page Playwright page
 * @param selectorGroup Group of selectors to try
 * @param validator Optional function to validate the result
 * @returns The first locator that exists, or null
 */
export async function trySelectors(
  page: Page,
  selectorGroup: SelectorGroup,
  validator?: (locator: Locator) => Promise<boolean>,
): Promise<SelectorResult<Locator | null>> {
  // Try primary selectors first
  for (const config of selectorGroup.primary) {
    const locator = page.locator(config.selector).first()
    const count = await locator.count()

    if (count > 0) {
      // If validator provided, check if result is valid
      if (validator && !(await validator(locator))) {
        continue
      }

      log.debug(
        `Found element with primary selector: ${config.selector}${config.description ? ` (${config.description})` : ''}`,
      )
      return {
        value: locator,
        usedSelector: config.selector,
        usedFallback: false,
      }
    }
  }

  // Try fallback selectors if primary failed
  if (selectorGroup.fallback) {
    for (const config of selectorGroup.fallback) {
      const locator = page.locator(config.selector).first()
      const count = await locator.count()

      if (count > 0) {
        if (validator && !(await validator(locator))) {
          continue
        }

        log.debug(
          `Using fallback selector: ${config.selector}${config.description ? ` (${config.description})` : ''}`,
        )
        return {
          value: locator,
          usedSelector: config.selector,
          usedFallback: true,
        }
      }
    }
  }

  log.debug(`No selector found in group`)
  return { value: null, usedSelector: '', usedFallback: false }
}

/**
 * Tries multiple selectors and extracts text from the first that succeeds
 *
 * @param page Playwright page
 * @param selectorGroup Group of selectors to try
 * @param defaultValue Default value if no selector succeeds
 * @param timeout Timeout for text extraction
 * @returns Extracted text and which selector was used
 */
export async function trySelectorsForText(
  page: Page,
  selectorGroup: SelectorGroup,
  defaultValue: string = '',
  timeout: number = 2000,
): Promise<SelectorResult<string>> {
  const result = await trySelectors(page, selectorGroup, async (locator) => {
    try {
      const text = await locator.textContent({ timeout: 1000 })
      return !!text?.trim()
    } catch {
      return false
    }
  })

  if (!result.value) {
    return {
      value: defaultValue,
      usedSelector: '',
      usedFallback: false,
    }
  }

  try {
    const text = await result.value.textContent({ timeout })
    return {
      value: text?.trim() || defaultValue,
      usedSelector: result.usedSelector,
      usedFallback: result.usedFallback,
    }
  } catch {
    return {
      value: defaultValue,
      usedSelector: result.usedSelector,
      usedFallback: result.usedFallback,
    }
  }
}

/**
 * Tries multiple selectors and gets all matching elements from the first that succeeds
 *
 * @param page Playwright page
 * @param selectorGroup Group of selectors to try
 * @returns Array of locators and which selector was used
 */
export async function trySelectorsForAll(
  page: Page,
  selectorGroup: SelectorGroup,
  minCount: number = 1,
): Promise<SelectorResult<Locator[]>> {
  const requiredCount = Math.max(1, minCount)

  // Try primary selectors first
  for (const config of selectorGroup.primary) {
    const locators = await page.locator(config.selector).all()

    if (locators.length >= requiredCount) {
      log.debug(
        `Found ${locators.length} elements with primary selector: ${config.selector}${config.description ? ` (${config.description})` : ''}`,
      )
      return {
        value: locators,
        usedSelector: config.selector,
        usedFallback: false,
      }
    }
  }

  // Try fallback selectors
  if (selectorGroup.fallback) {
    for (const config of selectorGroup.fallback) {
      const locators = await page.locator(config.selector).all()

      if (locators.length >= requiredCount) {
        log.debug(
          `Found ${locators.length} elements with fallback selector: ${config.selector}${config.description ? ` (${config.description})` : ''}`,
        )
        return {
          value: locators,
          usedSelector: config.selector,
          usedFallback: true,
        }
      }
    }
  }

  log.debug(`No selector found matching ${requiredCount}+ elements`)
  return { value: [], usedSelector: '', usedFallback: false }
}

/**
 * Creates a simple selector group from a single selector (for backward compatibility)
 */
export function createSelectorGroup(
  selector: string,
  description?: string,
): SelectorGroup {
  return {
    primary: [{ selector, description }],
  }
}

/**
 * Adds a fallback selector to an existing group
 */
export function withFallback(
  group: SelectorGroup,
  fallbackSelector: string,
  description?: string,
): SelectorGroup {
  return {
    ...group,
    fallback: [
      ...(group.fallback || []),
      { selector: fallbackSelector, description },
    ],
  }
}
