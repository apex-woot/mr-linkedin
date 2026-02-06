import type { Page } from 'playwright'
import { AccomplishmentInterpreter } from '../../extraction/interpreters/accomplishment'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaStrategy } from '../../extraction/strategies/aria-strategy'
import { RawTextStrategy } from '../../extraction/strategies/raw-text-strategy'
import { SemanticStrategy } from '../../extraction/strategies/semantic-strategy'
import type { Accomplishment } from '../../models'
import { log } from '../../utils/logger'
import { navigateAndWait, waitAndFocus } from '../utils'
import { deduplicateItems } from './common-patterns'

export async function getAccomplishments(
  page: Page,
  baseUrl: string,
): Promise<Accomplishment[]> {
  const accomplishments: Accomplishment[] = []

  const accomplishmentSections: Array<[string, string]> = [
    ['certifications', 'certification'],
    ['honors', 'honor'],
    ['publications', 'publication'],
    ['patents', 'patent'],
    ['courses', 'course'],
    ['projects', 'project'],
    ['languages', 'language'],
    ['organizations', 'organization'],
  ]

  for (const [urlPath, category] of accomplishmentSections) {
    try {
      const sectionUrl = `${baseUrl.replace(/\/$/, '')}/details/${urlPath}/`
      await navigateAndWait(page, sectionUrl)
      await page.waitForSelector('main', { timeout: 10000 })
      await waitAndFocus(page, 1)

      const nothingToSee = await page
        .locator('text="Nothing to see for now"')
        .count()
      if (nothingToSee > 0) continue

      const pipeline = new ExtractionPipeline<Accomplishment>(
        [
          new AriaStrategy('accomplishment'),
          new SemanticStrategy(),
          new RawTextStrategy(),
        ],
        new AccomplishmentInterpreter({ category, urlPath }),
        {
          confidenceThreshold: 0.25,
          captureHtmlOnFailure: true,
        },
      )

      const result = await pipeline.extract(page)
      if (result.items.length > 0) {
        const unique = deduplicateItems(
          result.items,
          (item) => `${item.category}|${item.title}`,
        )
        accomplishments.push(...unique)
      }

      log.info(
        `Got ${result.items.length} ${category} items (strategy: ${result.strategy}, confidence: ${result.confidence.toFixed(2)})`,
      )
    } catch (e) {
      log.debug(`Error getting ${category}s: ${e}`)
    }
  }

  return deduplicateItems(
    accomplishments,
    (item) => `${item.category}|${item.title}`,
  )
}
