import type { JobData } from '../models/job'
import { Job } from '../models/job'
import { BaseScraper } from './base'

export class JobScraper extends BaseScraper {
  async scrape(linkedinUrl: string): Promise<Job> {
    console.info(`Starting job scraping: ${linkedinUrl}`)
    await this.callback.onStart('Job', linkedinUrl)

    await this.navigateAndWait(linkedinUrl)
    await this.callback.onProgress('Navigated to job page', 10)

    await this.checkRateLimit()

    const jobTitle = await this.getJobTitle()
    await this.callback.onProgress(
      `Got job title: ${jobTitle ?? 'Unknown'}`,
      20,
    )

    const company = await this.getCompany()
    await this.callback.onProgress('Got company name', 30)

    const location = await this.getLocation()
    await this.callback.onProgress('Got location', 40)

    const postedDate = await this.getPostedDate()
    await this.callback.onProgress('Got posted date', 50)

    const applicantCount = await this.getApplicantCount()
    await this.callback.onProgress('Got applicant count', 60)

    const jobDescription = await this.getDescription()
    await this.callback.onProgress('Got job description', 80)

    const companyUrl = await this.getCompanyUrl()
    await this.callback.onProgress('Got company URL', 90)

    const job = new Job({
      linkedinUrl,
      jobTitle: jobTitle ?? undefined,
      company: company ?? undefined,
      companyLinkedinUrl: companyUrl ?? undefined,
      location: location ?? undefined,
      postedDate: postedDate ?? undefined,
      applicantCount: applicantCount ?? undefined,
      jobDescription: jobDescription ?? undefined,
    } as JobData)

    await this.callback.onProgress('Scraping complete', 100)
    await this.callback.onComplete('Job', job)

    console.info(`Successfully scraped job: ${jobTitle ?? 'Unknown'}`)
    return job
  }

  protected async getJobTitle(): Promise<string | null> {
    try {
      const titleElem = this.page.locator('h1').first()
      const title = await titleElem.innerText()
      return title.trim() || null
    } catch (_e) {
      return null
    }
  }

  protected async getCompany(): Promise<string | null> {
    try {
      const companyLinks = await this.page.locator('a[href*="/company/"]').all()
      for (const link of companyLinks) {
        const text = (await link.innerText()).trim()
        if (text && text.length > 1 && !text.toLowerCase().startsWith('logo')) {
          return text
        }
      }
    } catch (_e) {}
    return null
  }

  protected async getCompanyUrl(): Promise<string | null> {
    try {
      const companyLink = this.page.locator('a[href*="/company/"]').first()
      if ((await companyLink.count()) > 0) {
        let href = await companyLink.getAttribute('href')
        if (href) {
          if (href.includes('?')) {
            href = href.split('?')[0]!
          }
          if (!href.startsWith('http')) {
            href = `https://www.linkedin.com${href}`
          }
          return href
        }
      }
    } catch (_e) {}
    return null
  }

  protected async getLocation(): Promise<string | null> {
    try {
      const jobPanel = this.page
        .locator('h1')
        .first()
        .locator('xpath=ancestor::*[5]')
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
            if (text.length > 3 && text.length < 100 && !text.startsWith('$')) {
              return text
            }
          }
        }
      }
    } catch (_e) {}
    return null
  }

  protected async getPostedDate(): Promise<string | null> {
    try {
      const textElements = await this.page.locator('span, div').all()
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
          if (text.length < 50) {
            return text
          }
        }
      }
    } catch (_e) {}
    return null
  }

  protected async getApplicantCount(): Promise<string | null> {
    try {
      const mainContent = this.page.locator('main').first()
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
            ) {
              return text
            }
          }
        }
      }
    } catch (_e) {}
    return null
  }

  protected async getDescription(): Promise<string | null> {
    try {
      const aboutHeading = this.page
        .locator('h2:has-text("About the job")')
        .first()
      if ((await aboutHeading.count()) > 0) {
        const article = aboutHeading.locator('xpath=ancestor::article[1]')
        if ((await article.count()) > 0) {
          const description = await article.innerText()
          return description.trim() || null
        }
      }

      const article = this.page.locator('article').first()
      if ((await article.count()) > 0) {
        const description = await article.innerText()
        return description.trim() || null
      }
    } catch (_e) {}
    return null
  }
}
