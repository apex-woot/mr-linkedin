import fs from 'node:fs/promises'
import path from 'node:path'
import type { Browser, BrowserContext, Page } from 'playwright'
import { chromium } from 'playwright'
import { z } from 'zod'
import { NetworkError } from './exceptions'

const ViewportSchema = z.object({
  width: z.number(),
  height: z.number(),
})

export const BrowserOptionsSchema = z.object({
  headless: z.boolean().optional().default(true),
  slowMo: z.number().optional().default(0),
  viewport: ViewportSchema.optional().default({ width: 1280, height: 720 }),
  userAgent: z.string().optional(),
  launchOptions: z.record(z.string(), z.any()).optional().default({}),
})

export type BrowserOptions = z.input<typeof BrowserOptionsSchema>

export class BrowserManager {
  private _browser: Browser | null = null
  private _context: BrowserContext | null = null
  private _page: Page | null = null
  private _isAuthenticated = false
  private _options: z.infer<typeof BrowserOptionsSchema>

  constructor(options: BrowserOptions = {}) {
    this._options = BrowserOptionsSchema.parse(options)
  }

  async start(): Promise<void> {
    try {
      this._browser = await chromium.launch({
        headless: this._options.headless,
        slowMo: this._options.slowMo,
        ...this._options.launchOptions,
      })

      console.info(`Browser launched (headless=${this._options.headless})`)

      this._context = await this._browser.newContext({
        viewport: this._options.viewport,
        userAgent: this._options.userAgent,
      })

      this._page = await this._context.newPage()

      console.info('Browser context and page created')
    } catch (e) {
      await this.close()
      throw new NetworkError(`Failed to start browser: ${e}`)
    }
  }

  async close(): Promise<void> {
    try {
      if (this._page) {
        await this._page.close()
        this._page = null
      }

      if (this._context) {
        await this._context.close()
        this._context = null
      }

      if (this._browser) {
        await this._browser.close()
        this._browser = null
      }

      console.info('Browser closed')
    } catch (e) {
      console.error(`Error closing browser: ${e}`)
    }
  }

  async newPage(): Promise<Page> {
    if (!this._context) {
      throw new Error('Browser context not initialized. Call start() first.')
    }

    return await this._context.newPage()
  }

  get page(): Page {
    if (!this._page) {
      throw new Error('Browser not started. Call start() first.')
    }
    return this._page
  }

  get context(): BrowserContext {
    if (!this._context) {
      throw new Error('Browser context not initialized.')
    }
    return this._context
  }

  get browser(): Browser {
    if (!this._browser) throw new Error('Browser not started.')
    return this._browser
  }

  async saveSession(filepath: string): Promise<void> {
    if (!this._context) throw new Error('No browser context to save')

    const storageState = await this._context.storageState()
    const dir = path.dirname(filepath)

    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filepath, JSON.stringify(storageState, null, 2))

    console.info(`Session saved to ${filepath}`)
  }

  async loadSession(filepath: string): Promise<void> {
    try {
      await fs.access(filepath)
    } catch {
      throw new Error(`Session file not found: ${filepath}`)
    }

    if (this._context) await this._context.close()
    if (!this._browser) throw new Error('Browser not started')
    this._context = await this._browser.newContext({
      storageState: filepath,
      viewport: this._options.viewport,
      userAgent: this._options.userAgent,
    })

    if (this._page) await this._page.close()
    this._page = await this._context.newPage()

    this._isAuthenticated = true

    console.info(`Session loaded from ${filepath}`)
  }

  async setCookie(
    name: string,
    value: string,
    domain: string = '.linkedin.com',
  ): Promise<void> {
    if (!this._context) {
      throw new Error('No browser context')
    }

    await this._context.addCookies([{ name, value, domain, path: '/' }])

    console.debug(`Cookie set: ${name}`)
  }

  get isAuthenticated(): boolean {
    return this._isAuthenticated
  }

  set isAuthenticated(value: boolean) {
    this._isAuthenticated = value
  }
}
