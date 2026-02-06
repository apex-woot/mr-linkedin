import type { Page } from 'playwright'
import { ABOUT_SELECTORS, TEST_ID_SELECTORS } from '../../config/selectors'
import { log } from '../../utils/logger'
import { trySelectors, trySelectorsForText } from '../../utils/selector-utils'
import { getAttributeSafe } from '../utils'
import { extractTopCardFromPage } from './top-card'

export interface TopCardProfileInfo {
  name: string
  location: string | null
  headline: string | null
  origin: string | null
}

export async function getTopCardProfileInfo(
  page: Page,
): Promise<TopCardProfileInfo> {
  try {
    const topCardInfo = await extractTopCardFromPage(page)

    return {
      name: topCardInfo.name,
      location: topCardInfo.origin,
      headline: topCardInfo.headline,
      origin: topCardInfo.origin,
    }
  } catch (e) {
    log.warning(`Error getting name/location: ${e}`)
    return { name: 'Unknown', location: null, headline: null, origin: null }
  }
}

export async function checkOpenToWork(page: Page): Promise<boolean> {
  try {
    const imgTitle = await getAttributeSafe(
      page,
      '.pv-top-card-profile-picture img',
      'title',
      '',
    )
    return imgTitle.toUpperCase().includes('#OPEN_TO_WORK')
  } catch {
    return false
  }
}

export async function getAbout(page: Page): Promise<string | null> {
  try {
    // Try the new data-testid selector first (most reliable)
    const expandableTextResult = await trySelectorsForText(
      page,
      {
        primary: [
          {
            selector: TEST_ID_SELECTORS.expandableText,
            description: 'Expandable text box',
          },
        ],
      },
      '',
    )

    if (expandableTextResult.value) {
      log.debug(`Found about text using: ${expandableTextResult.usedSelector}`)
      return expandableTextResult.value
    }

    // Fallback: Try to find the about card and extract text
    const aboutCardResult = await trySelectors(page, ABOUT_SELECTORS)

    if (aboutCardResult.value) {
      const card = aboutCardResult.value

      // Try new expandable text selector within card
      const textBox = card.locator(TEST_ID_SELECTORS.expandableText).first()
      if ((await textBox.count()) > 0) {
        const text = await textBox.textContent()
        return text ? text.trim() : null
      }

      // Try old span[aria-hidden="true"] selector
      const aboutSpans = await card.locator('span[aria-hidden="true"]').all()
      if (aboutSpans.length > 1) {
        const aboutText = await aboutSpans[1]?.textContent()
        return aboutText ? aboutText.trim() : null
      }
    }

    return null
  } catch (e) {
    log.debug(`Error getting about section: ${e}`)
    return null
  }
}
