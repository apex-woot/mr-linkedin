import type { Page } from 'playwright'
import { ElementNotFoundError, RateLimitError } from './exceptions'

export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    backoff?: number
    exceptions?: Array<new (...args: any[]) => Error>
  } = {},
): Promise<T> {
  const { maxAttempts = 3, backoff = 2, exceptions = [Error] } = options

  let lastException: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      lastException = e
      const shouldRetry = exceptions.some((exc) => e instanceof exc)

      if (shouldRetry && attempt < maxAttempts - 1) {
        const waitTime = backoff ** attempt
        console.warn(
          `Attempt ${attempt + 1}/${maxAttempts} failed: ${e.message}. ` +
            `Retrying in ${waitTime}s...`,
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000))
      } else {
        break
      }
    }
  }

  throw lastException
}

export async function detectRateLimit(page: Page): Promise<void> {
  const currentUrl = page.url()

  if (
    currentUrl.includes('linkedin.com/checkpoint') ||
    currentUrl.includes('authwall')
  ) {
    throw new RateLimitError(
      'LinkedIn security checkpoint detected. ' +
        'You may need to verify your identity or wait before continuing.',
      3600, // 1 hour
    )
  }

  try {
    const captchaCount = await page
      .locator('iframe[title*="captcha" i], iframe[src*="captcha" i]')
      .count()
    if (captchaCount > 0) {
      throw new RateLimitError(
        'CAPTCHA challenge detected. Manual intervention required.',
        3600,
      )
    }
  } catch {}

  try {
    const bodyText = await page.locator('body').textContent({ timeout: 1000 })
    if (bodyText) {
      const bodyLower = bodyText.toLowerCase()
      const limitPhrases = [
        'too many requests',
        'rate limit',
        'slow down',
        'try again later',
      ]
      if (limitPhrases.some((phrase) => bodyLower.includes(phrase))) {
        throw new RateLimitError(
          'Rate limit message detected on page.',
          1800, // 30 minutes
        )
      }
    }
  } catch {}
}

export async function waitForElementSmart(
  page: Page,
  selector: string,
  options: {
    timeout?: number
    state?: 'visible' | 'hidden' | 'attached' | 'detached'
    errorContext?: string
  } = {},
): Promise<void> {
  const { timeout = 5000, state = 'visible', errorContext } = options

  try {
    await page.waitForSelector(selector, { timeout, state })
  } catch {
    const context = errorContext ? ` when ${errorContext}` : ''
    const suggestions = getSelectorSuggestions(selector)

    throw new ElementNotFoundError(
      `Could not find element with selector '${selector}'${context}. ` +
        `This may indicate:\n` +
        `  • The page structure has changed\n` +
        `  • The profile has restricted visibility\n` +
        `  • The content doesn't exist on this page\n` +
        `  • Network slowness (try increasing timeout)\n` +
        `${suggestions}`,
    )
  }
}

function getSelectorSuggestions(selector: string): string {
  if (selector.includes('#')) {
    return 'Tip: ID selectors may be dynamic. Consider using data attributes or text content.'
  } else if (selector.includes('pv-') || selector.includes('artdeco')) {
    return 'Tip: LinkedIn class names change frequently. This selector may need updating.'
  }
  return ''
}

export async function extractTextSafe(
  page: Page,
  selector: string,
  defaultValue: string = '',
  timeout: number = 2000,
): Promise<string> {
  try {
    const element = page.locator(selector).first()
    const text = await element.textContent({ timeout })
    return text ? text.trim() : defaultValue
  } catch {
    console.debug(
      `Element not found: ${selector}, returning default: ${defaultValue}`,
    )
    return defaultValue
  }
}

/**
 * Dynamically scrolls to the bottom of the page or a scrollable container.
 * Stops when the height remains stable for 3 consecutive checks.
 * Hard cutoff at 10 scrolls.
 */
