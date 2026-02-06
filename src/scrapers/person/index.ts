import type { Page } from 'playwright'
import type { ProgressCallback } from '../../callbacks'
import { ScrapingError } from '../../exceptions'
import type { PersonData } from '../../models'
import { createPerson } from '../../models'
import { log } from '../../utils/logger'
import { ensureLoggedIn, navigateAndWait, scrollPageToBottom, scrollPageToHalf, waitAndFocus } from '../utils'
import { getAccomplishments } from './accomplishments'
import { getContactInfo } from './contact-info'
import { getEducations } from './educations'
import { getExperiences } from './experiences'
import { getInterests } from './interests'
import { getPatents } from './patents'
import { checkOpenToWork, getAbout, getTopCardProfileInfo } from './profile'

export interface PersonScraperOptions {
  callback?: ProgressCallback
  sections?: {
    about?: boolean
    experiences?: boolean
    educations?: boolean
    patents?: boolean
    interests?: boolean
    accomplishments?: boolean
    contacts?: boolean
  }
}

/**
 * Scrapes a LinkedIn person profile.
 */
export async function scrapePerson(
  page: Page,
  linkedinUrl: string,
  options?: PersonScraperOptions,
): Promise<PersonData> {
  const callback = options?.callback
  const sections = options?.sections ?? {
    about: true,
    experiences: true,
    educations: true,
    patents: true,
    interests: true,
    accomplishments: true,
    contacts: true,
  }

  await callback?.onStart('person', linkedinUrl)

  try {
    await navigateAndWait(page, linkedinUrl, callback)
    log.debug('Navigated to profile')

    await ensureLoggedIn(page)

    await page.waitForSelector('main', { timeout: 10000 })
    await waitAndFocus(page, 1)

    const { name, location, headline, origin } = await getTopCardProfileInfo(page)
    log.debug(`Got name: ${name}`)

    const openToWork = await checkOpenToWork(page)

    const about = sections.about ? await getAbout(page) : null
    if (sections.about) log.debug('Got about section')

    if (sections.experiences || sections.educations) {
      await scrollPageToHalf(page)
      await scrollPageToBottom(page, 0.5, 3)
    }

    const experiences = sections.experiences ? await getExperiences(page, linkedinUrl) : []
    if (sections.experiences) log.debug(`Got ${experiences.length} experiences`)

    const educations = sections.educations ? await getEducations(page, linkedinUrl) : []
    if (sections.educations) log.debug(`Got ${educations.length} educations`)

    const patents = sections.patents ? await getPatents(page, linkedinUrl) : []
    if (sections.patents) log.debug(`Got ${patents.length} patents`)

    const interests = sections.interests ? await getInterests(page, linkedinUrl) : []
    if (sections.interests) log.debug(`Got ${interests.length} interests`)

    const accomplishments = sections.accomplishments ? await getAccomplishments(page, linkedinUrl) : []
    if (sections.accomplishments) log.debug(`Got ${accomplishments.length} accomplishments`)

    const contacts = sections.contacts ? await getContactInfo(page, linkedinUrl) : []
    if (sections.contacts) log.debug(`Got ${contacts.length} contacts`)

    const person = createPerson({
      linkedinUrl,
      name,
      location: origin ?? location ?? undefined,
      headline: headline ?? undefined,
      origin: origin ?? undefined,
      about: about ?? undefined,
      openToWork,
      experiences,
      educations,
      patents,
      interests,
      accomplishments,
      contacts,
    } as PersonData)

    log.debug('Scraping complete')
    await callback?.onComplete('person', person)

    return person
  } catch (e: any) {
    await callback?.onError(`Failed to scrape person profile: ${e.message}`, e)
    throw new ScrapingError(`Failed to scrape person profile: ${e.message}`)
  }
}
