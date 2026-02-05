import type { Locator, Page } from 'playwright'
import type { Experience, Position } from '../../models/person'
import { trySelectorsForAll } from '../../utils/selector-utils'
import {
  navigateAndWait,
  scrollPageToBottom,
  scrollPageToHalf,
  waitAndFocus,
} from '../utils'
import { parseDateRange } from './utils'

export async function getExperiences(
  page: Page,
  baseUrl: string,
): Promise<Experience[]> {
  const experiences: Experience[] = []

  try {
    // Always navigate to details page for now to ensure we get all experiences
    // TODO: Optimize to only navigate if "Show more" button exists
    const expUrl = `${baseUrl.replace(/\/$/, '')}/details/experience/`
    console.debug('Navigating to experience details page')
    await navigateAndWait(page, expUrl)
    await page.waitForSelector('main', { timeout: 10000 })
    await waitAndFocus(page, 1.5)
    await scrollPageToHalf(page)
    await scrollPageToBottom(page, 0.5, 5)

    // Use selector system to find experience items
    // Top-level experiences are div elements with componentkey="entity-collection-item-*"
    const itemsResult = await trySelectorsForAll(
      page,
      {
        primary: [
          {
            selector: '[componentkey^="entity-collection-item"]',
            description: 'Modern experience items by componentkey',
          },
        ],
        fallback: [
          {
            selector: '.pvs-list__container .pvs-list__paged-list-item',
            description: 'Old list items',
          },
        ],
      },
      0, // Allow 0 items (profile might have no experience)
    )

    console.debug(
      `Found ${itemsResult.value.length} experience items using: ${itemsResult.usedSelector}`,
    )

    let processedCount = 0
    let skippedCount = 0

    for (let idx = 0; idx < itemsResult.value.length; idx++) {
      const item = itemsResult.value[idx]
      if (!item) continue
      console.debug(
        `\n--- Processing item ${idx + 1}/${itemsResult.value.length} ---`,
      )

      // Debug: show first link href to identify the item
      const firstLink = item.locator('a').first()
      if ((await firstLink.count()) > 0) {
        const href = await firstLink.getAttribute('href')
        console.debug(`Item link: ${href?.substring(0, 60)}...`)
      }

      try {
        // Check if this <li> has an ancestor <li> (meaning it's nested)
        const ancestorLi = item.locator('xpath=ancestor::li')
        const hasAncestorLi = (await ancestorLi.count()) > 0

        if (hasAncestorLi) {
          console.debug(
            '⊳ Skipping nested <li> item (will be parsed by parent)',
          )
          skippedCount++
          continue
        }

        processedCount++
        const result = await parseExperienceItem(item)
        if (result) {
          console.debug(
            `✓ Parsed experience at ${result.company} with ${result.positions.length} positions`,
          )
          experiences.push(result)
        } else {
          console.debug(`✗ Failed to parse experience item`)
        }
      } catch (e) {
        console.debug(`Error parsing experience item: ${e}`)
      }
    }

    console.debug(
      `\n--- Summary: Processed ${processedCount}, Skipped ${skippedCount}, Total parsed: ${experiences.length} ---`,
    )
  } catch (e) {
    console.warn(`Error getting experiences: ${e}`)
  }

  return experiences
}

interface ParsedLinks {
  companyUrl?: string
  contentLink: Locator
}

async function extractLinks(item: Locator): Promise<ParsedLinks | null> {
  const allLinks = await item.locator('a').all()
  if (allLinks.length < 2) return null

  const contentLink = allLinks[1]
  if (!contentLink) return null

  return {
    companyUrl: (await allLinks[0]?.getAttribute('href')) ?? undefined,
    contentLink,
  }
}

interface ItemMetadata {
  firstP: string
  secondP: string
  hasNestedUl: boolean
}

async function getItemMetadata(
  item: Locator,
  contentLink: Locator,
): Promise<ItemMetadata | null> {
  const pTags = await contentLink.locator('p').all()
  if (pTags.length < 2) return null

  const firstP = await pTags[0]?.textContent()
  const secondP = await pTags[1]?.textContent()

  if (!firstP || !secondP) return null

  return {
    firstP: firstP.trim(),
    secondP: secondP.trim(),
    hasNestedUl: (await item.locator('ul').count()) > 0,
  }
}

interface AdditionalFields {
  workTimes: string
  location: string
  description: string
}

