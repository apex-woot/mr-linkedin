import type { Page } from 'playwright'
import { InterestPageExtractor } from '../../extraction/page-extractors'
import { InterestParser } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import type { Interest } from '../../models'
import { log } from '../../utils/logger'

export async function getInterests(page: Page, baseUrl: string): Promise<Interest[]> {
  try {
    const pipeline = new ExtractionPipeline<Interest>({
      pageExtractor: new InterestPageExtractor(),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new InterestParser(),
      confidenceThreshold: 0.25,
      captureHtmlOnFailure: true,
      deduplicateKey: (interest) => `${interest.category}|${interest.name}|${interest.linkedinUrl || ''}`,
    })

    const result = await pipeline.extract({ page, baseUrl })
    log.info(
      `Got ${result.items.length} interests (extractor: ${result.diagnostics.textExtractorUsed ?? 'none'}, confidence: ${result.diagnostics.avgConfidence.toFixed(2)})`,
    )

    return result.items
  } catch (e) {
    log.warning(`Error getting interests: ${e}`)
    return []
  }
}
