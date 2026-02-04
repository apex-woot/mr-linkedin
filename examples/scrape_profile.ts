import {
  BrowserManager,
  ConsoleCallback,
  loginWithCookie,
  loginWithCredentials,
  PersonScraper,
} from '../src'

async function runExample() {
  const defaultUrl = ''

  console.log('\n--- LinkedIn Profile Scraper ---')
  const inputUrl = prompt(
    'Enter LinkedIn Profile URL (or press Enter for default):',
    defaultUrl,
  )
  const linkedinUrl = inputUrl || defaultUrl

  const isHeadless = process.argv.includes('--headless')

  console.log(`\nStarting example scraper for: ${linkedinUrl}`)
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
      console.warn(
        'No authentication found in .env. Profile scraping may be limited.',
      )
    }

    const scraper = new PersonScraper({
      page: browser.page,
      callback: new ConsoleCallback(true),
    })

    const profile = await scraper.scrape(linkedinUrl)

    console.log(`\n${'='.repeat(50)}`)
    console.log('SCRAPE RESULTS:')
    console.log('='.repeat(50))
    console.log(`Name:     ${profile.data.name}`)
    console.log(`Location: ${profile.data.location}`)
    console.log(`About:    ${profile.data.about?.substring(0, 100)}...`)
    console.log(`Experience Count: ${profile.data.experiences.length}`)
    console.log(`Education Count:  ${profile.data.educations.length}`)

    if (profile.data.experiences.length > 0) {
      console.log('\nLatest Experience:')
      const latest = profile.data.experiences[0]
      console.log(`- ${latest?.positionTitle} at ${latest?.institutionName}`)
    }
    console.log(`${'='.repeat(50)}\n`)
  } catch (error) {
    console.error('Scraping failed:', error)
  } finally {
    await browser.close()
  }
}

runExample().catch(console.error)