async function extractAdditionalFields(
  item: Locator,
  skipTexts: string[],
): Promise<AdditionalFields> {
  let workTimes = ''
  let location = ''
  let description = ''

  const allElements = await item
    .locator('p, ul, [data-testid="expandable-text-box"]')
    .all()

  for (const element of allElements) {
    const rawText = (await element.textContent())?.trim()
    if (!rawText || skipTexts.includes(rawText)) continue

    const innerText = (await element.innerText())?.trim()
    const text = innerText || rawText

    // Priority 1: Expandable description (highest priority if marked)
    if ((await element.getAttribute('data-testid')) === 'expandable-text-box') {
      description = text
      continue
    }

    // Priority 2: Date/duration line
    if (!workTimes && isDateLine(text)) {
      workTimes = text
      continue
    }

    // Priority 3: Location (short, no numbers, after dates)
    if (!location && workTimes && isLocationLike(text)) {
      location = text
      continue
    }

    // Priority 4: Description (long text fallback)
    if (!description && isDescriptionLike(text)) {
      description = text
    }
  }

  return { workTimes, location, description }
}

function isDateLine(text: string): boolean {
  return (
    (text.includes(' - ') || text.includes('Present')) &&
    /\d{4}|\d+\s+(yr|yrs|mo|mos)/.test(text)
  )
}

function isLocationLike(text: string): boolean {
  return (
    text.length < 100 &&
    !text.includes('·') &&
    !/\d/.test(text) &&
    text.split(/\s+/).length <= 6
  )
}

function isDescriptionLike(text: string): boolean {
  return text.split(/\s+/).length > 6 || text.length > 100
}

async function parseExperienceItem(item: Locator): Promise<Experience | null> {
  try {
    // 1. Extract links and metadata
    const links = await extractLinks(item)
    if (!links) {
      console.debug('No links found, trying simplified fallback parser')
      return await parseExperienceItemSimpleFallback(item)
    }

    const metadata = await getItemMetadata(item, links.contentLink)
    if (!metadata) {
      console.debug('No metadata found, trying simplified fallback parser')
      return await parseExperienceItemSimpleFallback(item)
    }

    console.debug(`First <p>: "${metadata.firstP.substring(0, 50)}"`)
    console.debug(`Second <p>: "${metadata.secondP.substring(0, 50)}"`)
    console.debug(`Has nested UL: ${metadata.hasNestedUl}`)

    // 2. Detect pattern: multiple positions vs single position
    if (metadata.hasNestedUl) {
      console.debug('Pattern 2: Multiple positions')
      return await parseMultiplePositions(
        item,
        links.companyUrl,
        metadata.firstP,
      )
    }

    // 3. Parse single position (unified Pattern 1/3)
    console.debug('Pattern 1/3: Single position')
    return await parseSinglePosition(item, links.companyUrl, metadata)
  } catch (e) {
    console.debug(`Error parsing experience: ${e}`)
    return null
  }
}

async function parseMultiplePositions(
  item: Locator,
  companyUrl: string | undefined,
  companyName: string,
): Promise<Experience> {
  const positions = await parseNestedExperience(
    item,
    companyUrl ?? '',
    companyName,
  )
  return {
    company: companyName,
    companyUrl,
    positions,
  }
}

async function parseSinglePosition(
  item: Locator,
  companyUrl: string | undefined,
  metadata: ItemMetadata,
): Promise<Experience> {
  const { firstP, secondP } = metadata

  // Check if secondP contains company · type pattern
  const hasEmploymentType = secondP.includes(' · ')

  let positionTitle: string
  let companyName: string
  let employmentType: string | undefined

  if (hasEmploymentType) {
    // Pattern 1: "Position" / "Company · Type"
    positionTitle = firstP
    const parts = secondP.split(' · ')
    companyName = parts[0]?.trim() ?? ''
    employmentType = parts[1]?.trim() ?? undefined
  } else {
    // Pattern 3: "Position" / "Company"
    positionTitle = firstP
    companyName = secondP
  }

  // Extract additional fields (dates, location, description)
  const additional = await extractAdditionalFields(item, [firstP, secondP])
  const { fromDate, toDate, duration } = parseDateRange(additional.workTimes, {
    includeDuration: true,
  })

  return {
    company: companyName,
    companyUrl,
    positions: [
      {
        title: positionTitle,
        employmentType,
        fromDate: fromDate ?? undefined,
        toDate: toDate ?? undefined,
        duration: duration ?? undefined,
        location: additional.location || undefined,
        description: additional.description || undefined,
      },
    ],
  }
}

