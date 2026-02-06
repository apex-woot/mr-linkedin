import type { Page } from 'playwright'
import { ExperienceParser } from '../../extraction/parsers'
import { ExperiencePageExtractor } from '../../extraction/page-extractors'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import type { Experience } from '../../models/person'
import { log } from '../../utils/logger'
import { deduplicateItems } from './common-patterns'

export async function getExperiences(page: Page, baseUrl: string): Promise<Experience[]> {
  try {
    const pipeline = new ExtractionPipeline<Experience>({
      pageExtractor: new ExperiencePageExtractor(),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new ExperienceParser(),
      confidenceThreshold: 0.3,
      captureHtmlOnFailure: true,
    })

    const result = await pipeline.extract({ page, baseUrl })

    log.info(
      `Got ${result.items.length} experiences (extractor: ${result.diagnostics.textExtractorUsed ?? 'none'}, confidence: ${result.diagnostics.avgConfidence.toFixed(2)})`,
    )

    if (result.items.length === 0) {
      log.debug(
        `Experience extraction failed. Text extractors attempted: ${result.diagnostics.textExtractorsAttempted.join(', ')}`,
      )
    }

    return deduplicateItems(result.items, (exp) => `${exp.company}|${exp.positions[0]?.title}`)
  } catch (e) {
    log.warning(`Error getting experiences: ${e}`)
    return []
  }
}
