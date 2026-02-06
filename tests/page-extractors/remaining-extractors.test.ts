import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import type { Page } from 'playwright'
import { chromium } from 'playwright'
import { BrowserManager } from '../../src/browser'
import {
  AccomplishmentPageExtractor,
  EducationPageExtractor,
  ExperiencePageExtractor,
  InterestPageExtractor,
  PatentPageExtractor,
} from '../../src/extraction/page-extractors'

const canRunPlaywright = existsSync(chromium.executablePath())
const describeRemainingExtractors = canRunPlaywright ? describe : describe.skip

function html(body: string): string {
  return `<!doctype html><html><body>${body}</body></html>`
}

async function routePages(page: Page, pagesByPath: Record<string, string>) {
  await page.unroute('**/*').catch(() => {})
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const body = pagesByPath[url.pathname] ?? '<main></main>'
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: html(body),
    })
  })
}

describeRemainingExtractors('Remaining page extractors', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test('ExperiencePageExtractor navigates to details page and returns list items', async () => {
    const page = browserManager.page
    await routePages(page, {
      '/in/test/': '<main></main>',
      '/in/test/details/experience/': `
        <main>
          <ul>
            <li class="artdeco-list__item">Experience A</li>
            <li class="artdeco-list__item">Experience B</li>
          </ul>
        </main>
      `,
    })
    await page.goto('https://www.linkedin.com/in/test/')

    const result = await new ExperiencePageExtractor().extract({
      baseUrl: 'https://www.linkedin.com/in/test',
      page,
    })

    expect(result.kind).toBe('list')
    if (result.kind !== 'list') return
    expect(result.items.length).toBe(2)
    expect(result.items[0]?.context).toEqual({})
  })

  test('EducationPageExtractor returns main-page section items before details navigation', async () => {
    const page = browserManager.page
    await routePages(page, {
      '/in/test/': `
        <main>
          <section>
            <h2>Education</h2>
            <ul>
              <li>School A</li>
            </ul>
          </section>
        </main>
      `,
    })
    await page.goto('https://www.linkedin.com/in/test/')

    const result = await new EducationPageExtractor().extract({
      baseUrl: 'https://www.linkedin.com/in/test',
      page,
    })

    expect(result.kind).toBe('list')
    if (result.kind !== 'list') return
    expect(result.items.length).toBe(1)
  })

  test('PatentPageExtractor returns empty list when details page has no content', async () => {
    const page = browserManager.page
    await routePages(page, {
      '/in/test/': '<main></main>',
      '/in/test/details/patents/': `
        <main>
          <p>Nothing to see for now</p>
        </main>
      `,
    })
    await page.goto('https://www.linkedin.com/in/test/')

    const result = await new PatentPageExtractor().extract({
      baseUrl: 'https://www.linkedin.com/in/test',
      page,
    })

    expect(result.kind).toBe('list')
    if (result.kind !== 'list') return
    expect(result.items.length).toBe(0)
  })

  test('AccomplishmentPageExtractor tags each item with category context', async () => {
    const page = browserManager.page
    await routePages(page, {
      '/in/test/': '<main></main>',
      '/in/test/details/certifications/': `
        <main>
          <ul>
            <li class="artdeco-list__item">Cert A</li>
          </ul>
        </main>
      `,
    })
    await page.goto('https://www.linkedin.com/in/test/')

    const result = await new AccomplishmentPageExtractor({
      urlPath: 'certifications',
      category: 'certification',
    }).extract({
      baseUrl: 'https://www.linkedin.com/in/test',
      page,
    })

    expect(result.kind).toBe('list')
    if (result.kind !== 'list') return
    expect(result.items.length).toBe(1)
    expect(result.items[0]?.context).toEqual({ category: 'certification' })
  })

  test('InterestPageExtractor maps tab name to category and tags list items', async () => {
    const page = browserManager.page
    await routePages(page, {
      '/in/test/': '<main></main>',
      '/in/test/details/interests/': `
        <main>
          <div role="tablist">
            <button role="tab">Companies</button>
          </div>
          <div role="tabpanel">
            <ul>
              <li>Interest A</li>
            </ul>
          </div>
        </main>
      `,
    })
    await page.goto('https://www.linkedin.com/in/test/')

    const result = await new InterestPageExtractor().extract({
      baseUrl: 'https://www.linkedin.com/in/test',
      page,
    })

    expect(result.kind).toBe('list')
    if (result.kind !== 'list') return
    expect(result.items.length).toBe(1)
    expect(result.items[0]?.context).toEqual({ category: 'company' })
  })
})
