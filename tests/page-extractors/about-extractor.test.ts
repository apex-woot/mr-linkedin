import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { BrowserManager } from '../../src/browser'
import { AboutPageExtractor } from '../../src/extraction/page-extractors'

const canRunPlaywright = existsSync(chromium.executablePath())
const describeAboutExtractor = canRunPlaywright ? describe : describe.skip

describeAboutExtractor('AboutPageExtractor', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test('prefers expandable-text-box when available', async () => {
    const page = browserManager.page
    await page.setContent(`
      <main>
        <section data-view-name="profile-card-about">
          <div data-testid="expandable-text-box">About content here.</div>
        </section>
      </main>
    `)

    const extractor = new AboutPageExtractor()
    const result = await extractor.extract({
      baseUrl: page.url(),
      page,
    })

    expect(result.kind).toBe('single')
    if (result.kind !== 'single') return

    const text = await result.element.textContent()
    expect(text?.trim()).toBe('About content here.')
    expect(result.context).toEqual({})
  })

  test('falls back to profile-card-about when expandable-text-box is missing', async () => {
    const page = browserManager.page
    await page.setContent(`
      <main>
        <section data-view-name="profile-card-about">
          <span aria-hidden="true">ignored</span>
          <span aria-hidden="true">Fallback about</span>
        </section>
      </main>
    `)

    const extractor = new AboutPageExtractor()
    const result = await extractor.extract({
      baseUrl: page.url(),
      page,
    })

    expect(result.kind).toBe('single')
    if (result.kind !== 'single') return

    const marker = await result.element.getAttribute('data-view-name')
    expect(marker).toBe('profile-card-about')
  })
})
