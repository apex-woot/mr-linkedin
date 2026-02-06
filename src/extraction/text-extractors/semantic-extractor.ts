import type { Locator } from 'playwright'
import { log } from '../../utils/logger'
import { deduplicateTexts, extractLinksFromElement } from './shared'
import type { ExtractedText, TextExtractor } from './types'

export class SemanticTextExtractor implements TextExtractor {
  readonly name = 'semantic'
  readonly priority = 1

  async canHandle(element: Locator): Promise<boolean> {
    const count = await element
      .locator('h1, h2, h3, h4, h5, h6, p, span')
      .count()
      .catch(() => 0)
    return count > 0
  }

  async extract(element: Locator): Promise<ExtractedText | null> {
    try {
      const texts = await extractSemanticTexts(element)
      if (texts.length === 0) return null

      return {
        texts,
        links: await extractLinksFromElement(element),
        confidence: computeConfidence(texts),
      }
    } catch (e) {
      log.debug(`SemanticTextExtractor.extract error: ${e}`)
      return null
    }
  }
}

async function extractSemanticTexts(element: Locator): Promise<string[]> {
  const rawTexts: string[] = []

  const headings = await element.locator('h1, h2, h3, h4, h5, h6').all()
  for (const heading of headings) {
    const text = await heading.textContent()
    if (text) rawTexts.push(text)
  }

  const paragraphs = await element.locator('p').all()
  for (const paragraph of paragraphs) {
    const text = await paragraph.textContent()
    if (text) rawTexts.push(text)
  }

  let deduped = deduplicateTexts(rawTexts, 500)
  if (deduped.length > 0) return deduped

  const spans = await element.locator('span').all()
  const spanTexts: string[] = []
  for (const span of spans) {
    const text = await span.textContent()
    if (text) spanTexts.push(text)
  }

  deduped = deduplicateTexts(spanTexts, 300)
  return deduped.filter((text) => text.length > 1)
}

function computeConfidence(texts: string[]): number {
  if (texts.length >= 3) return 0.6
  if (texts.length >= 2) return 0.45
  if (texts.length >= 1) return 0.25
  return 0
}
