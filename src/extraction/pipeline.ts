import type { Locator } from 'playwright'
import { deduplicateItems } from '../scrapers/person/common-patterns'
import { log } from '../utils/logger'
import type { PageExtractor, PageExtractorConfig, RawSection, TaggedLocator } from './page-extractors'
import type { Parser, RawParser } from './parsers'
import type { ExtractedText, TextExtractor } from './text-extractors'

export interface PipelineDiagnostics {
  sectionName: string
  textExtractorsAttempted: string[]
  textExtractorUsed: string | null
  itemsFound: number
  itemsParsed: number
  itemsFailed: number
  avgConfidence: number
  durationMs: number
  capturedHtml?: string
}

export interface PipelineResult<T> {
  items: T[]
  diagnostics: PipelineDiagnostics
}

export interface PipelineConfig<T> {
  pageExtractor: PageExtractor
  textExtractors: TextExtractor[]
  parser: Parser<T>
  confidenceThreshold?: number
  deduplicateKey?: (item: T) => string
  captureHtmlOnFailure?: boolean
}

export class ExtractionPipeline<T> {
  private readonly config: PipelineConfig<T>
  private readonly textExtractors: TextExtractor[]

  constructor(config: PipelineConfig<T>) {
    this.config = config
    this.textExtractors = [...config.textExtractors].sort((a, b) => a.priority - b.priority)
  }

  async extract(extractorConfig: PageExtractorConfig): Promise<PipelineResult<T>> {
    const startTime = Date.now()
    const diagnostics: PipelineDiagnostics = {
      sectionName: this.config.pageExtractor.sectionName,
      textExtractorsAttempted: [],
      textExtractorUsed: null,
      itemsFound: 0,
      itemsParsed: 0,
      itemsFailed: 0,
      avgConfidence: 0,
      durationMs: 0,
    }

    const pageResult = await this.config.pageExtractor.extract(extractorConfig)
    let items: T[] = []
    let totalConfidence = 0

    switch (pageResult.kind) {
      case 'list': {
        const handled = await this.handleList(pageResult.items, diagnostics)
        items = handled.items
        totalConfidence = handled.totalConfidence
        break
      }
      case 'single': {
        const handled = await this.handleSingle(pageResult.element, pageResult.context, diagnostics)
        items = handled.items
        totalConfidence = handled.totalConfidence
        break
      }
      case 'raw': {
        items = this.handleRaw(pageResult.data, diagnostics)
        break
      }
    }

    if (this.config.deduplicateKey) items = deduplicateItems(items, this.config.deduplicateKey)

    if (items.length > 0) diagnostics.avgConfidence = totalConfidence / items.length

    if (this.config.captureHtmlOnFailure && items.length === 0) {
      try {
        diagnostics.capturedHtml = (
          await extractorConfig.page
            .locator('main')
            .innerHTML()
            .catch(() => '')
        ).slice(0, 8000)
      } catch {
        // Best effort.
      }
    }

    diagnostics.durationMs = Date.now() - startTime
    return { items, diagnostics }
  }

  private async handleList(
    taggedLocators: TaggedLocator[],
    diagnostics: PipelineDiagnostics,
  ): Promise<{ items: T[]; totalConfidence: number }> {
    diagnostics.itemsFound = taggedLocators.length

    const items: T[] = []
    let totalConfidence = 0

    for (const { locator, context } of taggedLocators) {
      const extracted = await this.extractText(locator, diagnostics)
      if (!extracted) {
        diagnostics.itemsFailed++
        continue
      }

      const parsed = this.config.parser.parse({
        texts: extracted.texts,
        links: extracted.links,
        subItems: extracted.subItems?.map((subItem) => ({
          texts: subItem.texts,
          links: subItem.links,
          context,
        })),
        context,
      })

      if (parsed && this.config.parser.validate(parsed)) {
        items.push(parsed)
        diagnostics.itemsParsed++
        totalConfidence += extracted.confidence
      } else {
        diagnostics.itemsFailed++
      }
    }

    return { items, totalConfidence }
  }

  private async handleSingle(
    element: Locator,
    context: Record<string, string>,
    diagnostics: PipelineDiagnostics,
  ): Promise<{ items: T[]; totalConfidence: number }> {
    diagnostics.itemsFound = 1

    const extracted = await this.extractText(element, diagnostics)
    if (!extracted) {
      diagnostics.itemsFailed = 1
      return { items: [], totalConfidence: 0 }
    }

    const parsed = this.config.parser.parse({
      texts: extracted.texts,
      links: extracted.links,
      context,
    })

    if (parsed && this.config.parser.validate(parsed)) {
      diagnostics.itemsParsed = 1
      return { items: [parsed], totalConfidence: extracted.confidence }
    }

    diagnostics.itemsFailed = 1
    return { items: [], totalConfidence: 0 }
  }

  private handleRaw(data: RawSection[], diagnostics: PipelineDiagnostics): T[] {
    diagnostics.itemsFound = data.length

    if (hasParseRaw(this.config.parser)) {
      const items = this.config.parser.parseRaw(data)
      diagnostics.itemsParsed = items.length
      diagnostics.itemsFailed = Math.max(0, data.length - items.length)
      return items
    }

    const items: T[] = []
    for (const section of data) {
      const parsed = this.config.parser.parse({
        texts: [section.heading, section.text],
        links: section.anchors
          .filter((anchor) => !!anchor.href)
          .map((anchor) => ({
            url: anchor.href ?? '',
            text: anchor.text ?? '',
            isExternal: true,
          })),
        context: { heading: section.heading },
      })

      if (parsed && this.config.parser.validate(parsed)) {
        items.push(parsed)
        diagnostics.itemsParsed++
      } else {
        diagnostics.itemsFailed++
      }
    }

    return items
  }

  private async extractText(element: Locator, diagnostics: PipelineDiagnostics): Promise<ExtractedText | null> {
    const threshold = this.config.confidenceThreshold ?? 0.5
    let bestBelowThreshold: ExtractedText | null = null

    for (const extractor of this.textExtractors) {
      addAttempt(diagnostics.textExtractorsAttempted, extractor.name)

      try {
        if (!(await extractor.canHandle(element))) continue

        const extracted = await extractor.extract(element)
        if (!extracted || extracted.texts.length === 0) continue

        if (extracted.confidence >= threshold) {
          diagnostics.textExtractorUsed ??= extractor.name
          return extracted
        }

        if (!bestBelowThreshold || extracted.confidence > bestBelowThreshold.confidence) {
          bestBelowThreshold = extracted
        }
      } catch (e) {
        log.debug(`Pipeline text extraction failed with ${extractor.name}: ${e}`)
      }
    }

    if (bestBelowThreshold) {
      diagnostics.textExtractorUsed ??= 'low-confidence-fallback'
      return bestBelowThreshold
    }

    return null
  }
}

function addAttempt(attempts: string[], name: string): void {
  if (!attempts.includes(name)) attempts.push(name)
}

function hasParseRaw<T>(parser: Parser<T>): parser is RawParser<T> {
  return 'parseRaw' in parser && typeof parser.parseRaw === 'function'
}
