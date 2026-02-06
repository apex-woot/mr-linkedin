import { SCRAPING_CONSTANTS } from '../../config/constants'
import {
  findItemsWithFallback,
  findSectionByHeading,
  navigateToSection,
  scrollSection,
  sectionHasContent,
} from './helpers'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult } from './types'

export class PatentPageExtractor implements PageExtractor {
  readonly sectionName = 'patent'

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const mainPageItems = await this.extractFromMainPage(config)
    if (mainPageItems.length > 0) {
      return {
        kind: 'list',
        items: mainPageItems.map((locator) => ({ locator, context: {} })),
      }
    }

    const didNavigate = await navigateToSection(
      config.page,
      config.baseUrl,
      'details/patents/',
      config.focusWait ?? SCRAPING_CONSTANTS.PATENTS_FOCUS_WAIT,
    )

    if (!didNavigate) return { kind: 'list', items: [] }

    const hasContent = await sectionHasContent(config.page)
    if (!hasContent) return { kind: 'list', items: [] }

    await scrollSection(config.page, {
      pauseTime: config.scroll?.pauseTime ?? SCRAPING_CONSTANTS.PATENTS_SCROLL_PAUSE,
      maxScrolls: config.scroll?.maxScrolls ?? SCRAPING_CONSTANTS.PATENTS_MAX_SCROLLS,
    })

    const detailsItems = await findItemsWithFallback(config.page, this.sectionName)
    return {
      kind: 'list',
      items: detailsItems.map((locator) => ({ locator, context: {} })),
    }
  }

  private async extractFromMainPage(config: PageExtractorConfig) {
    const section = await findSectionByHeading(config.page, 'Patents')
    if (!section) return []

    return await section.locator('ul > li, ol > li').all()
  }
}
