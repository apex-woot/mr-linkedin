import type { Locator, Page } from 'playwright'
import { mapInterestTabToCategory } from '../../scrapers/person/utils'
import { waitAndFocus } from '../../scrapers/utils'
import { findSectionByHeading, navigateToSection } from './helpers'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult, TaggedLocator } from './types'

type LocatorScope = Page | Locator

export class InterestPageExtractor implements PageExtractor {
  readonly sectionName = 'interest'

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const mainSection = await findSectionByHeading(config.page, 'Interests')
    if (mainSection) {
      const mainItems = await this.extractItemsFromTabs(mainSection, config.page, 0.5)
      if (mainItems.length > 0) return { kind: 'list', items: mainItems }
    }

    const didNavigate = await navigateToSection(
      config.page,
      config.baseUrl,
      'details/interests/',
      config.focusWait ?? 1.5,
    )
    if (!didNavigate) return { kind: 'list', items: [] }

    const detailsItems = await this.extractItemsFromTabs(config.page, config.page, 0.8)
    return { kind: 'list', items: detailsItems }
  }

  private async extractItemsFromTabs(scope: LocatorScope, page: Page, waitSeconds: number): Promise<TaggedLocator[]> {
    const collected: TaggedLocator[] = []
    const tabs = await scope.locator('[role="tab"], tab').all()

    for (const tab of tabs) {
      const tabName = (await tab.textContent())?.trim()
      if (!tabName) continue

      const category = mapInterestTabToCategory(tabName)

      try {
        await tab.click()
        await waitAndFocus(page, waitSeconds)
      } catch {
        continue
      }

      const tabpanel = scope.locator('[role="tabpanel"], tabpanel').first()
      if ((await tabpanel.count()) === 0) continue

      const items = await tabpanel.locator('listitem, li, .pvs-list__paged-list-item').all()

      for (const locator of items) {
        collected.push({
          locator,
          context: { category },
        })
      }
    }

    return collected
  }
}
