import type { Locator } from 'playwright'
import { SCRAPING_CONSTANTS } from '../../config/constants'
import { log } from '../../utils/logger'
import type { ExtractedText, TextExtractor } from './types'

export class RawTextExtractor implements TextExtractor {
  readonly name = 'raw-text'
  readonly priority = 3

  async canHandle(element: Locator): Promise<boolean> {
    const text = await element.innerText().catch(() => '')
    return text.trim().length > 0
  }

  async extract(element: Locator): Promise<ExtractedText | null> {
    try {
      const rawText = await element.innerText().catch(() => '')
      if (!rawText.trim()) return null

      const lines = rawText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.length < SCRAPING_CONSTANTS.MAX_FALLBACK_TEXT_LENGTH)

      if (lines.length === 0) return null

      const deduplicated: string[] = []
      for (const line of lines) {
        if (deduplicated[deduplicated.length - 1] !== line) deduplicated.push(line)
      }

      if (deduplicated.length === 0) return null

      return {
        texts: deduplicated,
        links: [],
        confidence: computeConfidence(deduplicated),
      }
    } catch (e) {
      log.debug(`RawTextExtractor.extract error: ${e}`)
      return null
    }
  }
}

function computeConfidence(texts: string[]): number {
  if (texts.length >= 4) return 0.4
  if (texts.length >= 2) return 0.3
  if (texts.length >= 1) return 0.15
  return 0
}
