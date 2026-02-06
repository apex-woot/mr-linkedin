import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { BrowserManager } from '../../src/browser'
import { TopCardPageExtractor } from '../../src/extraction/page-extractors'

async function loadFixture(name: string): Promise<string> {
  return await readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
}

const canRunPlaywright = existsSync(chromium.executablePath())
const describeTopCardExtractor = canRunPlaywright ? describe : describe.skip

describeTopCardExtractor('TopCardPageExtractor', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test('returns single kind with top-card root element', async () => {
    const page = browserManager.page
    const html = await loadFixture('top-card-person-a.html')
    await page.setContent(html)

    const extractor = new TopCardPageExtractor()
    const result = await extractor.extract({
      baseUrl: page.url(),
      page,
    })

    expect(result.kind).toBe('single')
    if (result.kind !== 'single') return

    const name = await result.element.locator('h1').first().textContent()
    expect(name?.trim()).toBe('Jordan Vale')
    expect(result.context).toEqual({})
  })
})
