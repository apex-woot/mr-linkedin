import type { Locator, Page } from 'playwright'
import type { Experience, Position } from '../../models'
import { trySelectorsForAll } from '../../utils/selector-utils'
import {
  navigateAndWait,
  scrollPageToBottom,
  scrollPageToHalf,
  waitAndFocus,
} from '../utils'
import { extractUniqueTextsFromElement, parseWorkTimes } from './utils'

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

export async function parseMainPageExperience(
  item: Locator,
): Promise<Experience | null> {
  try {
    // Get the first <a> element which contains the main info
    const firstLink = item.locator('a').first()
    if ((await firstLink.count()) === 0) return null

    const companyUrl = (await firstLink.getAttribute('href')) ?? undefined

    // Get all <p> tags within the first <a>
    const pTags = await firstLink.locator('p').all()
    if (pTags.length < 2) {
      // Fallback to old parsing method
      return await parseMainPageExperienceLegacy(item)
    }

    const firstP = await pTags[0]?.textContent()
    const secondP = await pTags[1]?.textContent()

    if (!firstP || !secondP) {
      return await parseMainPageExperienceLegacy(item)
    }

    // Detect pattern by checking the second <p> tag
    const isPattern1 = secondP.includes(' · ')

    if (isPattern1) {
      // Pattern 1: Single position
      const positionTitle = firstP.trim()
      const parts = secondP.split(' · ')
      const companyName = parts[0]?.trim() ?? ''
      const employmentType = parts[1]?.trim() ?? ''

      // Get dates from third <p> (could be inside or outside the link)
      let workTimes = ''
      if (pTags.length >= 3) {
        workTimes = (await pTags[2]?.textContent())?.trim() ?? ''
      }

      // If no dates found inside link, look outside
      if (!workTimes) {
        const allPTagsInItem = await item.locator('p').all()
        for (const pTag of allPTagsInItem) {
          const isInsideLink =
            (await pTag.locator('xpath=ancestor::a').count()) > 0
          if (isInsideLink) continue

          const text = (await pTag.textContent())?.trim()
          if (
            text &&
            (text.includes(' - ') ||
              text.includes('Present') ||
              /\d+\s+(yr|yrs|mo|mos)/.test(text))
          ) {
            workTimes = text
            break
          }
        }
      }

      const { fromDate, toDate, duration } = parseWorkTimes(workTimes)

      return {
        company: companyName,
        companyUrl: companyUrl,
        positions: [
          {
            title: positionTitle,
            employmentType: employmentType || undefined,
            fromDate: fromDate ?? undefined,
            toDate: toDate ?? undefined,
            duration: duration ?? undefined,
          },
        ],
      }
    }

    // If not Pattern 1, fallback to legacy parsing
    return await parseMainPageExperienceLegacy(item)
  } catch (e) {
    console.debug(`Error parsing main page experience: ${e}`)
    return null
  }
}

// Legacy parsing for main page experience
async function parseMainPageExperienceLegacy(
  item: Locator,
): Promise<Experience | null> {
  try {
    const links = await item.locator('a').all()
    if (links.length < 2) return null

    const companyUrl = (await links[0]?.getAttribute('href')) ?? undefined
    const detailLink = links[1]
    if (!detailLink) return null

    const uniqueTexts = await extractUniqueTextsFromElement(detailLink)

    if (uniqueTexts.length < 2) return null

    const positionTitle = uniqueTexts[0] ?? ''
    const companyName = uniqueTexts[1] ?? ''
    const workTimes = uniqueTexts[2] ?? ''

    const { fromDate, toDate, duration } = parseWorkTimes(workTimes)

    return {
      company: companyName,
      companyUrl: companyUrl,
      positions: [
        {
          title: positionTitle,
          fromDate: fromDate ?? undefined,
          toDate: toDate ?? undefined,
          duration: duration ?? undefined,
        },
      ],
    }
  } catch (e) {
    console.debug(`Error parsing main page experience (legacy): ${e}`)
    return null
  }
}

