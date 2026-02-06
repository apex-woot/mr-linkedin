import type { Page } from 'playwright'
import { PatentPageExtractor } from '../../extraction/page-extractors'
import { PatentParser } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import type { Patent } from '../../models/person'
import { log } from '../../utils/logger'
import { deduplicateItems } from './common-patterns'

export async function getPatents(page: Page, baseUrl: string): Promise<Patent[]> {
  try {
    const pipeline = new ExtractionPipeline<Patent>({
      pageExtractor: new PatentPageExtractor(),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new PatentParser(),
      confidenceThreshold: 0.25,
      captureHtmlOnFailure: true,
      deduplicateKey: (patent) => `${patent.title}|${patent.number || ''}`,
    })

    const result = await pipeline.extract({ page, baseUrl })
    log.info(
      `Got ${result.items.length} patents (extractor: ${result.diagnostics.textExtractorUsed ?? 'none'}, confidence: ${result.diagnostics.avgConfidence.toFixed(2)})`,
    )

    return deduplicateItems(result.items, (p) => `${p.title}|${p.number || ''}`)
  } catch (e) {
    log.warning(`Error getting patents: ${e}`)
    return []
  }
}
