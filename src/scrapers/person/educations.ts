import type { Locator, Page } from 'playwright'
import type { Education } from '../../models'
import { trySelectorsForAll } from '../../utils/selector-utils'
import {
  navigateAndWait,
  scrollPageToBottom,
  scrollPageToHalf,
  waitAndFocus,
} from '../utils'
import { extractUniqueTextsFromElement, parseEducationTimes } from './utils'

export async function getEducations(
  page: Page,
  baseUrl: string,
): Promise<Education[]> {
  const educations: Education[] = []

  try {
    const educationHeading = page.locator('h2:has-text("Education")').first()

    if ((await educationHeading.count()) > 0) {
      let educationSection = educationHeading.locator(
        'xpath=ancestor::*[.//ul or .//ol][1]',
      )
      if ((await educationSection.count()) === 0)
        educationSection = educationHeading.locator('xpath=ancestor::*[4]')

      if ((await educationSection.count()) > 0) {
        const items = await educationSection.locator('ul > li, ol > li').all()

        for (const item of items) {
          try {
            const edu = await parseMainPageEducation(item)
            if (edu) educations.push(edu)
          } catch (e) {
            console.debug(`Error parsing education from main page: ${e}`)
          }
        }
      }
    }

    if (educations.length === 0) {
      const eduUrl = `${baseUrl.replace(/\/$/, '')}/details/education/`
      await navigateAndWait(page, eduUrl)
      await page.waitForSelector('main', { timeout: 10000 })
      await waitAndFocus(page, 2)
      await scrollPageToHalf(page)
      await scrollPageToBottom(page, 0.5, 5)

      // Use selector system to find education items (same structure as experience)
      const itemsResult = await trySelectorsForAll(
        page,
        {
          primary: [
            {
              selector: '[componentkey^="entity-collection-item"]',
              description: 'Modern education items by componentkey',
            },
          ],
          fallback: [
            {
              selector: '.pvs-list__container .pvs-list__paged-list-item',
              description: 'Old list items',
            },
          ],
        },
        0, // Allow 0 items (profile might have no education)
      )

      console.debug(
        `Found ${itemsResult.value.length} education items using: ${itemsResult.usedSelector}`,
      )

      for (const item of itemsResult.value) {
        try {
          const edu = await parseEducationItem(item)
          if (edu) educations.push(edu)
        } catch (e) {
          console.debug(`Error parsing education item: ${e}`)
        }
      }
    }
  } catch (e) {
    console.warn(`Error getting educations: ${e}`)
  }

  return educations
}

async function parseMainPageEducation(
  item: Locator,
): Promise<Education | null> {
  try {
    const links = await item.locator('a').all()
    if (links.length === 0) return null

    const institutionUrl = (await links[0]?.getAttribute('href')) ?? undefined
    const detailLink = links.length > 1 ? links[1] : links[0]

    if (!detailLink) return null

    const uniqueTexts = await extractUniqueTextsFromElement(detailLink)

    if (uniqueTexts.length === 0) return null

    const institutionName = uniqueTexts[0] ?? ''
    let degree: string | null = null
    let times = ''

    if (uniqueTexts.length === 3) {
      degree = uniqueTexts[1] ?? null
      times = uniqueTexts[2] ?? ''
    } else if (uniqueTexts.length === 2) {
      const second = uniqueTexts[1] ?? ''
      if (second.includes(' - ') || /\d/.test(second)) times = second
      else degree = second
    }

    const { fromDate, toDate } = parseEducationTimes(times)

    return {
      institutionName,
      degree: degree?.trim() || undefined,
      linkedinUrl: institutionUrl,
      fromDate: fromDate ?? undefined,
      toDate: toDate ?? undefined,
    }
  } catch (e) {
    console.debug(`Error parsing main page education: ${e}`)
    return null
  }
}

async function parseEducationItem(item: Locator): Promise<Education | null> {
  try {
    const links = await item.locator('a, link').all()
    if (links.length >= 1) {
      const institutionUrl = (await links[0]?.getAttribute('href')) ?? undefined

      const detailLink = links.length >= 2 ? links[1]! : links[0]!
      const generics = await detailLink.locator('generic, span, div').all()
      const texts: string[] = []
      for (const g of generics) {
        const text = await g.textContent()
        if (text?.trim() && text.trim().length < 200) texts.push(text.trim())
      }

      const uniqueTexts = Array.from(new Set(texts))

      if (uniqueTexts.length > 0) {
        const institutionName = uniqueTexts[0]!
        let degree: string | null = null
        let times = ''

        if (uniqueTexts.length === 3) {
          degree = uniqueTexts[1]!
          times = uniqueTexts[2]!
        } else if (uniqueTexts.length === 2) {
          const second = uniqueTexts[1]!
          if (second.includes(' - ') || /\d/.test(second)) times = second
          else degree = second
        }

        const { fromDate, toDate } = parseEducationTimes(times)

        return {
          institutionName,
          degree: degree?.trim() || undefined,
          linkedinUrl: institutionUrl,
          fromDate: fromDate ?? undefined,
          toDate: toDate ?? undefined,
        }
      }
    }

    const entity = item
      .locator('div[data-view-name="profile-component-entity"]')
      .first()
    if ((await entity.count()) === 0) return null

    const children = await entity.locator('> *').all()
    if (children.length < 2) return null

    const institutionLink = children[0]?.locator('a').first()
    const institutionUrl = institutionLink
      ? ((await institutionLink.getAttribute('href')) ?? undefined)
      : undefined

    const detailContainer = children[1]
    if (!detailContainer) return null

    const detailChildren = await detailContainer.locator('> *').all()

    if (detailChildren.length === 0) return null

    const firstDetail = detailChildren[0]
    if (!firstDetail) return null

    const nestedElements = await firstDetail.locator('> *').all()

    if (nestedElements.length === 0) return null

    const spanContainer = nestedElements[0]
    if (!spanContainer) return null

    const outerSpans = await spanContainer.locator('> *').all()

    let institutionName = ''
    let degree: string | null = null
    let times = ''

    if (outerSpans.length >= 1) {
      const ariaSpan = outerSpans[0]
        ?.locator('span[aria-hidden="true"]')
        .first()
      institutionName = ariaSpan ? (await ariaSpan.textContent()) || '' : ''
    }

    if (outerSpans.length === 3) {
      const ariaSpan1 = outerSpans[1]
        ?.locator('span[aria-hidden="true"]')
        .first()
      degree = ariaSpan1 ? await ariaSpan1.textContent() : null
      const ariaSpan2 = outerSpans[2]
        ?.locator('span[aria-hidden="true"]')
        .first()
      times = ariaSpan2 ? (await ariaSpan2.textContent()) || '' : ''
    } else if (outerSpans.length === 2) {
      const ariaSpan = outerSpans[1]
        ?.locator('span[aria-hidden="true"]')
        .first()
      times = ariaSpan ? (await ariaSpan.textContent()) || '' : ''
    }

    const { fromDate, toDate } = parseEducationTimes(times)

    let description = ''
    if (detailChildren.length > 1)
      description = (await detailChildren[1]?.innerText()) ?? ''

    return {
      institutionName: institutionName.trim(),
      degree: degree?.trim() || undefined,
      linkedinUrl: institutionUrl,
      fromDate: fromDate ?? undefined,
      toDate: toDate ?? undefined,
      description: description.trim() || undefined,
    }
  } catch (e) {
    console.debug(`Error parsing education: ${e}`)
    return null
  }
}