async function parseExperienceItem(item: Locator): Promise<Experience | null> {
  try {
    // Find all <a> tags in the item
    const allLinks = await item.locator('a').all()
    if (allLinks.length < 2) {
      console.debug(
        `Only found ${allLinks.length} <a> tags, trying linkless parser`,
      )
      return await parseExperienceItemLinkless(item)
    }

    // First <a> is company logo, second <a> contains the main info
    const companyUrl = (await allLinks[0]?.getAttribute('href')) ?? undefined
    const contentLink = allLinks[1]
    if (!contentLink) return null

    // Get all <p> tags within the content <a>
    const pTags = await contentLink.locator('p').all()
    if (pTags.length < 2) {
      console.debug(`Only found ${pTags.length} <p> tags, trying legacy parser`)
      return await parseExperienceItemLegacy(item)
    }

    const firstP = await pTags[0]?.textContent()
    const secondP = await pTags[1]?.textContent()

    console.debug(`First <p>: "${firstP?.substring(0, 50)}"`)
    console.debug(`Second <p>: "${secondP?.substring(0, 50)}"`)

    if (!firstP || !secondP) return null

    // Detect pattern by checking the second <p> tag
    const isPattern1 = secondP.includes(' · ')
    const isPattern2 =
      /\d+\s+(yr|yrs|mo|mos)/.test(secondP) && !secondP.includes(' - ')

    console.debug(
      `Pattern detection - isPattern1: ${isPattern1}, isPattern2: ${isPattern2}`,
    )

    // Also check if this item has nested <ul> for Pattern 2
    const hasNestedUl = (await item.locator('ul').count()) > 0
    if (hasNestedUl) {
      console.debug(
        `Found nested <ul>, treating as Pattern 2 (company with multiple positions)`,
      )
    }

    if (isPattern1 && !hasNestedUl) {
      // Pattern 1: Single position
      // First <p>: Position title
      // Second <p>: "Company · Type"
      const positionTitle = firstP.trim()
      const parts = secondP.split(' · ')
      const companyName = parts[0]?.trim() ?? ''
      const employmentType = parts[1]?.trim() ?? ''

      // Get dates and description from tags in the item container
      let workTimes = ''
      let description = ''

      // Find all relevant tags in the item container
      const allElements = await item
        .locator('p, ul, [data-testid="expandable-text-box"]')
        .all()

      for (const element of allElements) {
        const rawText = (await element.textContent())?.trim()
        if (!rawText) continue

        // Skip the elements we already captured from inside the link
        // Note: Pattern 1 splits secondP by ' · ', so we check against full secondP
        if (rawText === firstP || rawText === secondP) continue

        const innerText = (await element.innerText())?.trim()
        const text = innerText || rawText

        // Check if it's the date/duration line (contains dates or duration)
        if (
          (text.includes(' - ') || text.includes('Present')) &&
          /\d/.test(text)
        ) {
          if (!workTimes) workTimes = text
        }
        // Check if it's the expandable description or a long text (description fallback)
        else if (
          (await element.getAttribute('data-testid')) ===
            'expandable-text-box' ||
          text.split(/\s+/).length > 6 ||
          text.length > 100
        ) {
          if (!description) description = text
        }
      }

      const { fromDate, toDate, duration } = parseWorkTimes(workTimes)

      return {
        company: companyName,
        companyUrl: companyUrl,
        positions: [
          {
            title: positionTitle,
            employmentType: employmentType || undefined,
            fromDate: fromDate ?? undefined,
            toDate: toDate ?? undefined,
            duration: duration ?? undefined,
            description: description || undefined,
          },
        ],
      }
    } else if (hasNestedUl || isPattern2) {
      // Pattern 2: Multiple positions at same company
      // First <p>: Company name
      // Second <p>: Total duration
      const companyName = firstP.trim()
      // const totalDuration = secondP.trim() // Not used in new structure unless we add it to ExperienceSchema

      // Look for nested <ul> with positions
      const nestedUl = item.locator('ul').first()
      if ((await nestedUl.count()) === 0) {
        // No nested positions found, return single experience (fallback)
        return {
          company: companyName,
          companyUrl: companyUrl,
          positions: [],
        }
      }

      // Parse nested positions
      const positions = await parseNestedExperience(
        item,
        companyUrl ?? '',
        companyName,
      )
      return {
        company: companyName,
        companyUrl: companyUrl,
        positions: positions,
      }
    } else {
      // Pattern 3: Simple single position (no employment type)
      // First <p>: Position title
      // Second <p>: Company name (plain text, no · separator)
      // Additional <p> tags outside the link: dates, location, description
      console.debug('Trying Pattern 3 (simple single position)')

      const positionTitle = firstP.trim()
      const companyName = secondP.trim()

      // Get dates, location, and description from <p> tags outside the content link
      let workTimes = ''
      let location = ''
      let description = ''

      // Find all relevant tags in the item container
      // We look for p, ul (for lists), and expandable text boxes
      const allElements = await item
        .locator('p, ul, [data-testid="expandable-text-box"]')
        .all()

      for (const element of allElements) {
        const rawText = (await element.textContent())?.trim()
        if (!rawText) continue

        // Skip the elements we already captured from inside the link
        if (rawText === firstP || rawText === secondP) continue

        // Use innerText for description to preserve formatting (newlines in lists)
        const innerText = (await element.innerText())?.trim()
        const text = innerText || rawText

        // Check if it's the expandable description FIRST (highest priority if marked)
        if (
          (await element.getAttribute('data-testid')) === 'expandable-text-box'
        ) {
          description = text
          console.debug(`Found description`)
        }
        // Check if it's the date/duration line
        else if (
          (text.includes(' - ') || text.includes('Present')) &&
          /\d{4}|\d+\s+(yr|yrs|mo|mos)/.test(text)
        ) {
          if (!workTimes) {
            workTimes = text
            console.debug(`Found workTimes: "${text.substring(0, 50)}"`)
          }
        }
        // Check if it's a long text that's likely a description (fallback)
        else if (text.split(/\s+/).length > 6 || text.length > 100) {
          if (!description) {
            description = text
            console.debug(`Found description (fallback)`)
          }
        }
        // Check if it's a location (usually contains city/state/country names, no dates)
        else if (
          text.length < 100 &&
          !text.includes('·') &&
          !/\d/.test(text) &&
          text.split(/\s+/).length <= 6
        ) {
          // Only look for location if we found workTimes (location usually follows dates)
          // And if we haven't found description yet (location usually precedes description)
          if (!location && !workTimes) {
            // skip
          } else if (!location && !description) {
            location = text
            console.debug(`Found location: "${text.substring(0, 50)}"`)
          }
        }
      }

      const { fromDate, toDate, duration } = parseWorkTimes(workTimes)

      return {
        company: companyName,
        companyUrl: companyUrl,
        positions: [
          {
            title: positionTitle,
            fromDate: fromDate ?? undefined,
            toDate: toDate ?? undefined,
            duration: duration ?? undefined,
            location: location || undefined,
            description: description || undefined,
          },
        ],
      }
    }
  } catch (e) {
    console.debug(`Error parsing experience: ${e}`)
    return null
  }
}

