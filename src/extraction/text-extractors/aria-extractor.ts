import type { Locator } from 'playwright'
import { log } from '../../utils/logger'
import { deduplicateTexts, detectSubItems, extractLinksFromElement } from './shared'
import type { ExtractedLink, ExtractedText, TextExtractor } from './types'

export class AriaTextExtractor implements TextExtractor {
  readonly name = 'aria'
  readonly priority = 0

  async canHandle(element: Locator): Promise<boolean> {
    const count = await element
      .locator('span[aria-hidden="true"]')
      .count()
      .catch(() => 0)
    return count > 0
  }

  async extract(element: Locator): Promise<ExtractedText | null> {
    try {
      const texts = await extractAriaTexts(element)
      if (texts.length === 0) return null

      const links = await extractLinksFromElement(element)
      const subItems = await detectSubItems(element, extractAriaTexts)

      return {
        texts,
        links,
        subItems: subItems.length > 0 ? subItems : undefined,
        confidence: computeConfidence(texts, links, subItems),
      }
    } catch (e) {
      log.debug(`AriaTextExtractor.extract error: ${e}`)
      return null
    }
  }
}

async function extractAriaTexts(element: Locator): Promise<string[]> {
  const spans = await element.locator('span[aria-hidden="true"]').all()
  const rawTexts: string[] = []

  for (const span of spans) {
    const text = await span.textContent().catch(() => null)
    if (text) rawTexts.push(text)
  }

  return deduplicateTexts(rawTexts, 500)
}

function computeConfidence(texts: string[], links: ExtractedLink[], subItems: ExtractedText[]): number {
  let score = 0

  if (texts.length >= 3) score += 0.4
  else if (texts.length >= 2) score += 0.3
  else if (texts.length >= 1) score += 0.15

  if (links.length > 0) score += 0.2
  if (subItems.length > 0) score += 0.2

  const title = texts[0]
  if (title && title.length > 2 && title.length < 150) score += 0.2

  return Math.min(score, 1)
}
