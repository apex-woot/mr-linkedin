import type { Locator, Page } from 'playwright'
import type { Interest } from '../../models'
import { log } from '../../utils/logger'
import { navigateAndWait, waitAndFocus } from '../utils'
import { parseItems } from './common-patterns'
import {
  extractUniqueTextsFromElement,
  mapInterestTabToCategory,
  toPlainText,
} from './utils'

export async function getInterests(
  page: Page,
  baseUrl: string,
): Promise<Interest[]> {
  const interests: Interest[] = []

  try {
    const interestsHeading = page.locator('h2:has-text("Interests")').first()

    if ((await interestsHeading.count()) > 0) {
      let interestsSection = interestsHeading.locator(
        'xpath=ancestor::*[.//tablist or .//*[@role="tablist"]][1]',
      )
      if ((await interestsSection.count()) === 0)
        interestsSection = interestsHeading.locator('xpath=ancestor::*[4]')

      const tabs =
        (await interestsSection.count()) > 0
          ? await interestsSection.locator('[role="tab"], tab').all()
          : []

      if (tabs.length > 0) {
        for (const tab of tabs) {
          try {
            const tabName = await tab.textContent()
            if (!tabName) continue
            const category = mapInterestTabToCategory(tabName.trim())

            await tab.click()
            await waitAndFocus(page, 0.5)

            const tabpanel = interestsSection
              .locator('[role="tabpanel"]')
              .first()
            if ((await tabpanel.count()) > 0) {
              const listItems = await tabpanel.locator('li, listitem').all()
              log.info(
                `Got ${listItems.length} interest candidates for ${category}`,
              )
              const parsed = await parseItems(
                listItems,
                async (item, _idx) => await parseInterestItem(item, category),
                { itemType: 'interest item' },
              )
              interests.push(...parsed)
            }
          } catch (e) {
            log.debug(`Error processing interest tab: ${e}`)
          }
        }
      }
    }

    if (interests.length === 0) {
      const interestsUrl = `${baseUrl.replace(/\/$/, '')}/details/interests/`
      await navigateAndWait(page, interestsUrl)
      await page.waitForSelector('main', { timeout: 10000 })
      await waitAndFocus(page, 1.5)

      const tabs = await page.locator('[role="tab"], tab').all()

      for (const tab of tabs) {
        try {
          const tabName = await tab.textContent()
          if (!tabName) continue
          const category = mapInterestTabToCategory(tabName.trim())

          await tab.click()
          await waitAndFocus(page, 0.8)

          const tabpanel = page.locator('[role="tabpanel"], tabpanel').first()
          const listItems = await tabpanel
            .locator('listitem, li, .pvs-list__paged-list-item')
            .all()

          log.info(
            `Got ${listItems.length} interest candidates for ${category}`,
          )
          const parsed = await parseItems(
            listItems,
            async (item, _idx) => await parseInterestItem(item, category),
            { itemType: 'interest item' },
          )
          interests.push(...parsed)
        } catch (e) {
          log.debug(`Error processing interest tab: ${e}`)
        }
      }
    }
  } catch (e) {
    log.warning(`Error getting interests: ${e}`)
  }

  return interests
}

async function parseInterestItem(
  item: Locator,
  category: string,
): Promise<Interest | null> {
  try {
    const link = item.locator('a, link').first()
    if ((await link.count()) === 0) return null
    const href = (await link.getAttribute('href')) ?? undefined

    const uniqueTexts = await extractUniqueTextsFromElement(item)
    const name = uniqueTexts.length > 0 ? (uniqueTexts[0] ?? null) : null

    if (name && href)
      return {
        name,
        category,
        linkedinUrl: href,
        plainText: toPlainText(uniqueTexts),
      }
    return null
  } catch (e) {
    log.debug(`Error parsing interest: ${e}`)
    return null
  }
}
