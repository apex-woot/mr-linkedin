import {
  AccomplishmentPageExtractor,
  AccomplishmentParser,
  AriaTextExtractor,
  BrowserManager,
  ExtractionPipeline,
  loginWithCookie,
  loginWithCredentials,
  RawTextExtractor,
  SemanticTextExtractor,
} from '../src'
import type { Accomplishment } from '../src/models'

function parseLinkedInPublicationsInput(input: string): {
  inputUrl: string
  baseProfileUrl: string
  detailsPublicationsUrl: string
  isProfileUrl: boolean
} {
  const url = new URL(input)
  const path = url.pathname.replace(/\/+$/, '')

  const profileMatch = path.match(/^\/in\/([^/]+)$/)
  if (profileMatch?.[1]) {
    const baseProfileUrl = `${url.protocol}//${url.host}/in/${profileMatch[1]}/`
    return {
      inputUrl: input,
      baseProfileUrl,
      detailsPublicationsUrl: `${baseProfileUrl}details/publications/`,
      isProfileUrl: true,
    }
  }

  const detailsMatch = path.match(/^\/in\/([^/]+)\/details\/(publications|publication|piblicaion|piblecation)$/)
  if (detailsMatch?.[1]) {
    const baseProfileUrl = `${url.protocol}//${url.host}/in/${detailsMatch[1]}/`
    return {
      inputUrl: input,
      baseProfileUrl,
      detailsPublicationsUrl: `${baseProfileUrl}details/publications/`,
      isProfileUrl: false,
    }
  }

  throw new Error(
    'URL must look like https://www.linkedin.com/in/<id>/ or https://www.linkedin.com/in/<id>/details/publications/',
  )
}

async function runExample() {
  const inputUrl = process.argv[2]?.trim() || prompt('Enter LinkedIn profile or details URL:', '')?.trim() || ''
  if (!inputUrl) {
    throw new Error('A LinkedIn profile or publications details URL is required.')
  }
  const isHeadless = process.argv.includes('--headless')

  const parsed = parseLinkedInPublicationsInput(inputUrl)

  console.log('\n--- LinkedIn Publications-Only Extractor ---')
  console.log(`Input URL: ${parsed.inputUrl}`)
  console.log(`Profile URL: ${parsed.baseProfileUrl}`)
  console.log(`Publications details URL: ${parsed.detailsPublicationsUrl}`)
  console.log(`Mode: ${isHeadless ? 'Headless' : 'Headed (Browser Visible)'}`)

  const browser = new BrowserManager({
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 50,
  })

  try {
    await browser.start()

    if (process.env.LINKEDIN_LI_AT_COOKIE) {
      console.log('Found li_at cookie in .env, logging in with cookie...')
      await loginWithCookie(browser.page, process.env.LINKEDIN_LI_AT_COOKIE)
    } else if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_PASSWORD) {
      console.log('Found credentials in .env, logging in...')
      await loginWithCredentials(browser.page)
    } else {
      console.warn('No authentication found in .env. LinkedIn details pages may be blocked.')
    }

    if (parsed.isProfileUrl) {
      console.log(`Input is a profile URL, navigating to: ${parsed.detailsPublicationsUrl}`)
    } else {
      console.log('Input is a publications details URL, navigating directly...')
    }
    await browser.page.goto(parsed.detailsPublicationsUrl, { waitUntil: 'domcontentloaded' })

    const pipeline = new ExtractionPipeline<Accomplishment>({
      pageExtractor: new AccomplishmentPageExtractor({
        urlPath: 'publications',
        category: 'publication',
      }),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new AccomplishmentParser(),
      confidenceThreshold: 0.25,
      captureHtmlOnFailure: true,
    })

    const result = await pipeline.extract({ page: browser.page, baseUrl: parsed.baseProfileUrl })
    const publications = result.items.filter((item) => item.category === 'publication')

    console.log(
      JSON.stringify(
        {
          inputUrl: parsed.inputUrl,
          profileUrl: parsed.baseProfileUrl,
          publicationsUrl: parsed.detailsPublicationsUrl,
          count: publications.length,
          publications,
        },
        null,
        2,
      ),
    )
  } finally {
    await browser.close()
  }
}

runExample().catch((error) => {
  console.error('Publications-only scrape failed:', error)
  process.exitCode = 1
})
