import type { Locator, Page } from 'playwright'

export interface TopCardPersonInfo {
  name: string
  headline: string | null
  origin: string | null
}

const ROOT_SELECTORS = [
  'section.artdeco-card[data-member-id]',
  'main section.artdeco-card',
] as const

const NAME_SELECTORS = ['h1.inline.t-24', 'h1'] as const

const HEADLINE_SELECTORS = [
  'div.text-body-medium.break-words[data-generated-suggestion-target]',
  'div.text-body-medium.break-words',
] as const

const ORIGIN_SELECTORS = [
  'span.text-body-small.inline.t-black--light.break-words',
  'div.mt2 span.text-body-small',
] as const

export async function extractTopCardFromPage(
  page: Page,
): Promise<TopCardPersonInfo> {
  const root = await resolveRoot(page)
  const name = (await extractName(root)) ?? 'Unknown'
  const headline = await extractHeadline(root, name)
  const origin = await extractOrigin(root)

  return {
    name,
    headline,
    origin,
  }
}

async function resolveRoot(page: Page): Promise<Locator> {
  for (const selector of ROOT_SELECTORS) {
    const candidate = page.locator(selector).first()
    if ((await candidate.count()) > 0) {
      return candidate
    }
  }

  return page.locator('main').first()
}

async function extractName(root: Locator): Promise<string | null> {
  for (const selector of NAME_SELECTORS) {
    const text = await getFirstText(root, selector)
    if (text) {
      return text
    }
  }

  const fallback = root.locator('a[aria-label]').first()
  return normalizeText(await fallback.getAttribute('aria-label'))
}

async function extractHeadline(
  root: Locator,
  name: string,
): Promise<string | null> {
  for (const selector of HEADLINE_SELECTORS) {
    const texts = await getAllTexts(root, selector)
    for (const text of texts) {
      if (text && text !== name) {
        return text
      }
    }
  }

  return null
}

async function extractOrigin(root: Locator): Promise<string | null> {
  for (const selector of ORIGIN_SELECTORS) {
    const text = await getFirstText(root, selector)
    const normalized = normalizeOrigin(text)
    if (normalized) {
      return normalized
    }
  }

  return null
}

async function getFirstText(
  root: Locator,
  selector: string,
): Promise<string | null> {
  const element = root.locator(selector).first()
  if ((await element.count()) === 0) {
    return null
  }

  const text = await element.textContent()
  return normalizeText(text)
}

async function getAllTexts(root: Locator, selector: string): Promise<string[]> {
  const elements = root.locator(selector)
  const count = await elements.count()
  const results: string[] = []

  for (let i = 0; i < count; i++) {
    const text = normalizeText(await elements.nth(i).textContent())
    if (text) {
      results.push(text)
    }
  }

  return results
}

function normalizeOrigin(input: string | null | undefined): string | null {
  const normalized = normalizeText(input)
  if (!normalized) {
    return null
  }

  const withoutContactInfo = normalized.replace(/\bContact info\b.*/i, '').trim()
  return withoutContactInfo || null
}

function normalizeText(input: string | null | undefined): string | null {
  if (!input) {
    return null
  }

  const normalized = input.replace(/\s+/g, ' ').trim()
  return normalized || null
}
