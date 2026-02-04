import type { PostData } from '../models/post'
import { Post } from '../models/post'
import { BaseScraper } from './base'

export class CompanyPostsScraper extends BaseScraper {
  async scrape(companyUrl: string, limit: number = 10): Promise<Post[]> {
    console.info(`Starting company posts scraping: ${companyUrl}`)
    await this.callback.onStart('company_posts', companyUrl)

    const postsUrl = this.buildPostsUrl(companyUrl)
    await this.navigateAndWait(postsUrl)
    await this.callback.onProgress('Navigated to posts page', 10)

    await this.checkRateLimit()

    await this.waitForPostsToLoad()
    await this.callback.onProgress('Posts loaded', 20)

    const posts = await this.scrapePosts(limit)
    await this.callback.onProgress(`Scraped ${posts.length} posts`, 100)
    await this.callback.onComplete('company_posts', posts)

    console.info(`Successfully scraped ${posts.length} posts`)
    return posts
  }

  protected buildPostsUrl(companyUrl: string): string {
    const baseUrl = companyUrl.replace(/\/$/, '')
    if (!baseUrl.includes('/posts')) {
      return `${baseUrl}/posts/`
    }
    return baseUrl
  }

  protected async waitForPostsToLoad(timeout: number = 30000): Promise<void> {
    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout })
    } catch (e) {
      console.debug(`DOM load timeout: ${e}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 3000))

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.triggerLazyLoad()

      const hasPosts = await this.page.evaluate(() => {
        return document.body.innerHTML.includes('urn:li:activity:')
      })

      if (hasPosts) {
        console.debug(`Posts found after attempt ${attempt + 1}`)
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    console.warn('Posts may not have loaded fully')
  }

  protected async triggerLazyLoad(): Promise<void> {
    await this.page.evaluate(() => {
      const scrollHeight = document.documentElement.scrollHeight
      const steps = 8
      const stepSize = Math.min(scrollHeight / steps, 400)

      for (let i = 1; i <= steps; i++) {
        setTimeout(() => window.scrollTo(0, stepSize * i), i * 200)
      }
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))

    await this.page.evaluate(() => window.scrollTo(0, 400))
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  protected async scrapePosts(limit: number): Promise<Post[]> {
    const posts: Post[] = []
    let scrollCount = 0
    const maxScrolls = Math.floor(limit / 3) + 2

    while (posts.length < limit && scrollCount < maxScrolls) {
      const newPosts = await this.extractPostsFromPage()

      for (const post of newPosts) {
        if (post.data.urn && !posts.some((p) => p.data.urn === post.data.urn)) {
          posts.push(post)
          if (posts.length >= limit) break
        }
      }

      if (posts.length < limit) {
        await this.scrollForMorePosts()
        scrollCount++
      }
    }

    return posts.slice(0, limit)
  }

  protected async extractPostsFromPage(): Promise<Post[]> {
    return await this.extractPostsViaJs()
  }

  protected async extractPostsViaJs(): Promise<Post[]> {
    const postsData = await this.page.evaluate(() => {
      const posts: any[] = []
      const html = document.body.innerHTML

      // Find all activity URNs in the page
      const urnMatches = Array.from(html.matchAll(/urn:li:activity:(\d+)/g))
      const seenUrns = new Set<string>()

      for (const match of urnMatches) {
        const urn = match[0]
        if (seenUrns.has(urn)) continue
        seenUrns.add(urn)

        const el = document.querySelector(`[data-urn="${urn}"]`) as HTMLElement
        if (!el) continue

        let text = ''
        const textSelectors = [
          '.feed-shared-update-v2__description',
          '.update-components-text',
          '.feed-shared-text',
          '[data-test-id="main-feed-activity-card__commentary"]',
          '.break-words.whitespace-pre-wrap',
        ]

        for (const sel of textSelectors) {
          const textEl = el.querySelector(sel) as HTMLElement
          if (textEl) {
            const t = textEl.innerText?.trim() || ''
            if (
              t.length > text.length &&
              t.length > 20 &&
              !t.startsWith('Microsoft\nMicrosoft')
            ) {
              text = t
            }
          }
        }

        if (!text || text.length < 30) {
          const allDivs = el.querySelectorAll('div, span')
          let maxLen = 0
          allDivs.forEach((div) => {
            const t = (div as HTMLElement).innerText?.trim() || ''
            if (
              t.length > maxLen &&
              t.length > 50 &&
              !t.includes('followers') &&
              !t.includes('reactions') &&
              !t.match(/^Microsoft\n/) &&
              !t.match(/^\d+[hdwmy]\s/)
            ) {
              const parent = div.parentElement
              if (!parent?.classList?.contains('feed-shared-actor')) {
                text = t
                maxLen = t.length
              }
            }
          })
        }

        if (!text || text.length < 20) continue

        const timeEl = el.querySelector(
          '[class*="actor__sub-description"], [class*="update-components-actor__sub-description"]',
        ) as HTMLElement
        const timeText = timeEl ? timeEl.innerText : ''

        const reactionsEl = el.querySelector(
          'button[aria-label*="reaction"], [class*="social-details-social-counts__reactions"]',
        ) as HTMLElement
        const reactions = reactionsEl ? reactionsEl.innerText : ''

        const commentsEl = el.querySelector(
          'button[aria-label*="comment"]',
        ) as HTMLElement
        const comments = commentsEl ? commentsEl.innerText : ''

        const repostsEl = el.querySelector(
          'button[aria-label*="repost"]',
        ) as HTMLElement
        const reposts = repostsEl ? repostsEl.innerText : ''

        const images: string[] = []
        el.querySelectorAll('img[src*="media"]').forEach((img) => {
          const src = (img as HTMLImageElement).src
          if (src && !src.includes('profile') && !src.includes('logo')) {
            images.push(src)
          }
        })

        posts.push({
          urn,
          text: text.substring(0, 2000),
          timeText,
          reactions,
          comments,
          reposts,
          images,
        })
      }

      return posts
    })

    const result: Post[] = []
    for (const data of postsData) {
      const activityId = data.urn.replace('urn:li:activity:', '')
      const post = new Post({
        linkedinUrl: `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`,
        urn: data.urn,
        text: data.text,
        postedDate: this.extractTimeFromText(data.timeText) ?? undefined,
        reactionsCount: this.parseCount(data.reactions) ?? undefined,
        commentsCount: this.parseCount(data.comments) ?? undefined,
        repostsCount: this.parseCount(data.reposts) ?? undefined,
        imageUrls: data.images,
      } as PostData)
      result.push(post)
    }

    return result
  }

  protected extractTimeFromText(text: string): string | null {
    if (!text) return null
    const match = text.match(
      /(\d+[hdwmy]|\d+\s*(?:hour|day|week|month|year)s?\s*ago)/i,
    )
    if (match) {
      return match[0].trim()
    }
    const parts = text.split('•')
    if (parts.length > 0) {
      return parts[0]?.trim()
    }
    return null
  }

  protected parseCount(text: string): number | null {
    if (!text) return null
    try {
      const numbers = text.replace(/,/g, '').match(/\d+/)
      if (numbers) {
        return parseInt(numbers[0]!, 10)
      }
    } catch (_e) {}
    return null
  }

  protected async scrollForMorePosts(): Promise<void> {
    try {
      await this.page.keyboard.press('End')
      await new Promise((resolve) => setTimeout(resolve, 1500))
    } catch (e) {
      console.debug(`Error scrolling: ${e}`)
    }
  }
}
