import type { Locator } from 'playwright'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult } from './types'

const ABOUT_ROOT_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '[data-view-name="profile-card-about"]',
  '[data-view-name="profile-card"]',
] as const

export class AboutPageExtractor implements PageExtractor {
  readonly sectionName = 'about'

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const element = await this.resolveElement(config)

    return {
      kind: 'single',
      element,
      context: {},
    }
  }

  private async resolveElement(config: PageExtractorConfig): Promise<Locator> {
    for (const selector of ABOUT_ROOT_SELECTORS) {
      const candidate = config.page.locator(selector).first()
      if ((await candidate.count()) > 0) return candidate
    }

    return config.page.locator('main').first()
  }
}
