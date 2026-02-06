import type { Page } from 'playwright'
import { EducationPageExtractor } from '../../extraction/page-extractors'
import { EducationParser } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import type { Education } from '../../models'
import { log } from '../../utils/logger'
import { deduplicateItems } from './common-patterns'

export async function getEducations(page: Page, baseUrl: string): Promise<Education[]> {
  try {
    const pipeline = new ExtractionPipeline<Education>({
      pageExtractor: new EducationPageExtractor(),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new EducationParser(),
      confidenceThreshold: 0.25,
      captureHtmlOnFailure: true,
      deduplicateKey: (edu) => `${edu.institutionName}|${edu.degree}|${edu.fromDate}`,
    })

    const result = await pipeline.extract({ page, baseUrl })
    log.info(
      `Got ${result.items.length} educations (extractor: ${result.diagnostics.textExtractorUsed ?? 'none'}, confidence: ${result.diagnostics.avgConfidence.toFixed(2)})`,
    )

    return deduplicateItems(result.items, (edu) => `${edu.institutionName}|${edu.degree}|${edu.fromDate}`)
  } catch (e) {
    log.warning(`Error getting educations: ${e}`)
    return []
  }
}
