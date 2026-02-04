import type { Page } from 'playwright'
import type { ProgressCallback } from '../callbacks'
import type { CompanyData } from '../models/company'
import { createCompany } from '../models/company'
import { checkRateLimit, navigateAndWait } from './utils'

export interface CompanyScraperOptions {
  callback?: ProgressCallback
}

/**
 * Scrapes company data from a LinkedIn company URL.
 */
export async function scrapeCompany(
  page: Page,
  linkedinUrl: string,
  options?: CompanyScraperOptions,
): Promise<CompanyData> {
  const callback = options?.callback

  console.info(`Starting company scraping: ${linkedinUrl}`)
  await callback?.onStart('company', linkedinUrl)

  await navigateAndWait(page, linkedinUrl, callback)
  await callback?.onProgress('Navigated to company page', 10)

  await checkRateLimit(page)

  const name = await getName(page)
  await callback?.onProgress(`Got company name: ${name}`, 20)

  const aboutUs = await getAbout(page)
  await callback?.onProgress('Got about section', 30)

  const overview = await getOverview(page)
  await callback?.onProgress('Got overview details', 50)

  const company = createCompany({
    linkedinUrl,
    name,
    aboutUs: aboutUs ?? undefined,
    ...overview,
  } as CompanyData)

  await callback?.onProgress('Scraping complete', 100)
  await callback?.onComplete('company', company)

  console.info(`Successfully scraped company: ${name}`)
  return company
}

async function getName(page: Page): Promise<string> {
  try {
    const nameElem = page.locator('h1').first()
    const name = await nameElem.innerText()
    return name.trim() || 'Unknown Company'
  } catch (e) {
    console.warn(`Error getting company name: ${e}`)
    return 'Unknown Company'
  }
}

async function getAbout(page: Page): Promise<string | null> {
  try {
    const sections = await page.locator('section').all()

    for (const section of sections) {
      const sectionText = await section.innerText()
      if (sectionText.slice(0, 50).includes('About us')) {
        const paragraphs = await section.locator('p').all()
        if (paragraphs.length > 0) {
          const about = await paragraphs[0]?.innerText()
          return about?.trim() ?? null
        }
      }
    }

    return null
  } catch (e) {
    console.debug(`Error getting about section: ${e}`)
    return null
  }
}

async function getOverview(page: Page): Promise<Partial<CompanyData>> {
  const overview: Partial<CompanyData> = {}

  try {
    const infoItems = await page
      .locator('.org-top-card-summary-info-list__info-item')
      .all()

    for (const item of infoItems) {
      const text = (await item.innerText()).trim()
      const textLower = text.toLowerCase()

      if (textLower.includes('employee') || textLower.includes('k+')) {
        overview.companySize = text
      } else if (
        text.includes(',') &&
        [
          'Washington',
          'California',
          'New York',
          'Texas',
          'United States',
          'United Kingdom',
        ].some((loc) => text.includes(loc))
      ) {
        overview.headquarters = text
      } else if (
        [
          'software',
          'technology',
          'financial',
          'healthcare',
          'retail',
          'manufacturing',
          'consulting',
          'education',
        ].some((ind) => textLower.includes(ind))
      ) {
        overview.industry = text
      }
    }

    try {
      const links = await page.locator('a').all()
      for (const link of links) {
        const href = await link.getAttribute('href')
        if (
          href &&
          !href.includes('linkedin') &&
          (href.includes('http') || href.includes('www.'))
        ) {
          const linkText = await link.innerText()
          if (
            linkText &&
            ['learn more', 'website', 'visit'].some((word) =>
              linkText.toLowerCase().includes(word),
            )
          ) {
            overview.website = href
            break
          }
        }
      }
    } catch (e) {
      console.debug(`Error finding website: ${e}`)
    }

    if (Object.keys(overview).length === 0) {
      const dtElements = await page.locator('dt').all()

      for (const dt of dtElements) {
        const label = (await dt.innerText()).trim().toLowerCase()
        const dd = dt.locator('xpath=following-sibling::dd[1]')
        const value =
          (await dd.count()) > 0 ? (await dd.innerText()).trim() : null

        if (value) {
          if (label.includes('website')) overview.website = value
          else if (label.includes('phone')) overview.phone = value
          else if (
            label.includes('headquarters') ||
            label.includes('location')
          )
            overview.headquarters = value
          else if (label.includes('founded')) overview.founded = value
          else if (label.includes('industry') || label.includes('industries'))
            overview.industry = value
          else if (label.includes('company type') || label.includes('type'))
            overview.companyType = value
          else if (label.includes('company size') || label.includes('size'))
            overview.companySize = value
          else if (label.includes('specialt')) overview.specialties = value
        }
      }
    }
  } catch (e) {
    console.debug(`Error getting company overview: ${e}`)
  }

  return overview
}
