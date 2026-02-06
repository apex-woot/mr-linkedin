import type { Locator, Page } from 'playwright'
import { ContactPageExtractor } from '../../extraction/page-extractors'
import { ContactParser } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import type { Contact } from '../../models'
import { log } from '../../utils/logger'

export async function getContactInfo(page: Page, baseUrl: string): Promise<Contact[]> {
  try {
    const pipeline = new ExtractionPipeline<Contact>({
      pageExtractor: new ContactPageExtractor(),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new ContactParser(),
      confidenceThreshold: 0,
      captureHtmlOnFailure: true,
      deduplicateKey: (contact) => `${contact.type}|${contact.value}`,
    })

    const result = await pipeline.extract({ page, baseUrl })
    log.info(`Got ${result.items.length} contacts`)

    return result.items
  } catch (e) {
    log.warning(`Error getting contacts: ${e}`)
    return []
  }
}

export async function extractContactsFromDialog(dialog: Locator): Promise<Contact[]> {
  const extractor = new ContactPageExtractor()
  const rawSections = await extractor.extractRawSections(dialog)
  return new ContactParser().parseRaw(rawSections)
}
