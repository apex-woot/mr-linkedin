import { SCRAPING_CONSTANTS } from '../../config/constants'
import { findItemsWithFallback, navigateToSection, scrollSection } from './helpers'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult } from './types'

export class ExperiencePageExtractor implements PageExtractor {
  readonly sectionName = 'experience'

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const didNavigate = await navigateToSection(
      config.page,
      config.baseUrl,
      'details/experience/',
      config.focusWait ?? SCRAPING_CONSTANTS.EXPERIENCE_FOCUS_WAIT,
    )

    if (!didNavigate) return { kind: 'list', items: [] }

    await scrollSection(config.page, {
      pauseTime: config.scroll?.pauseTime ?? SCRAPING_CONSTANTS.EXPERIENCE_SCROLL_PAUSE,
      maxScrolls: config.scroll?.maxScrolls ?? SCRAPING_CONSTANTS.EXPERIENCE_MAX_SCROLLS,
    })

    const items = await findItemsWithFallback(config.page, this.sectionName)
    return {
      kind: 'list',
      items: items.map((locator) => ({ locator, context: {} })),
    }
  }
}
