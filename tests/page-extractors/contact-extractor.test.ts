import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { BrowserManager } from '../../src/browser'
import { ContactPageExtractor } from '../../src/extraction/page-extractors'

const canRunPlaywright = existsSync(chromium.executablePath())
const describeContactExtractor = canRunPlaywright ? describe : describe.skip

describeContactExtractor('ContactPageExtractor', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test('returns raw sections from contact dialog', async () => {
    const page = browserManager.page
    await page.setContent(`
      <main>
        <a id="top-card-text-details-contact-info">Contact info</a>
        <dialog open>
          <section>
            <h3>Email</h3>
            <a href="mailto:test@example.com">test@example.com</a>
          </section>
          <section>
            <h3>Phone</h3>
            <p>+1 (555) 111-2222</p>
          </section>
        </dialog>
      </main>
    `)

    const extractor = new ContactPageExtractor()
    const result = await extractor.extract({
      baseUrl: page.url(),
      page,
    })

    expect(result.kind).toBe('raw')
    if (result.kind !== 'raw') return

    expect(result.data.length).toBe(2)
    expect(result.data[0]?.heading).toBe('email')
    expect(result.data[0]?.anchors[0]?.href).toBe('mailto:test@example.com')
    expect(result.data[1]?.heading).toBe('phone')
  })
})
