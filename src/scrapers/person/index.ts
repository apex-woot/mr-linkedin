import type { Page } from 'playwright'
import type { ProgressCallback } from '../../callbacks'
import { ScrapingError } from '../../exceptions'
import type { PersonData } from '../../models'
import { createPerson } from '../../models'
import {
  ensureLoggedIn,
  navigateAndWait,
  scrollPageToBottom,
  scrollPageToHalf,
  waitAndFocus,
} from '../utils'
import { getAccomplishments } from './accomplishments'
import { getContacts } from './contacts'
import { getEducations } from './educations'
import { getExperiences } from './experiences'
import { getInterests } from './interests'
import { getPatents } from './patents'
import { checkOpenToWork, getAbout, getNameAndLocation } from './profile'

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
    await callback?.onProgress('Navigated to profile', 10)

    await ensureLoggedIn(page)

    await page.waitForSelector('main', { timeout: 10000 })
    await waitAndFocus(page, 1)

    const { name, location } = await getNameAndLocation(page)
    await callback?.onProgress(`Got name: ${name}`, 20)

    const openToWork = await checkOpenToWork(page)

    const about = sections.about ? await getAbout(page) : null
    if (sections.about) {
      await callback?.onProgress('Got about section', 30)
    }

    if (sections.experiences || sections.educations) {
      await scrollPageToHalf(page)
      await scrollPageToBottom(page, 0.5, 3)
    }

    const experiences = sections.experiences
      ? await getExperiences(page, linkedinUrl)
      : []
    if (sections.experiences) {
      await callback?.onProgress(`Got ${experiences.length} experiences`, 60)
    }

    const educations = sections.educations
      ? await getEducations(page, linkedinUrl)
      : []
    if (sections.educations) {
      await callback?.onProgress(`Got ${educations.length} educations`, 50)
    }

    const patents = sections.patents ? await getPatents(page, linkedinUrl) : []
    if (sections.patents) {
      await callback?.onProgress(`Got ${patents.length} patents`, 55)
    }

    const interests = sections.interests
      ? await getInterests(page, linkedinUrl)
      : []
    if (sections.interests) {
      await callback?.onProgress(`Got ${interests.length} interests`, 65)
    }

    const accomplishments = sections.accomplishments
      ? await getAccomplishments(page, linkedinUrl)
      : []
    if (sections.accomplishments) {
      await callback?.onProgress(
        `Got ${accomplishments.length} accomplishments`,
        85,
      )
    }

    const contacts = sections.contacts
      ? await getContacts(page, linkedinUrl)
      : []
    if (sections.contacts) {
      await callback?.onProgress(`Got ${contacts.length} contacts`, 95)
    }

    const person = createPerson({
      linkedinUrl,
      name,
      location: location ?? undefined,
      about: about ?? undefined,
      openToWork,
      experiences,
      educations,
      patents,
      interests,
      accomplishments,
      contacts,
    } as PersonData)

    await callback?.onProgress('Scraping complete', 100)
    await callback?.onComplete('person', person)

    return person
  } catch (e: any) {
    await callback?.onError(`Failed to scrape person profile: ${e.message}`, e)
    throw new ScrapingError(`Failed to scrape person profile: ${e.message}`)
  }
}
