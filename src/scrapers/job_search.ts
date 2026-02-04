import type { Page } from 'playwright'
import { z } from 'zod'
import type { ProgressCallback } from '../callbacks'
import { navigateAndWait, scrollPageToBottom, waitAndFocus } from './utils'

export const JobSearchParamsSchema = z.object({
  keywords: z.string().optional(),
  location: z.string().optional(),
  limit: z.number().optional().default(25),
})

export type JobSearchParams = z.input<typeof JobSearchParamsSchema>

export interface JobSearchOptions {
  callback?: ProgressCallback
}

/**
 * Searches for jobs on LinkedIn and returns job URLs.
 */
export async function searchJobs(
  page: Page,
  params: JobSearchParams = {},
  options?: JobSearchOptions,
): Promise<string[]> {
  const { keywords, location, limit } = JobSearchParamsSchema.parse(params)
  const callback = options?.callback

  console.info(
    `Starting job search: keywords='${keywords || ''}', location='${location || ''}'`,
  )

  const searchUrl = buildSearchUrl(keywords, location)
  await callback?.onStart('JobSearch', searchUrl)

  await navigateAndWait(page, searchUrl, callback)
  await callback?.onProgress('Navigated to search results', 20)

  try {
    await page.waitForSelector('a[href*="/jobs/view/"]', { timeout: 10000 })
  } catch {
    console.warn('No job listings found on page')
    return []
  }

  await waitAndFocus(page, 1)
  await scrollPageToBottom(page, 1, 3)
  await callback?.onProgress('Loaded job listings', 50)

  const jobUrls = await extractJobUrls(page, limit)
  await callback?.onProgress(`Found ${jobUrls.length} job URLs`, 90)

  await callback?.onProgress('Search complete', 100)
  await callback?.onComplete('JobSearch', jobUrls)

  console.info(`Job search complete: found ${jobUrls.length} jobs`)
  return jobUrls
}

function buildSearchUrl(keywords?: string, location?: string): string {
  const url = new URL('https://www.linkedin.com/jobs/search/')

  if (keywords) url.searchParams.set('keywords', keywords)

  if (location) url.searchParams.set('location', location)

  return url.toString()
}

async function extractJobUrls(page: Page, limit: number): Promise<string[]> {
  const jobUrls: string[] = []

  try {
    const jobLinks = await page.locator('a[href*="/jobs/view/"]').all()

    const seenUrls = new Set<string>()
    for (const link of jobLinks) {
      if (jobUrls.length >= limit) break

      try {
        const href = await link.getAttribute('href')
        if (href?.includes('/jobs/view/')) {
          let cleanUrl = href.split('?')[0]!

          if (!cleanUrl.startsWith('http'))
            cleanUrl = `https://www.linkedin.com${cleanUrl}`

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
