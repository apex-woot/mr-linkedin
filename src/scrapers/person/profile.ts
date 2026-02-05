import type { Page } from 'playwright'
import {
  ABOUT_SELECTORS,
  LOCATION_SELECTORS,
  NAME_SELECTORS,
  TEST_ID_SELECTORS,
} from '../../config/selectors'
import { trySelectors, trySelectorsForText } from '../../utils/selector-utils'
import { getAttributeSafe } from '../utils'

export async function getNameAndLocation(
  page: Page,
): Promise<{ name: string; location: string | null }> {
  try {
    // Use new selector system with fallbacks
    const nameResult = await trySelectorsForText(
      page,
      NAME_SELECTORS,
      'Unknown',
    )
    const locationResult = await trySelectorsForText(
      page,
      LOCATION_SELECTORS,
      '',
    )

    if (nameResult.usedFallback) {
      console.warn(
        `⚠ Name found using fallback selector: ${nameResult.usedSelector}`,
      )
    }
    if (locationResult.usedFallback) {
      console.warn(
        `⚠ Location found using fallback selector: ${locationResult.usedSelector}`,
      )
    }

    return {
      name: nameResult.value,
      location: locationResult.value || null,
    }
  } catch (e) {
    console.warn(`Error getting name/location: ${e}`)
    return { name: 'Unknown', location: null }
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
      console.debug(
        `✓ Found about text using: ${expandableTextResult.usedSelector}`,
      )
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
    console.debug(`Error getting about section: ${e}`)
    return null
  }
}
