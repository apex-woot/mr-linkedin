import type { Locator, Page } from 'playwright'
import { isLoggedIn } from '../auth'
import type { ProgressCallback } from '../callbacks'
import { AuthenticationError } from '../exceptions'
import {
  clickSeeMoreButtons,
  detectRateLimit,
  extractTextSafe,
  handleModalClose,
  retryAsync,
  scrollToBottom,
  scrollToHalf,
} from '../utils'

/**
 * Ensures the user is logged in to LinkedIn.
 * Throws AuthenticationError if not logged in.
 */
export async function ensureLoggedIn(page: Page): Promise<void> {
  if (!(await isLoggedIn(page))) {
    throw new AuthenticationError(
      'Not logged in. Please authenticate before scraping.',
    )
  }
}

/**
 * Checks if the page has hit a rate limit.
 * Throws RateLimitError if rate limited.
 */
export async function checkRateLimit(page: Page): Promise<void> {
  await detectRateLimit(page)
}

/**
 * Scrolls the page to the bottom with pauses between scrolls.
 */
export async function scrollPageToBottom(
  page: Page,
  pauseTime: number = 1.0,
  maxScrolls: number = 10,
): Promise<void> {
  await scrollToBottom(page, pauseTime, maxScrolls)
}

/**
 * Scrolls the page to approximately halfway down.
 */
export async function scrollPageToHalf(page: Page): Promise<void> {
  await scrollToHalf(page)
}

/**
 * Scrolls an element into view if needed.
 */
export async function scrollElementIntoView(
  page: Page,
  selector: string,
): Promise<void> {
  try {
    const element = page.locator(selector).first()
    await element.scrollIntoViewIfNeeded()
  } catch (e) {
    console.debug(`Could not scroll element into view: ${selector} - ${e}`)
  }
}

/**
 * Clicks all "See More" buttons on the page.
 * Returns the number of buttons clicked.
 */
export async function clickAllSeeMoreButtons(
  page: Page,
  maxAttempts: number = 10,
): Promise<number> {
  return await clickSeeMoreButtons(page, maxAttempts)
}

/**
 * Attempts to close any modal dialogs on the page.
 * Returns true if a modal was closed.
 */
export async function closeModals(page: Page): Promise<boolean> {
  return await handleModalClose(page)
}

/**
 * Safely extracts text from an element, returning a default value if not found.
 */
export async function safeExtractText(
  page: Page,
  selector: string,
  defaultValue: string = '',
  timeout: number = 2000,
): Promise<string> {
  return await extractTextSafe(page, selector, defaultValue, timeout)
}

/**
 * Safely clicks an element with retries.
 * Returns true if successful, false otherwise.
 */
export async function safeClick(
  page: Page,
  selector: string,
  timeout: number = 5000,
): Promise<boolean> {
  try {
    return await retryAsync(
      async () => {
        const element = page.locator(selector).first()
        await element.click({ timeout })
        return true
      },
      {
        maxAttempts: 3,
        backoff: 2.0,
      },
    )
  } catch {
    console.debug(`Could not click element: ${selector}`)
    return false
  }
}

/**
 * Waits for navigation to complete (network idle).
 */
export async function waitForNavigationComplete(
  page: Page,
  timeout: number = 30000,
): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout })
  } catch {
    console.warn('Navigation did not complete within timeout')
  }
}

/**
 * Navigates to a URL and waits for the page to load.
 * Also checks for rate limiting after navigation.
 */
export async function navigateAndWait(
  page: Page,
  url: string,
  callback?: ProgressCallback,
  waitUntil: 'domcontentloaded' | 'networkidle' | 'load' = 'domcontentloaded',
  timeout: number = 60000,
): Promise<void> {
  if (callback) await callback.onInfo(`Navigating to: ${url}`)
  await page.goto(url, { waitUntil, timeout })
  await checkRateLimit(page)
}

/**
 * Extracts list items from a container element.
 * Returns an array of Locators for each item.
 */
export async function extractListItems(
  page: Page,
  containerSelector: string,
  itemSelector: string,
  timeout: number = 5000,
): Promise<Locator[]> {
  try {
    const container = page.locator(containerSelector).first()
    await container.waitFor({ timeout })
    const items = await container.locator(itemSelector).all()
    return items
  } catch {
    console.warn(
      `Container not found or error extracting items: ${containerSelector}`,
    )
    return []
  }
}

/**
 * Safely gets an attribute value from an element.
 * Returns a default value if the element or attribute is not found.
 */
export async function getAttributeSafe(
  page: Page,
  selector: string,
  attribute: string,
  defaultValue: string = '',
  timeout: number = 2000,
): Promise<string> {
  try {
    const element = page.locator(selector).first()
    const value = await element.getAttribute(attribute, { timeout })
    return value || defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * Waits for a duration and brings the page to front.
 */
export async function waitAndFocus(
  page: Page,
  duration: number = 1.0,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, duration * 1000))
  try {
    await page.bringToFront()
  } catch {}
}

/**
 * Counts the number of elements matching a selector.
 */
export async function countElements(page: Page, selector: string): Promise<number> {
  try {
    return await page.locator(selector).count()
  } catch {
    return 0
  }
}

/**
 * Checks if an element exists on the page.
 */
export async function elementExists(
  page: Page,
  selector: string,
  timeout: number = 1000,
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout, state: 'attached' })
    return true
  } catch {
    return false
  }
}
