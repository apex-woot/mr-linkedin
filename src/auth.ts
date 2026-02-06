import type { Page } from 'playwright'
import { AuthenticationError } from './exceptions'
import { detectRateLimit } from './utils'
import { log } from './utils/logger'

export async function warmUpBrowser(page: Page): Promise<void> {
  const sites = ['https://www.google.com', 'https://www.wikipedia.org', 'https://www.github.com']

  log.info('Warming up browser by visiting normal sites...')

  for (const site of sites) {
    try {
      await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await new Promise((resolve) => setTimeout(resolve, 1000))
      log.debug(`Visited ${site}`)
    } catch (e) {
      log.debug(`Could not visit ${site}: ${e}`)
    }
  }

  log.info('Browser warm-up complete')
}

export function loadCredentialsFromEnv(): {
  email?: string
  password?: string
} {
  const email = process.env.LINKEDIN_EMAIL || process.env.LINKEDIN_USERNAME
  const password = process.env.LINKEDIN_PASSWORD

  return { email, password }
}

import { z } from 'zod'

export const LoginOptionsSchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
  timeout: z.number().optional().default(30000),
  warmUp: z.boolean().optional().default(true),
})

export type LoginOptions = z.input<typeof LoginOptionsSchema>

export async function loginWithCredentials(page: Page, options: LoginOptions = {}): Promise<void> {
  const parsedOptions = LoginOptionsSchema.parse(options)
  let { email, password, timeout, warmUp } = parsedOptions

  if (!email || !password) {
    const env = loadCredentialsFromEnv()
    email = email || env.email
    password = password || env.password
  }

  if (!email || !password) {
    throw new AuthenticationError(
      'LinkedIn credentials not provided. ' +
        'Either pass email/password parameters or set LINKEDIN_EMAIL ' +
        'and LINKEDIN_PASSWORD in your .env file.',
    )
  }

  if (warmUp) await warmUpBrowser(page)

  log.info('Logging in to LinkedIn...')

  try {
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
    })

    await detectRateLimit(page)

    try {
      await page.waitForSelector('#username', {
        timeout,
        state: 'visible',
      })
    } catch {
      throw new AuthenticationError(
        'Login form not found. LinkedIn may have changed their page structure or the site is experiencing issues.',
      )
    }

    await page.fill('#username', email)
    await page.fill('#password', password)

    log.debug('Credentials entered')

    await page.click('button[type="submit"]')

    try {
      await page.waitForURL(
        (url) =>
          url.toString().includes('feed') ||
          url.toString().includes('checkpoint') ||
          url.toString().includes('authwall'),
        { timeout },
      )
    } catch {
      if (page.url().includes('login')) {
        throw new AuthenticationError(
          'Login failed. Please check your credentials. The page did not navigate after clicking sign in.',
        )
      }
    }

    const currentUrl = page.url()

    if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
      throw new AuthenticationError(
        'LinkedIn security checkpoint detected. ' +
          'You may need to verify your identity manually. ' +
          'Consider using session persistence after manual verification. ' +
          `Current URL: ${currentUrl}`,
      )
    }

    if (currentUrl.includes('authwall')) {
      throw new AuthenticationError(
        'Authentication wall encountered. ' +
          'LinkedIn may be blocking automated access. ' +
          `Current URL: ${currentUrl}`,
      )
    }

    const startTime = Date.now()
    let loggedIn = false
    while (Date.now() - startTime < 5000) {
      if (await isLoggedIn(page)) {
        log.info('Successfully logged in to LinkedIn')
        loggedIn = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    if (!loggedIn) {
      log.warning('Could not verify login by finding navigation element. Proceeding anyway...')
    }
  } catch (e) {
    if (e instanceof AuthenticationError) throw e
    throw new AuthenticationError(`Unexpected error during login: ${e}`)
  }
}

export async function loginWithCookie(page: Page, cookieValue: string): Promise<void> {
  log.info('Logging in with cookie...')

  try {
    await page.context().addCookies([
      {
        name: 'li_at',
        value: cookieValue,
        domain: '.linkedin.com',
        path: '/',
      },
    ])

    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
    })

    if (page.url().includes('login') || page.url().includes('authwall')) {
      throw new AuthenticationError('Cookie authentication failed. The cookie may be expired or invalid.')
    }

    const startTime = Date.now()
    let loggedIn = false
    while (Date.now() - startTime < 5000) {
      if (await isLoggedIn(page)) {
        log.info('Successfully authenticated with cookie')
        loggedIn = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    if (!loggedIn) log.warning('Could not verify cookie login. Proceeding anyway...')
  } catch (e) {
    if (e instanceof AuthenticationError) throw e
    throw new AuthenticationError(`Cookie authentication error: ${e}`)
  }
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const currentUrl = page.url()

    const authBlockers = [
      '/login',
      '/authwall',
      '/checkpoint',
      '/challenge',
      '/uas/login',
      '/uas/consumer-email-challenge',
    ]
    if (authBlockers.some((pattern) => currentUrl.includes(pattern))) return false

    const oldSelectors = '.global-nav__primary-link, [data-control-name="nav.settings"]'
    const oldCount = await page.locator(oldSelectors).count()

    const newSelectors = 'nav a[href*="/feed"], nav button:has-text("Home"), nav a[href*="/mynetwork"]'
    const newCount = await page.locator(newSelectors).count()

    const hasNavElements = oldCount > 0 || newCount > 0

    const authenticatedOnlyPages = ['/feed', '/mynetwork', '/messaging', '/notifications']
    const isAuthenticatedPage = authenticatedOnlyPages.some((pattern) => currentUrl.includes(pattern))

    return hasNavElements || isAuthenticatedPage
  } catch (_e) {
    return false
  }
}

export async function waitForManualLogin(page: Page, timeout: number = 300000): Promise<void> {
  log.info('⏳ Please complete the login process manually in the browser. ' + 'Waiting up to 5 minutes...')

  const startTime = Date.now()

  while (true) {
    if (await isLoggedIn(page)) {
      log.info('Manual login completed successfully')
      return
    }

    const elapsed = Date.now() - startTime
    if (elapsed > timeout) {
      throw new AuthenticationError('Manual login timeout. Please try again and complete login faster.')
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}
