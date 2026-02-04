import type { Page } from 'playwright'
import type { ProgressCallback } from '../callbacks'
import type { JobData } from '../models/job'
import { createJob } from '../models/job'
import { checkRateLimit, navigateAndWait } from './utils'

export interface JobScraperOptions {
  callback?: ProgressCallback
}

/**
 * Scrapes job data from a LinkedIn job URL.
 */
export async function scrapeJob(
  page: Page,
  linkedinUrl: string,
  options?: JobScraperOptions,
): Promise<JobData> {
  const callback = options?.callback

  console.info(`Starting job scraping: ${linkedinUrl}`)
  await callback?.onStart('Job', linkedinUrl)

  await navigateAndWait(page, linkedinUrl, callback)
  await callback?.onProgress('Navigated to job page', 10)

  await checkRateLimit(page)

  const jobTitle = await getJobTitle(page)
  await callback?.onProgress(`Got job title: ${jobTitle ?? 'Unknown'}`, 20)

  const company = await getCompany(page)
  await callback?.onProgress('Got company name', 30)

  const location = await getLocation(page)
  await callback?.onProgress('Got location', 40)

  const postedDate = await getPostedDate(page)
  await callback?.onProgress('Got posted date', 50)

  const applicantCount = await getApplicantCount(page)
  await callback?.onProgress('Got applicant count', 60)

  const jobDescription = await getDescription(page)
  await callback?.onProgress('Got job description', 80)

  const companyUrl = await getCompanyUrl(page)
  await callback?.onProgress('Got company URL', 90)

  const job = createJob({
    linkedinUrl,
    jobTitle: jobTitle ?? undefined,
    company: company ?? undefined,
    companyLinkedinUrl: companyUrl ?? undefined,
    location: location ?? undefined,
    postedDate: postedDate ?? undefined,
    applicantCount: applicantCount ?? undefined,
    jobDescription: jobDescription ?? undefined,
  } as JobData)

  await callback?.onProgress('Scraping complete', 100)
  await callback?.onComplete('Job', job)

  console.info(`Successfully scraped job: ${jobTitle ?? 'Unknown'}`)
  return job
}

async function getJobTitle(page: Page): Promise<string | null> {
  try {
    const titleElem = page.locator('h1').first()
    const title = await titleElem.innerText()
    return title.trim() || null
  } catch {
    return null
  }
}

async function getCompany(page: Page): Promise<string | null> {
  try {
    const companyLinks = await page.locator('a[href*="/company/"]').all()
    for (const link of companyLinks) {
      const text = (await link.innerText()).trim()
      if (text && text.length > 1 && !text.toLowerCase().startsWith('logo'))
        return text
    }
  } catch {}
  return null
}

async function getCompanyUrl(page: Page): Promise<string | null> {
  try {
    const companyLink = page.locator('a[href*="/company/"]').first()
    if ((await companyLink.count()) > 0) {
      let href = await companyLink.getAttribute('href')
      if (href) {
        if (href.includes('?')) href = href.split('?')[0]!
        if (!href.startsWith('http')) href = `https://www.linkedin.com${href}`
        return href
      }
    }
  } catch {}
  return null
}

async function getLocation(page: Page): Promise<string | null> {
  try {
    const jobPanel = page.locator('h1').first().locator('xpath=ancestor::*[5]')
    if ((await jobPanel.count()) > 0) {
      const textElements = await jobPanel.locator('span, div').all()
      for (const elem of textElements) {
        const text = (await elem.innerText()).trim()
        if (
          text &&
          (text.includes(',') ||
            text.includes('Remote') ||
            text.includes('United States'))
        ) {
          if (text.length > 3 && text.length < 100 && !text.startsWith('$'))
            return text
        }
      }
    }
  } catch {}
  return null
}

async function getPostedDate(page: Page): Promise<string | null> {
  try {
    const textElements = await page.locator('span, div').all()
    for (const elem of textElements) {
      const text = (await elem.innerText()).trim()
      const lower = text.toLowerCase()
      if (
        text &&
        (lower.includes('ago') ||
          lower.includes('day') ||
          lower.includes('week') ||
          lower.includes('hour'))
      ) {
        if (text.length < 50) return text
      }
    }
  } catch {}
  return null
}

async function getApplicantCount(page: Page): Promise<string | null> {
  try {
    const mainContent = page.locator('main').first()
    if ((await mainContent.count()) > 0) {
      const textElements = await mainContent.locator('span, div').all()
      for (const elem of textElements) {
        const text = (await elem.innerText()).trim()
        if (text && text.length < 50) {
          const lower = text.toLowerCase()
          if (
            lower.includes('applicant') ||
            lower.includes('people clicked') ||
            lower.includes('applied')
          )
            return text
        }
      }
    }
  } catch {}
  return null
}

async function getDescription(page: Page): Promise<string | null> {
  try {
    const aboutHeading = page
      .locator('h2:has-text("About the job")')
      .first()
    if ((await aboutHeading.count()) > 0) {
      const article = aboutHeading.locator('xpath=ancestor::article[1]')
      if ((await article.count()) > 0) {
        const description = await article.innerText()
        return description.trim() || null
      }
    }

    const article = page.locator('article').first()
    if ((await article.count()) > 0) {
      const description = await article.innerText()
      return description.trim() || null
    }
  } catch {}
  return null
}
