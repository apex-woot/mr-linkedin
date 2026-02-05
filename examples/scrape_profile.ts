import {
  BrowserManager,
  createConsoleCallback,
  loginWithCookie,
  loginWithCredentials,
  scrapePerson,
} from '../src'

async function runExample() {
  const defaultUrl = ''

  console.log('\n--- LinkedIn Profile Scraper ---')
  const inputUrl = prompt(
    'Enter LinkedIn Profile URL (or press Enter for default):',
    defaultUrl,
  )
  const linkedinUrl = inputUrl || defaultUrl

  const outputChoice = prompt(
    'How would you like to save the output?\n  1. Save to JSON file (default)\n  2. Print all to console\nEnter choice (1 or 2):',
    '1',
  )
  const shouldSaveToFile = outputChoice !== '2'

  const isHeadless = process.argv.includes('--headless')
  const onlyExperience = process.argv.includes('--only-experience')

  console.log(`\nStarting example scraper for: ${linkedinUrl}`)
  console.log(`Mode: ${isHeadless ? 'Headless' : 'Headed (Browser Visible)'}`)
  if (onlyExperience) {
    console.log('Scraping: Experience and Patents')
  }

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

    const profile = await scrapePerson(browser.page, linkedinUrl, {
      callback: createConsoleCallback(true),
      sections: onlyExperience
        ? {
            about: false,
            experiences: true,
            patents: true,
            educations: false,
            interests: false,
            accomplishments: false,
            contacts: false,
          }
        : undefined,
    })

    console.log(`\n${'='.repeat(50)}`)
    console.log('SCRAPE RESULTS:')
    console.log('='.repeat(50))

    if (shouldSaveToFile) {
      // Save to JSON file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `profile_${profile.name?.replace(/\s+/g, '_') || 'unknown'}_${timestamp}.json`
      await Bun.write(filename, JSON.stringify(profile, null, 2))
      console.log(`\n✓ Profile data saved to: ${filename}`)
      console.log(`\nQuick Summary:`)
      console.log(`Name:     ${profile.name}`)
      console.log(`Location: ${profile.location}`)
      console.log(`About:    ${profile.about?.substring(0, 100)}...`)
      console.log(`Experience Count: ${profile.experiences.length}`)
      console.log(`Education Count:  ${profile.educations.length}`)
      console.log(`Patents Count:    ${profile.patents.length}`)
      if (profile.experiences.length > 0) {
        console.log('\nLatest Experience:')
        const latest = profile.experiences[0]
        const latestPosition = latest?.positions[0]
        console.log(`- ${latestPosition?.title} at ${latest?.company}`)
      }
    } else {
      // Print all to console
      console.log(JSON.stringify(profile, null, 2))
    }
    console.log(`${'='.repeat(50)}\n`)
  } catch (error) {
    console.error('Scraping failed:', error)
  } finally {
    await browser.close()
  }
}

runExample().catch(console.error)