// Parser for experiences without links (no company LinkedIn page)
async function parseExperienceItemLinkless(
  item: Locator,
): Promise<Experience | null> {
  try {
    console.debug('Attempting linkless parser')

    // Collect all <p> tag texts first
    const pTags = await item.locator('p').all()
    const pTexts: Array<{
      text: string
      isDate: boolean
      isDescription: boolean
      element: Locator
    }> = []

    for (const pTag of pTags) {
      const text = (await pTag.textContent())?.trim()
      if (!text || text.length > 500) continue

      const isDate =
        (text.includes(' - ') || text.includes('·')) &&
        /\d{4}|\d+\s+(yr|yrs|mo|mos)/.test(text)
      const isDescription =
        (await pTag.getAttribute('data-testid')) === 'expandable-text-box'

      console.debug(
        `Found <p>: "${text.substring(0, 60)}" [isDate: ${isDate}, isDesc: ${isDescription}]`,
      )
      pTexts.push({ text, isDate, isDescription, element: pTag })
    }

    // Process in order: first non-date/non-desc = position, second = company, date = workTimes
    let positionTitle = ''
    let companyName = ''
    let workTimes = ''
    let description = ''
    let employmentType = ''
    let location = ''

    const nonSpecialTexts = pTexts
      .filter((p) => !p.isDate && !p.isDescription)
      .map((p) => p.text)
    const dateTexts = pTexts.filter((p) => p.isDate).map((p) => p.text)
    const descTexts = pTexts.filter((p) => p.isDescription).map((p) => p.text)

    // First non-special text is position title
    if (nonSpecialTexts.length >= 1) {
      positionTitle = nonSpecialTexts[0] ?? ''
      console.debug(`Identified positionTitle: "${positionTitle}"`)
    }

    // Second non-special text is company name (or company · type)
    if (nonSpecialTexts.length >= 2) {
      const companyText = nonSpecialTexts[1] ?? ''
      if (
        companyText.includes('·') &&
        (companyText.toLowerCase().includes('self-employed') ||
          companyText.toLowerCase().includes('freelance') ||
          companyText.toLowerCase().includes('full-time') ||
          companyText.toLowerCase().includes('part-time'))
      ) {
        const parts = companyText.split('·')
        companyName = parts[0]?.trim() ?? ''
        employmentType = parts[1]?.trim() ?? ''
        console.debug(
          `Identified company+type: "${companyName}" / "${employmentType}"`,
        )
      } else {
        companyName = companyText
        console.debug(`Identified companyName: "${companyName}"`)
      }
    }

    // Remaining non-special texts could be location or description
    for (let i = 2; i < nonSpecialTexts.length; i++) {
      const text = nonSpecialTexts[i]!
      if (text.split(/\s+/).length > 6 || text.length > 100) {
        if (!description) {
          description = text
          console.debug(`Identified description from leftovers`)
        }
      } else if (!location) {
        location = text
        console.debug(`Identified location from leftovers: "${location}"`)
      }
    }

    // Date text is work times
    if (dateTexts.length >= 1) {
      workTimes = dateTexts[0] ?? ''
      console.debug(`Identified workTimes: "${workTimes}"`)
    }

    // Description (if found by testid)
    if (descTexts.length >= 1 && !description) {
      description = descTexts[0] ?? ''
      console.debug(`Identified description`)
    }

    if (!positionTitle && !companyName) {
      console.debug('Could not find position or company, trying legacy parser')
      return await parseExperienceItemLegacy(item)
    }

    const { fromDate, toDate, duration } = parseWorkTimes(workTimes)

    return {
      company: companyName || 'Unknown',
      companyUrl: undefined,
      positions: [
        {
          title: positionTitle || 'Unknown',
          employmentType: employmentType || undefined,
          fromDate: fromDate ?? undefined,
          toDate: toDate ?? undefined,
          duration: duration ?? undefined,
          location: location || undefined,
          description: description || undefined,
        },
      ],
    }
  } catch (e) {
    console.debug(`Error parsing linkless experience: ${e}`)
    return await parseExperienceItemLegacy(item)
  }
}