export async function scrollToBottom(
  page: Page,
  pauseTime: number = 1.0,
  maxScrolls: number = 10,
): Promise<void> {
  const viewport = page.viewportSize()
  if (viewport) {
    await page.mouse.move(viewport.width / 2, viewport.height / 2)
  }

  let stableCount = 0
  const stabilityThreshold = 3

  for (let i = 0; i < maxScrolls; i++) {
    const scrollStats = await page.evaluate(() => {
      function findScrollableElement(): Element | Window {
        if (
          document.documentElement.scrollHeight > window.innerHeight ||
          document.body.scrollHeight > window.innerHeight
        ) {
          return window
        }

        const allElements = Array.from(document.querySelectorAll('*'))
        let bestCandidate: Element | null = null
        let maxScrollHeight = 0

        for (const el of allElements) {
          const style = window.getComputedStyle(el)
          if (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight
          ) {
            if (el.scrollHeight > maxScrollHeight) {
              maxScrollHeight = el.scrollHeight
              bestCandidate = el
            }
          }
        }

        return bestCandidate || window
      }

      const target = findScrollableElement()
      const isWindow = target === window

      const currentScrollHeight = isWindow
        ? document.documentElement.scrollHeight
        : (target as Element).scrollHeight

      if (isWindow) {
        window.scrollTo(0, document.documentElement.scrollHeight)
      } else {
        const el = target as Element
        el.scrollTop = el.scrollHeight
      }

      return {
        scrollHeight: currentScrollHeight,
        tagName: isWindow ? 'WINDOW' : (target as Element).tagName,
      }
    })

    await page.mouse.wheel(0, 3000)
    await new Promise((resolve) => setTimeout(resolve, pauseTime * 1000))

    const newStats = await page.evaluate(() => {
      return {
        scrollHeight: document.documentElement.scrollHeight,
      }
    })

    const heightDidNotChange =
      newStats.scrollHeight === scrollStats.scrollHeight

    if (heightDidNotChange) {
      stableCount++
      console.debug(
        `Height stable (${newStats.scrollHeight}). Stability check: ${stableCount}/${stabilityThreshold}`,
      )
    } else {
      stableCount = 0
    }

    if (stableCount >= stabilityThreshold) {
      console.debug(
        `Reached end of page (height stable for ${stabilityThreshold} checks).`,
      )
      break
    }

    console.debug(
      `Scroll ${i + 1}/${maxScrolls}: Height=${scrollStats.scrollHeight}, Target=${scrollStats.tagName}`,
    )
  }
}

export async function scrollToHalf(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
}

export async function clickSeeMoreButtons(
  page: Page,
  maxAttempts: number = 10,
): Promise<number> {
  let clicked = 0
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const seeMore = page
        .locator(
          'button:has-text("See more"), button:has-text("Show more"), button:has-text("show all")',
        )
        .first()

      if (await seeMore.isVisible({ timeout: 1000 })) {
        await seeMore.click()
        await new Promise((resolve) => setTimeout(resolve, 500))
        clicked++
      } else {
        break
      }
    } catch {
      break
    }
  }

  if (clicked > 0) {
    console.debug(`Clicked ${clicked} 'see more' buttons`)
  }

  return clicked
}

export async function handleModalClose(page: Page): Promise<boolean> {
  try {
    const closeButton = page
      .locator(
        'button[aria-label="Dismiss"], button[aria-label="Close"], button.artdeco-modal__dismiss',
      )
      .first()

    if (await closeButton.isVisible({ timeout: 1000 })) {
      await closeButton.click()
      await new Promise((resolve) => setTimeout(resolve, 500))
      console.debug('Closed modal')
      return true
    }
  } catch {}

  return false
}

export async function isPageLoaded(page: Page): Promise<boolean> {
  try {
    const state = await page.evaluate(() => document.readyState)
    return state === 'complete'
  } catch {
    return false
  }
}
