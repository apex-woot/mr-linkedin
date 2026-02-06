import type { Locator, Page } from 'playwright'
import { EducationPageExtractor } from '../../extraction/page-extractors'
import type { Education } from '../../models'
import { log } from '../../utils/logger'
import { deduplicateItems, parseItems } from './common-patterns'
import { extractUniqueTextsFromElement, parseDateRange } from './utils'

export async function getEducations(
  page: Page,
  baseUrl: string,
): Promise<Education[]> {
  const educations: Education[] = []

  try {
    const extraction = await new EducationPageExtractor().extract({
      page,
      baseUrl,
    })
    if (extraction.kind !== 'list' || extraction.items.length === 0) {
      return []
    }

    const items = extraction.items.map((item) => item.locator)
    log.info(`Got ${items.length} education candidates`)

    const parsed = await parseItems(items, parseExtractedEducation, {
      itemType: 'education item',
    })
    educations.push(...parsed)
  } catch (e) {
    log.warning(`Error getting educations: ${e}`)
  }

  return deduplicateItems(
    educations,
    (edu) => `${edu.institutionName}|${edu.degree}|${edu.fromDate}`,
  )
}

async function parseExtractedEducation(item: Locator): Promise<Education | null> {
  return (await parseEducationItem(item)) ?? (await parseMainPageEducation(item))
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

    const { fromDate, toDate } = parseDateRange(times)

    return {
      institutionName,
      degree: degree?.trim() || undefined,
      linkedinUrl: institutionUrl,
      fromDate: fromDate ?? undefined,
      toDate: toDate ?? undefined,
    }
  } catch (e) {
    log.debug(`Error parsing main page education: ${e}`)
    return null
  }
}

async function parseEducationItem(item: Locator): Promise<Education | null> {
  try {
    const links = await item.locator('a, link').all()
    if (links.length >= 1) {
      const institutionUrl = (await links[0]?.getAttribute('href')) ?? undefined

      const detailLink = links.length >= 2 ? links[1] : links[0]
      if (!detailLink) return null

      const generics = await detailLink.locator('generic, span, div').all()
      const texts: string[] = []
      for (const g of generics) {
        const text = await g.textContent()
        if (text?.trim() && text.trim().length < 200) texts.push(text.trim())
      }

      const uniqueTexts = Array.from(new Set(texts))

      if (uniqueTexts.length > 0) {
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

        const { fromDate, toDate } = parseDateRange(times)

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

    const { fromDate, toDate } = parseDateRange(times)

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
    log.debug(`Error parsing education: ${e}`)
    return null
  }
}