// Legacy parsing function for backward compatibility with old HTML structure
async function parseExperienceItemLegacy(
  item: Locator,
): Promise<Experience | null> {
  try {
    const entity = item
      .locator('div[data-view-name="profile-component-entity"]')
      .first()
    if ((await entity.count()) === 0) return null

    const children = await entity.locator('> *').all()
    if (children.length < 2) return null

    const companyLink = children[0]?.locator('a').first()
    const companyUrl = companyLink
      ? ((await companyLink.getAttribute('href')) ?? undefined)
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

    let positionTitle = ''
    let companyName = ''
    let workTimes = ''
    let location = ''

    if (outerSpans.length >= 1) {
      const ariaSpan = outerSpans[0]
        ?.locator('span[aria-hidden="true"]')
        .first()
      positionTitle = ariaSpan ? (await ariaSpan.textContent()) || '' : ''
    }
    if (outerSpans.length >= 2) {
      const ariaSpan = outerSpans[1]
        ?.locator('span[aria-hidden="true"]')
        .first()
      companyName = ariaSpan ? (await ariaSpan.textContent()) || '' : ''
    }
    if (outerSpans.length >= 3) {
      const ariaSpan = outerSpans[2]
        ?.locator('span[aria-hidden="true"]')
        .first()
      workTimes = ariaSpan ? (await ariaSpan.textContent()) || '' : ''
    }
    if (outerSpans.length >= 4) {
      const ariaSpan = outerSpans[3]
        ?.locator('span[aria-hidden="true"]')
        .first()
      location = ariaSpan ? (await ariaSpan.textContent()) || '' : ''
    }

    const { fromDate, toDate, duration } = parseWorkTimes(workTimes)

    let description = ''
    if (detailChildren.length > 1)
      description = (await detailChildren[1]?.innerText()) ?? ''

    return {
      company: companyName.trim(),
      companyUrl: companyUrl,
      positions: [
        {
          title: positionTitle.trim(),
          fromDate: fromDate ?? undefined,
          toDate: toDate ?? undefined,
          duration: duration ?? undefined,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
        },
      ],
    }
  } catch (e) {
    console.debug(`Error parsing experience with legacy method: ${e}`)
    return null
  }
}

async function parseNestedExperience(
  item: Locator,
  companyUrl: string,
  companyName: string,
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

        const { fromDate, toDate, duration } = parseWorkTimes(workTimes)

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
