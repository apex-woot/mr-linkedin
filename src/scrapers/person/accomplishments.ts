import type { Page } from 'playwright'
import { AccomplishmentPageExtractor } from '../../extraction/page-extractors'
import { AccomplishmentParser } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import type { Accomplishment } from '../../models'
import { log } from '../../utils/logger'
import { deduplicateItems } from './common-patterns'

export async function getAccomplishments(page: Page, baseUrl: string): Promise<Accomplishment[]> {
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
      const pipeline = new ExtractionPipeline<Accomplishment>({
        pageExtractor: new AccomplishmentPageExtractor({
          urlPath,
          category,
        }),
        textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
        parser: new AccomplishmentParser(),
        confidenceThreshold: 0.25,
        captureHtmlOnFailure: true,
      })

      const result = await pipeline.extract({ page, baseUrl })
      if (result.items.length > 0) {
        const unique = deduplicateItems(result.items, (item) => `${item.category}|${item.title}`)
        accomplishments.push(...unique)
      }

      log.info(
        `Got ${result.items.length} ${category} items (extractor: ${result.diagnostics.textExtractorUsed ?? 'none'}, confidence: ${result.diagnostics.avgConfidence.toFixed(2)})`,
      )
    } catch (e) {
      log.debug(`Error getting ${category}s: ${e}`)
    }
  }

  return deduplicateItems(accomplishments, (item) => `${item.category}|${item.title}`)
}