async function parseExperienceItemSimpleFallback(
  item: Locator,
): Promise<Experience | null> {
  try {
    console.debug('Using simplified fallback parser')

    // Collect all paragraph texts
    const pTags = await item.locator('p').all()
    const texts = (
      await Promise.all(pTags.map(async (p) => (await p.textContent())?.trim()))
    ).filter((t): t is string => !!t && t.length < 500)

    if (texts.length < 2) {
      console.debug('Not enough text elements found')
      return null
    }

    // Heuristic: first is position/company, second is company/position or date
    let positionTitle = texts[0] ?? ''
    let companyName = texts[1] ?? ''
    let workTimes = ''

    // If second text looks like a date, swap assumptions
    const secondText = texts[1]
    if (texts.length >= 2 && secondText && isDateLine(secondText)) {
      // texts[0] is likely company, texts[1] is date
      companyName = texts[0] ?? ''
      positionTitle = 'Unknown Position'
      workTimes = secondText
    } else if (texts.length >= 3) {
      // texts[0] = position, texts[1] = company, texts[2] = date
      workTimes = texts[2] ?? ''
    }

    const { fromDate, toDate, duration } = parseDateRange(workTimes, {
      includeDuration: true,
    })

    return {
      company: companyName || 'Unknown',
      companyUrl: undefined,
      positions: [
        {
          title: positionTitle || 'Unknown',
          fromDate: fromDate ?? undefined,
          toDate: toDate ?? undefined,
          duration: duration ?? undefined,
        },
      ],
    }
  } catch (e) {
    console.debug(`Error in fallback parser: ${e}`)
    return null
  }
}

async function parseNestedExperience(
  item: Locator,
  _companyUrl: string,
  _companyName: string,
): Promise<Position[]> {
  const positions: Position[] = []

  try {
    // Find nested <ul> within the item
    const nestedUl = item.locator('ul').first()
    if ((await nestedUl.count()) === 0) return []

    // Get all <li> items (positions)
    const nestedItems = await nestedUl.locator('> li').all()

    for (const nestedItem of nestedItems) {
      try {
        // Get the <a> tag within the <li>
        const link = nestedItem.locator('a').first()
        if ((await link.count()) === 0) continue

        // Get all <p> tags within the <a>
        const pTags = await link.locator('p').all()
        if (pTags.length < 2) continue

        // Extract position details
        let positionTitle = ''
        let employmentType = ''
        let workTimes = ''
        let location = ''

        if (pTags.length >= 1) {
          positionTitle = (await pTags[0]?.textContent())?.trim() ?? ''
        }
        if (pTags.length >= 2) {
          employmentType = (await pTags[1]?.textContent())?.trim() ?? ''
        }
        if (pTags.length >= 3) {
          workTimes = (await pTags[2]?.textContent())?.trim() ?? ''
        }
        if (pTags.length >= 4) {
          location = (await pTags[3]?.textContent())?.trim() ?? ''
        }

        const { fromDate, toDate, duration } = parseDateRange(workTimes, {
          includeDuration: true,
        })

        // Look for description outside the <a> tag
        let description = ''
        // Use a broader search to find descriptions wrapped in divs
        const outsideElements = await nestedItem
          .locator('p, [data-testid="expandable-text-box"]')
          .all()

        for (const element of outsideElements) {
          // Check if this element is inside the main link (we already parsed that)
          const isInsideLink =
            (await element.locator('xpath=ancestor::a').count()) > 0
          if (isInsideLink) continue

          const rawText = (await element.textContent())?.trim()
          if (!rawText) continue

          const innerText = (await element.innerText())?.trim()
          const text = innerText || rawText

          if (
            (await element.getAttribute('data-testid')) ===
              'expandable-text-box' ||
            text.split(/\s+/).length > 6 ||
            text.length > 100
          ) {
            description = text
            break
          }
        }

        positions.push({
          title: positionTitle,
          employmentType: employmentType || undefined,
          fromDate: fromDate ?? undefined,
          toDate: toDate ?? undefined,
          duration: duration ?? undefined,
          location: location || undefined,
          description: description || undefined,
        })
      } catch (e) {
        console.debug(`Error parsing nested position: ${e}`)
      }
    }
  } catch (e) {
    console.debug(`Error parsing nested experience: ${e}`)
  }

  return positions
}
