import { z } from 'zod'
import { BaseScraper } from './base'

export const JobSearchParamsSchema = z.object({
  keywords: z.string().optional(),
  location: z.string().optional(),
  limit: z.number().optional().default(25),
})

export type JobSearchParams = z.input<typeof JobSearchParamsSchema>

export class JobSearchScraper extends BaseScraper {
  async search(params: JobSearchParams = {}): Promise<string[]> {
    const { keywords, location, limit } = JobSearchParamsSchema.parse(params)

    console.info(
      `Starting job search: keywords='${keywords || ''}', location='${location || ''}'`,
    )

    const searchUrl = this.buildSearchUrl(keywords, location)
    await this.callback.onStart('JobSearch', searchUrl)

    await this.navigateAndWait(searchUrl)
    await this.callback.onProgress('Navigated to search results', 20)

    try {
      await this.page.waitForSelector('a[href*="/jobs/view/"]', {
        timeout: 10000,
      })
    } catch (_e) {
      console.warn('No job listings found on page')
      return []
    }

    await this.waitAndFocus(1)
    await this.scrollPageToBottom(1, 3)
    await this.callback.onProgress('Loaded job listings', 50)

    const jobUrls = await this.extractJobUrls(limit)
    await this.callback.onProgress(`Found ${jobUrls.length} job URLs`, 90)

    await this.callback.onProgress('Search complete', 100)
    await this.callback.onComplete('JobSearch', jobUrls)

    console.info(`Job search complete: found ${jobUrls.length} jobs`)
    return jobUrls
  }

  protected buildSearchUrl(keywords?: string, location?: string): string {
    const url = new URL('https://www.linkedin.com/jobs/search/')

    if (keywords) {
      url.searchParams.set('keywords', keywords)
    }
    if (location) {
      url.searchParams.set('location', location)
    }

    return url.toString()
  }

  protected async extractJobUrls(limit: number): Promise<string[]> {
    const jobUrls: string[] = []

    try {
      const jobLinks = await this.page.locator('a[href*="/jobs/view/"]').all()

      const seenUrls = new Set<string>()
      for (const link of jobLinks) {
        if (jobUrls.length >= limit) {
          break
        }

        try {
          const href = await link.getAttribute('href')
          if (href?.includes('/jobs/view/')) {
            let cleanUrl = href.split('?')[0]!

            if (!cleanUrl.startsWith('http')) {
              cleanUrl = `https://www.linkedin.com${cleanUrl}`
            }

            if (!seenUrls.has(cleanUrl)) {
              jobUrls.push(cleanUrl)
              seenUrls.add(cleanUrl)
            }
          }
        } catch (e) {
          console.debug(`Error extracting job URL: ${e}`)
        }
      }
    } catch (e) {
      console.warn(`Error extracting job URLs: ${e}`)
    }

    return jobUrls
  }
}
