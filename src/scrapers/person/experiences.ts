import type { Page } from 'playwright'
import { SCRAPING_CONSTANTS } from '../../config/constants'
import { ExperienceInterpreter } from '../../extraction/interpreters/experience'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaStrategy } from '../../extraction/strategies/aria-strategy'
import { RawTextStrategy } from '../../extraction/strategies/raw-text-strategy'
import { SemanticStrategy } from '../../extraction/strategies/semantic-strategy'
import type { Experience } from '../../models/person'
import { log } from '../../utils/logger'
import {
  navigateAndWait,
  scrollPageToBottom,
  scrollPageToHalf,
  waitAndFocus,
} from '../utils'
import { deduplicateItems } from './common-patterns'

export async function getExperiences(
  page: Page,
  baseUrl: string,
): Promise<Experience[]> {
  try {
    const expUrl = `${baseUrl.replace(/\/$/, '')}/details/experience/`
    log.debug('Navigating to experience details page')

    await navigateAndWait(page, expUrl)
    await page.waitForSelector('main', { timeout: 10000 })
    await waitAndFocus(page, SCRAPING_CONSTANTS.EXPERIENCE_FOCUS_WAIT)
    await scrollPageToHalf(page)
    await scrollPageToBottom(
      page,
      SCRAPING_CONSTANTS.EXPERIENCE_SCROLL_PAUSE,
      SCRAPING_CONSTANTS.EXPERIENCE_MAX_SCROLLS,
    )

    const pipeline = new ExtractionPipeline<Experience>(
      [
        new AriaStrategy('experience'),
        new SemanticStrategy(),
        new RawTextStrategy(),
      ],
      new ExperienceInterpreter(),
      {
        confidenceThreshold: 0.3,
        captureHtmlOnFailure: true,
      },
    )

    const result = await pipeline.extract(page)

    log.info(
      `Got ${result.items.length} experiences (strategy: ${result.strategy}, confidence: ${result.confidence.toFixed(2)})`,
    )

    if (result.items.length === 0) {
      log.debug(
        `Experience extraction failed. Strategies attempted: ${result.diagnostics.strategiesAttempted.join(', ')}`,
      )
    }

    return deduplicateItems(
      result.items,
      (exp) => `${exp.company}|${exp.positions[0]?.title}`,
    )
  } catch (e) {
    log.warning(`Error getting experiences: ${e}`)
    return []
  }
}
