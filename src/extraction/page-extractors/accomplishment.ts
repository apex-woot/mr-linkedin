import { findItemsWithFallback, navigateToSection, sectionHasContent } from './helpers'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult } from './types'

export interface AccomplishmentPageExtractorOptions {
  urlPath: string
  category: string
}

export class AccomplishmentPageExtractor implements PageExtractor {
  readonly sectionName = 'accomplishment'

  private readonly urlPath: string
  private readonly category: string

  constructor(options: AccomplishmentPageExtractorOptions) {
    this.urlPath = options.urlPath
    this.category = options.category
  }

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const didNavigate = await navigateToSection(
      config.page,
      config.baseUrl,
      `details/${this.urlPath}/`,
      config.focusWait ?? 1,
    )

    if (!didNavigate) return { kind: 'list', items: [] }

    const hasContent = await sectionHasContent(config.page)
    if (!hasContent) return { kind: 'list', items: [] }

    const items = await findItemsWithFallback(config.page, this.sectionName)
    return {
      kind: 'list',
      items: items.map((locator) => ({
        locator,
        context: { category: this.category },
      })),
    }
  }
}
