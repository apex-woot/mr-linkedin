import type { Locator, Page } from 'playwright'
import type { Accomplishment } from '../../models'
import { navigateAndWait, waitAndFocus } from '../utils'

export async function getAccomplishments(
  page: Page,
  baseUrl: string,
): Promise<Accomplishment[]> {
  const accomplishments: Accomplishment[] = []

  const accomplishmentSections: Array<[string, string]> = [
    ['certifications', 'certification'],
    ['honors', 'honor'],
    ['publications', 'publication'],
    ['patents', 'patent'],
    ['courses', 'course'],
    ['projects', 'project'],
    ['languages', 'language'],
    ['organizations', 'organization'],
  ]

  for (const [urlPath, category] of accomplishmentSections) {
    try {
      const sectionUrl = `${baseUrl.replace(/\/$/, '')}/details/${urlPath}/`
      await navigateAndWait(page, sectionUrl)
      await page.waitForSelector('main', { timeout: 10000 })
      await waitAndFocus(page, 1)

      const nothingToSee = await page
        .locator('text="Nothing to see for now"')
        .count()
      if (nothingToSee > 0) continue

      const mainList = page
        .locator('.pvs-list__container, main ul, main ol')
        .first()
      if ((await mainList.count()) === 0) continue

      let items = await mainList.locator('.pvs-list__paged-list-item').all()
      if (items.length === 0) items = await mainList.locator('> li').all()

      const seenTitles = new Set<string>()
      for (const item of items) {
        try {
          const accomplishment = await parseAccomplishmentItem(item, category)
          if (accomplishment && !seenTitles.has(accomplishment.title)) {
            seenTitles.add(accomplishment.title)
            accomplishments.push(accomplishment)
          }
        } catch (e) {
          console.debug(`Error parsing ${category} item: ${e}`)
        }
      }
    } catch (e) {
      console.debug(`Error getting ${category}s: ${e}`)
    }
  }

  return accomplishments
}

async function parseAccomplishmentItem(
  item: Locator,
  category: string,
): Promise<Accomplishment | null> {
  try {
    const entity = item
      .locator('div[data-view-name="profile-component-entity"]')
      .first()
    let spans: Locator[]
    if ((await entity.count()) > 0)
      spans = await entity.locator('span[aria-hidden="true"]').all()
    else spans = await item.locator('span[aria-hidden="true"]').all()

    let title = ''
    let issuer = ''
    let issuedDate = ''
    let credentialId = ''

    for (let i = 0; i < Math.min(spans.length, 5); i++) {
      const text = (await spans[i]?.textContent())?.trim()
      if (!text || text.length > 500) continue

      if (i === 0) {
        title = text
      } else if (text.includes('Issued by')) {
        const parts = text.split('·')
        issuer = parts[0]?.replace('Issued by', '').trim() ?? ''
        if (parts.length > 1) issuedDate = parts[1]?.trim() ?? ''
      } else if (text.startsWith('Issued ') && !issuedDate) {
        issuedDate = text.replace('Issued ', '')
      } else if (text.startsWith('Credential ID')) {
        credentialId = text.replace('Credential ID ', '')
      } else if (i === 1 && !issuer) {
        issuer = text
      } else if (
        /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(text) &&
        !issuedDate
      ) {
        if (text.includes('·')) issuedDate = text.split('·')[0]?.trim() ?? ''
        else issuedDate = text
      }
    }

    const link = item
      .locator('a[href*="credential"], a[href*="verify"]')
      .first()
    const credentialUrl =
      (await link.count()) > 0 ? await link.getAttribute('href') : null

    if (!title || title.length > 200) return null

    return {
      category,
      title,
      issuer: issuer || undefined,
      issuedDate: issuedDate || undefined,
      credentialId: credentialId || undefined,
      credentialUrl: credentialUrl || undefined,
    }
  } catch (e) {
    console.debug(`Error parsing accomplishment: ${e}`)
    return null
  }
}
