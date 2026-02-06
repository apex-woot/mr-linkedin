import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { BrowserManager } from '../src/browser'
import { extractContactsFromDialog } from '../src/scrapers/person/contact-info'

async function loadFixture(name: string): Promise<string> {
  return await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

const canRunPlaywright = existsSync(chromium.executablePath())
const describeContactInfo = canRunPlaywright ? describe : describe.skip

describeContactInfo('Contact info extractor', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test('extracts contacts from dialog sections', async () => {
    const page = browserManager.page
    const html = await loadFixture('contact-info-dialog.html')

    await page.setContent(html)

    const contacts = await extractContactsFromDialog(page.locator('dialog').first())

    expect(contacts).toEqual([
      {
        type: 'linkedin',
        value: 'https://www.linkedin.com/in/sample-user-0001/',
      },
      {
        type: 'email',
        value: 'sample.user@example.test',
      },
      {
        type: 'website',
        value: 'https://example-project.test',
        label: 'Personal',
      },
      {
        type: 'phone',
        value: '+1 (555) 123-4567',
      },
      {
        type: 'birthday',
        value: 'January 7',
      },
      {
        type: 'address',
        value: 'Riverton, Colorado, United States',
      },
      {
        type: 'twitter',
        value: 'https://x.com/sample_user_0001',
      },
    ])
  })

  test('deduplicates repeated contacts', async () => {
    const page = browserManager.page
    await page.setContent(`
      <dialog open>
        <section>
          <h3>Email</h3>
          <a href="mailto:test@example.com">test@example.com</a>
          <a href="mailto:test@example.com">test@example.com</a>
        </section>
      </dialog>
    `)

    const contacts = await extractContactsFromDialog(page.locator('dialog').first())

    expect(contacts).toEqual([
      {
        type: 'email',
        value: 'test@example.com',
      },
    ])
  })
})
