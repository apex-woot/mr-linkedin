import type { Locator, Page } from 'playwright'
import { isLoggedIn } from '../auth'
import type { ProgressCallback } from '../callbacks'
import { SilentCallback } from '../callbacks'
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

export interface BaseScraperOptions {
  page: Page
  callback?: ProgressCallback
}

export class BaseScraper {
  protected page: Page
  protected callback: ProgressCallback

  constructor(options: BaseScraperOptions) {
    this.page = options.page
    this.callback = options.callback || new SilentCallback()
  }

  async ensureLoggedIn(): Promise<void> {
    if (!(await isLoggedIn(this.page))) {
      throw new AuthenticationError(
        'Not logged in. Please authenticate before scraping.',
      )
    }
  }

  async checkRateLimit(): Promise<void> {
    await detectRateLimit(this.page)
  }

  async scrollPageToBottom(
    pauseTime: number = 1.0,
    maxScrolls: number = 10,
  ): Promise<void> {
    await scrollToBottom(this.page, pauseTime, maxScrolls)
  }

  async scrollPageToHalf(): Promise<void> {
    await scrollToHalf(this.page)
  }

  async scrollElementIntoView(selector: string): Promise<void> {
    try {
      const element = this.page.locator(selector).first()
      await element.scrollIntoViewIfNeeded()
    } catch (e) {
      console.debug(`Could not scroll element into view: ${selector} - ${e}`)
    }
  }

  async clickAllSeeMoreButtons(maxAttempts: number = 10): Promise<number> {
    return await clickSeeMoreButtons(this.page, maxAttempts)
  }

  async closeModals(): Promise<boolean> {
    return await handleModalClose(this.page)
  }

  async safeExtractText(
    selector: string,
    defaultValue: string = '',
    timeout: number = 2000,
  ): Promise<string> {
    return await extractTextSafe(this.page, selector, defaultValue, timeout)
  }

  async safeClick(selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      return await retryAsync(
        async () => {
          const element = this.page.locator(selector).first()
          await element.click({ timeout })
          return true
        },
        {
          maxAttempts: 3,
          backoff: 2.0,
        },
      )
    } catch (_e) {
      console.debug(`Could not click element: ${selector}`)
      return false
    }
  }

  async waitForNavigationComplete(timeout: number = 30000): Promise<void> {
    try {
      await this.page.waitForLoadState('networkidle', { timeout })
    } catch (_e) {
      console.warn('Navigation did not complete within timeout')
    }
  }

  async navigateAndWait(
    url: string,
    waitUntil: 'domcontentloaded' | 'networkidle' | 'load' = 'domcontentloaded',
    timeout: number = 60000,
  ): Promise<void> {
    await this.callback.onInfo(`Navigating to: ${url}`)
    await this.page.goto(url, { waitUntil, timeout })
    await this.checkRateLimit()
  }

  async extractListItems(
    containerSelector: string,
    itemSelector: string,
    timeout: number = 5000,
  ): Promise<Locator[]> {
    try {
      const container = this.page.locator(containerSelector).first()
      await container.waitFor({ timeout })
      const items = await container.locator(itemSelector).all()
      return items
    } catch (_e) {
      console.warn(
        `Container not found or error extracting items: ${containerSelector}`,
      )
      return []
    }
  }

  async getAttributeSafe(
    selector: string,
    attribute: string,
    defaultValue: string = '',
    timeout: number = 2000,
  ): Promise<string> {
    try {
      const element = this.page.locator(selector).first()
      const value = await element.getAttribute(attribute, { timeout })
      return value || defaultValue
    } catch (_e) {
      return defaultValue
    }
  }

  async waitAndFocus(duration: number = 1.0): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, duration * 1000))
    try {
      await this.page.bringToFront()
    } catch (_e) {}
  }

  async countElements(selector: string): Promise<number> {
    try {
      return await this.page.locator(selector).count()
    } catch (_e) {
      return 0
    }
  }

  async elementExists(
    selector: string,
    timeout: number = 1000,
  ): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout, state: 'attached' })
      return true
    } catch (_e) {
      return false
    }
  }
}
