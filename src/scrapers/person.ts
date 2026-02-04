import type { Locator } from 'playwright'
import { ScrapingError } from '../exceptions'
import type {
  Accomplishment,
  Contact,
  Education,
  Experience,
  Interest,
  PersonData,
} from '../models'
import { Person } from '../models'
import { BaseScraper } from './base'

/**
 * Async scraper for LinkedIn person profiles.
 */
export class PersonScraper extends BaseScraper {
  /**
   * Scrape a LinkedIn person profile.
   */
  async scrape(linkedinUrl: string): Promise<Person> {
    await this.callback.onStart('person', linkedinUrl)

    try {
      // Navigate to profile first
      await this.navigateAndWait(linkedinUrl)
      await this.callback.onProgress('Navigated to profile', 10)

      // Now check if logged in
      await this.ensureLoggedIn()

      // Wait for main content
      await this.page.waitForSelector('main', { timeout: 10000 })
      await this.waitAndFocus(1)

      // Get name and location
      const { name, location } = await this.getNameAndLocation()
      await this.callback.onProgress(`Got name: ${name}`, 20)

      // Check open to work
      const openToWork = await this.checkOpenToWork()

      // Get about
      const about = await this.getAbout()
      await this.callback.onProgress('Got about section', 30)

      // Scroll to load content
      await this.scrollPageToHalf()
      await this.scrollPageToBottom(0.5, 3)

      // Get sections
      const experiences = await this.getExperiences(linkedinUrl)
      await this.callback.onProgress(
        `Got ${experiences.length} experiences`,
        60,
      )

      const educations = await this.getEducations(linkedinUrl)
      await this.callback.onProgress(`Got ${educations.length} educations`, 50)

      const interests = await this.getInterests(linkedinUrl)
      await this.callback.onProgress(`Got ${interests.length} interests`, 65)

      const accomplishments = await this.getAccomplishments(linkedinUrl)
      await this.callback.onProgress(
        `Got ${accomplishments.length} accomplishments`,
        85,
      )

      const contacts = await this.getContacts(linkedinUrl)
      await this.callback.onProgress(`Got ${contacts.length} contacts`, 95)

      const person = new Person({
        linkedinUrl,
        name,
        location: location ?? undefined,
        about: about ?? undefined,
        openToWork,
        experiences,
        educations,
        interests,
        accomplishments,
        contacts,
      } as PersonData)

      await this.callback.onProgress('Scraping complete', 100)
      await this.callback.onComplete('person', person)

      return person
    } catch (e: any) {
      await this.callback.onError(
        `Failed to scrape person profile: ${e.message}`,
        e,
      )
      throw new ScrapingError(`Failed to scrape person profile: ${e.message}`)
    }
  }

  protected async getNameAndLocation(): Promise<{
    name: string
    location: string | null
  }> {
    try {
      const name = await this.safeExtractText('h1', 'Unknown')
      const location = await this.safeExtractText(
        '.text-body-small.inline.t-black--light.break-words',
        '',
      )
      return { name, location: location || null }
    } catch (e) {
      console.warn(`Error getting name/location: ${e}`)
      return { name: 'Unknown', location: null }
    }
  }

  protected async checkOpenToWork(): Promise<boolean> {
    try {
      const imgTitle = await this.getAttributeSafe(
        '.pv-top-card-profile-picture img',
        'title',
        '',
      )
      return imgTitle.toUpperCase().includes('#OPEN_TO_WORK')
    } catch (_e) {
      return false
    }
  }

  protected async getAbout(): Promise<string | null> {
    try {
      const profileCards = await this.page
        .locator('[data-view-name="profile-card"]')
        .all()

      for (const card of profileCards) {
        const cardText = await card.innerText()
        if (cardText.trim().startsWith('About')) {
          const aboutSpans = await card
            .locator('span[aria-hidden="true"]')
            .all()
          if (aboutSpans.length > 1) {
            const aboutText = await aboutSpans[1]?.textContent()
            return aboutText ? aboutText.trim() : null
          }
        }
      }

      return null
    } catch (e) {
      console.debug(`Error getting about section: ${e}`)
      return null
    }
  }

  protected async getExperiences(baseUrl: string): Promise<Experience[]> {
    const experiences: Experience[] = []

    try {
      const experienceHeading = this.page
        .locator('h2:has-text("Experience")')
        .first()

      if ((await experienceHeading.count()) > 0) {
        let experienceSection = experienceHeading.locator(
          'xpath=ancestor::*[.//ul or .//ol][1]',
        )
        if ((await experienceSection.count()) === 0) {
          experienceSection = experienceHeading.locator('xpath=ancestor::*[4]')
        }

        if ((await experienceSection.count()) > 0) {
          const items = await experienceSection
            .locator('ul > li, ol > li')
            .all()

          for (const item of items) {
            try {
              const exp = await this.parseMainPageExperience(item)
              if (exp) experiences.push(exp)
            } catch (e) {
              console.debug(`Error parsing experience from main page: ${e}`)
            }
          }
        }
      }

      if (experiences.length === 0) {
        const expUrl = new URL('details/experience', baseUrl).toString()
        await this.navigateAndWait(expUrl)
        await this.page.waitForSelector('main', { timeout: 10000 })
        await this.waitAndFocus(1.5)
        await this.scrollPageToHalf()
        await this.scrollPageToBottom(0.5, 5)

        let items: Locator[] = []
        const mainElement = this.page.locator('main')
        if ((await mainElement.count()) > 0) {
          const listItems = await mainElement
            .locator('list > listitem, ul > li')
            .all()
          if (listItems.length > 0) {
            items = listItems
          }
        }

        if (items.length === 0) {
          const oldList = this.page.locator('.pvs-list__container').first()
          if ((await oldList.count()) > 0) {
            items = await oldList.locator('.pvs-list__paged-list-item').all()
          }
        }

        for (const item of items) {
          try {
            const result = await this.parseExperienceItem(item)
            if (result) {
              if (Array.isArray(result)) {
                experiences.push(...result)
              } else {
                experiences.push(result)
              }
            }
          } catch (e) {
            console.debug(`Error parsing experience item: ${e}`)
          }
        }
      }
    } catch (e) {
      console.warn(`Error getting experiences: ${e}`)
    }

    return experiences
  }

  protected async parseMainPageExperience(
    item: Locator,
  ): Promise<Experience | null> {
    try {
      const links = await item.locator('a').all()
      if (links.length < 2) return null

      const companyUrl = (await links[0]?.getAttribute('href')) ?? undefined
      const detailLink = links[1]!

      const uniqueTexts = await this.extractUniqueTextsFromElement(detailLink)

      if (uniqueTexts.length < 2) return null

      const positionTitle = uniqueTexts[0]!
      const companyName = uniqueTexts[1]!
      const workTimes = uniqueTexts[2] ?? ''

      const { fromDate, toDate, duration } = this.parseWorkTimes(workTimes)

      return {
        positionTitle,
        institutionName: companyName,
        linkedinUrl: companyUrl,
        fromDate: fromDate ?? undefined,
        toDate: toDate ?? undefined,
        duration: duration ?? undefined,
      }
    } catch (e) {
      console.debug(`Error parsing main page experience: ${e}`)
      return null
    }
  }

  protected async extractUniqueTextsFromElement(
    element: Locator,
  ): Promise<string[]> {
    let textElements = await element
      .locator('span[aria-hidden="true"], div > span')
      .all()

    if (textElements.length === 0) {
      textElements = await element.locator('span, div').all()
    }

    const seenTexts = new Set<string>()
    const uniqueTexts: string[] = []

    for (const el of textElements) {
      const text = await el.textContent()
      if (text?.trim()) {
        const trimmed = text.trim()
        if (
          !seenTexts.has(trimmed) &&
          trimmed.length < 200 &&
          !Array.from(seenTexts).some(
            (t) =>
              (t.length > 3 && trimmed.includes(t)) ||
              (trimmed.length > 3 && t.includes(trimmed)),
          )
        ) {
          seenTexts.add(trimmed)
          uniqueTexts.push(trimmed)
        }
      }
    }

    return uniqueTexts
  }

  protected async parseExperienceItem(
    item: Locator,
  ): Promise<Experience | Experience[] | null> {
    try {
      const links = await item.locator('a, link').all()
      if (links.length >= 2) {
        const companyUrl = (await links[0]?.getAttribute('href')) ?? undefined
        const detailLink = links[1]!

        const generics = await detailLink.locator('generic, span, div').all()
        const texts: string[] = []
        for (const g of generics) {
          const text = await g.textContent()
          if (text?.trim() && text.trim().length < 200) {
            texts.push(text.trim())
          }
        }

        const uniqueTexts = Array.from(new Set(texts))

        if (uniqueTexts.length >= 2) {
          const positionTitle = uniqueTexts[0]!
          const companyName = uniqueTexts[1]!
          const workTimes = uniqueTexts[2] ?? ''
          const location = uniqueTexts[3] ?? ''

          const { fromDate, toDate, duration } = this.parseWorkTimes(workTimes)

          return {
            positionTitle,
            institutionName: companyName,
            linkedinUrl: companyUrl,
            fromDate: fromDate ?? undefined,
            toDate: toDate ?? undefined,
            duration: duration ?? undefined,
            location: location || undefined,
          }
        }
      }

      const entity = item
        .locator('div[data-view-name="profile-component-entity"]')
        .first()
      if ((await entity.count()) === 0) return null

      const children = await entity.locator('> *').all()
      if (children.length < 2) return null

      const companyLink = children[0]?.locator('a').first()
      const companyUrl = (await companyLink.getAttribute('href')) ?? undefined

      const detailContainer = children[1]!
      const detailChildren = await detailContainer.locator('> *').all()

      if (detailChildren.length === 0) return null

      let hasNestedPositions = false
      if (detailChildren.length > 1) {
        const nestedListCount = await detailChildren[1]
          ?.locator('.pvs-list__container')
          .count()
        hasNestedPositions = nestedListCount > 0
      }

      if (hasNestedPositions) {
        return await this.parseNestedExperience(
          item,
          companyUrl ?? '',
          detailChildren,
        )
      } else {
        const firstDetail = detailChildren[0]!
        const nestedElements = await firstDetail.locator('> *').all()

        if (nestedElements.length === 0) return null

        const spanContainer = nestedElements[0]!
        const outerSpans = await spanContainer.locator('> *').all()

        let positionTitle = ''
        let companyName = ''
        let workTimes = ''
        let location = ''

        if (outerSpans.length >= 1) {
          const ariaSpan = outerSpans[0]
            ?.locator('span[aria-hidden="true"]')
            .first()
          positionTitle = (await ariaSpan.textContent()) || ''
        }
        if (outerSpans.length >= 2) {
          const ariaSpan = outerSpans[1]
            ?.locator('span[aria-hidden="true"]')
            .first()
          companyName = (await ariaSpan.textContent()) || ''
        }
        if (outerSpans.length >= 3) {
          const ariaSpan = outerSpans[2]
            ?.locator('span[aria-hidden="true"]')
            .first()
          workTimes = (await ariaSpan.textContent()) || ''
        }
        if (outerSpans.length >= 4) {
          const ariaSpan = outerSpans[3]
            ?.locator('span[aria-hidden="true"]')
            .first()
          location = (await ariaSpan.textContent()) || ''
        }

        const { fromDate, toDate, duration } = this.parseWorkTimes(workTimes)

        let description = ''
        if (detailChildren.length > 1) {
          description = await detailChildren[1]?.innerText()
        }

        return {
          positionTitle: positionTitle.trim(),
          institutionName: companyName.trim(),
          linkedinUrl: companyUrl,
          fromDate: fromDate ?? undefined,
          toDate: toDate ?? undefined,
          duration: duration ?? undefined,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
        }
      }
    } catch (e) {
      console.debug(`Error parsing experience: ${e}`)
      return null
    }
  }

  protected async parseNestedExperience(
    _item: Locator,
    companyUrl: string,
    detailChildren: Locator[],
  ): Promise<Experience[]> {
    const experiences: Experience[] = []

    try {
      const firstDetail = detailChildren[0]!
      const nestedElements = await firstDetail.locator('> *').all()
      if (nestedElements.length === 0) return []

      const spanContainer = nestedElements[0]!
      const outerSpans = await spanContainer.locator('> *').all()

      let companyName = ''
      if (outerSpans.length >= 1) {
        const ariaSpan = outerSpans[0]
          ?.locator('span[aria-hidden="true"]')
          .first()
        companyName = (await ariaSpan.textContent()) || ''
      }

      const nestedContainer = detailChildren[1]
        ?.locator('.pvs-list__container')
        .first()
      const nestedItems = await nestedContainer
        .locator('.pvs-list__paged-list-item')
        .all()

      for (const nestedItem of nestedItems) {
        try {
          const link = nestedItem.locator('a').first()
          const linkChildren = await link.locator('> *').all()

          if (linkChildren.length === 0) continue

          const firstChild = linkChildren[0]!
          const nestedEls = await firstChild.locator('> *').all()
          if (nestedEls.length === 0) continue

          const spansContainer = nestedEls[0]!
          const positionSpans = await spansContainer.locator('> *').all()

          let positionTitle = ''
          let workTimes = ''
          let location = ''

          if (positionSpans.length >= 1) {
            const ariaSpan = positionSpans[0]
              ?.locator('span[aria-hidden="true"]')
              .first()
            positionTitle = (await ariaSpan.textContent()) || ''
          }
          if (positionSpans.length >= 2) {
            const ariaSpan = positionSpans[1]
              ?.locator('span[aria-hidden="true"]')
              .first()
            workTimes = (await ariaSpan.textContent()) || ''
          }
          if (positionSpans.length >= 3) {
            const ariaSpan = positionSpans[2]
              ?.locator('span[aria-hidden="true"]')
              .first()
            location = (await ariaSpan.textContent()) || ''
          }

          const { fromDate, toDate, duration } = this.parseWorkTimes(workTimes)

          let description = ''
          if (linkChildren.length > 1) {
            description = await linkChildren[1]?.innerText()
          }

          experiences.push({
            positionTitle: positionTitle.trim(),
            institutionName: companyName.trim(),
            linkedinUrl: companyUrl,
            fromDate: fromDate ?? undefined,
            toDate: toDate ?? undefined,
            duration: duration ?? undefined,
            location: location.trim() || undefined,
            description: description.trim() || undefined,
          })
        } catch (e) {
          console.debug(`Error parsing nested position: ${e}`)
        }
      }
    } catch (e) {
      console.debug(`Error parsing nested experience: ${e}`)
    }

    return experiences
  }

  protected parseWorkTimes(workTimes: string): {
    fromDate: string | null
    toDate: string | null
    duration: string | null
  } {
    if (!workTimes) return { fromDate: null, toDate: null, duration: null }

    try {
      const parts = workTimes.split('·')
      const times = parts.length > 0 ? parts[0]?.trim() : ''
      const duration = parts.length > 1 ? parts[1]?.trim() : null

      let fromDate: string | null = null
      let toDate: string | null = null

      if (times.includes(' - ')) {
        const dateParts = times.split(' - ')
        fromDate = dateParts[0]?.trim()
        toDate = dateParts.length > 1 ? dateParts[1]?.trim() : ''
      } else {
        fromDate = times
        toDate = ''
      }

      return { fromDate, toDate, duration }
    } catch (e) {
      console.debug(`Error parsing work times '${workTimes}': ${e}`)
      return { fromDate: null, toDate: null, duration: null }
    }
  }

  protected async getEducations(baseUrl: string): Promise<Education[]> {
    const educations: Education[] = []

    try {
      const educationHeading = this.page
        .locator('h2:has-text("Education")')
        .first()

      if ((await educationHeading.count()) > 0) {
        let educationSection = educationHeading.locator(
          'xpath=ancestor::*[.//ul or .//ol][1]',
        )
        if ((await educationSection.count()) === 0) {
          educationSection = educationHeading.locator('xpath=ancestor::*[4]')
        }

        if ((await educationSection.count()) > 0) {
          const items = await educationSection.locator('ul > li, ol > li').all()

          for (const item of items) {
            try {
              const edu = await this.parseMainPageEducation(item)
              if (edu) educations.push(edu)
            } catch (e) {
              console.debug(`Error parsing education from main page: ${e}`)
            }
          }
        }
      }

      if (educations.length === 0) {
        const eduUrl = new URL('details/education', baseUrl).toString()
        await this.navigateAndWait(eduUrl)
        await this.page.waitForSelector('main', { timeout: 10000 })
        await this.waitAndFocus(2)
        await this.scrollPageToHalf()
        await this.scrollPageToBottom(0.5, 5)

        let items: Locator[] = []
        const mainElement = this.page.locator('main')
        if ((await mainElement.count()) > 0) {
          const listItems = await mainElement.locator('ul > li, ol > li').all()
          if (listItems.length > 0) items = listItems
        }

        if (items.length === 0) {
          const oldList = this.page.locator('.pvs-list__container').first()
          if ((await oldList.count()) > 0) {
            items = await oldList.locator('.pvs-list__paged-list-item').all()
          }
        }

        for (const item of items) {
          try {
            const edu = await this.parseEducationItem(item)
            if (edu) educations.push(edu)
          } catch (e) {
            console.debug(`Error parsing education item: ${e}`)
          }
        }
      }
    } catch (e) {
      console.warn(`Error getting educations: ${e}`)
    }

    return educations
  }

  protected async parseMainPageEducation(
    item: Locator,
  ): Promise<Education | null> {
    try {
      const links = await item.locator('a').all()
      if (links.length === 0) return null

      const institutionUrl = (await links[0]?.getAttribute('href')) ?? undefined
      const detailLink = links.length > 1 ? links[1]! : links[0]!

      const uniqueTexts = await this.extractUniqueTextsFromElement(detailLink)

      if (uniqueTexts.length === 0) return null

      const institutionName = uniqueTexts[0]!
      let degree: string | null = null
      let times = ''

      if (uniqueTexts.length === 3) {
        degree = uniqueTexts[1]!
        times = uniqueTexts[2]!
      } else if (uniqueTexts.length === 2) {
        const second = uniqueTexts[1]!
        if (second.includes(' - ') || /\d/.test(second)) {
          times = second
        } else {
          degree = second
        }
      }

      const { fromDate, toDate } = this.parseEducationTimes(times)

      return {
        institutionName,
        degree: degree?.trim() || undefined,
        linkedinUrl: institutionUrl,
        fromDate: fromDate ?? undefined,
        toDate: toDate ?? undefined,
      }
    } catch (e) {
      console.debug(`Error parsing main page education: ${e}`)
      return null
    }
  }

  protected async parseEducationItem(item: Locator): Promise<Education | null> {
    try {
      const links = await item.locator('a, link').all()
      if (links.length >= 1) {
        const institutionUrl =
          (await links[0]?.getAttribute('href')) ?? undefined

        const detailLink = links.length >= 2 ? links[1]! : links[0]!
        const generics = await detailLink.locator('generic, span, div').all()
        const texts: string[] = []
        for (const g of generics) {
          const text = await g.textContent()
          if (text?.trim() && text.trim().length < 200) {
            texts.push(text.trim())
          }
        }

        const uniqueTexts = Array.from(new Set(texts))

        if (uniqueTexts.length > 0) {
          const institutionName = uniqueTexts[0]!
          let degree: string | null = null
          let times = ''

          if (uniqueTexts.length === 3) {
            degree = uniqueTexts[1]!
            times = uniqueTexts[2]!
          } else if (uniqueTexts.length === 2) {
            const second = uniqueTexts[1]!
            if (second.includes(' - ') || /\d/.test(second)) {
              times = second
            } else {
              degree = second
            }
          }

          const { fromDate, toDate } = this.parseEducationTimes(times)

          return {
            institutionName,
            degree: degree?.trim() || undefined,
            linkedinUrl: institutionUrl,
            fromDate: fromDate ?? undefined,
            toDate: toDate ?? undefined,
          }
        }
      }

      const entity = item
        .locator('div[data-view-name="profile-component-entity"]')
        .first()
      if ((await entity.count()) === 0) return null

      const children = await entity.locator('> *').all()
      if (children.length < 2) return null

      const institutionLink = children[0]?.locator('a').first()
      const institutionUrl =
        (await institutionLink.getAttribute('href')) ?? undefined

      const detailContainer = children[1]!
      const detailChildren = await detailContainer.locator('> *').all()

      if (detailChildren.length === 0) return null

      const firstDetail = detailChildren[0]!
      const nestedElements = await firstDetail.locator('> *').all()

      if (nestedElements.length === 0) return null

      const spanContainer = nestedElements[0]!
      const outerSpans = await spanContainer.locator('> *').all()

      let institutionName = ''
      let degree: string | null = null
      let times = ''

      if (outerSpans.length >= 1) {
        const ariaSpan = outerSpans[0]
          ?.locator('span[aria-hidden="true"]')
          .first()
        institutionName = (await ariaSpan.textContent()) || ''
      }

      if (outerSpans.length === 3) {
        const ariaSpan1 = outerSpans[1]
          ?.locator('span[aria-hidden="true"]')
          .first()
        degree = await ariaSpan1.textContent()
        const ariaSpan2 = outerSpans[2]
          ?.locator('span[aria-hidden="true"]')
          .first()
        times = (await ariaSpan2.textContent()) || ''
      } else if (outerSpans.length === 2) {
        const ariaSpan = outerSpans[1]
          ?.locator('span[aria-hidden="true"]')
          .first()
        times = (await ariaSpan.textContent()) || ''
      }

      const { fromDate, toDate } = this.parseEducationTimes(times)

      let description = ''
      if (detailChildren.length > 1) {
        description = await detailChildren[1]?.innerText()
      }

      return {
        institutionName: institutionName.trim(),
        degree: degree?.trim() || undefined,
        linkedinUrl: institutionUrl,
        fromDate: fromDate ?? undefined,
        toDate: toDate ?? undefined,
        description: description.trim() || undefined,
      }
    } catch (e) {
      console.debug(`Error parsing education: ${e}`)
      return null
    }
  }

  protected parseEducationTimes(times: string): {
    fromDate: string | null
    toDate: string | null
  } {
    if (!times) return { fromDate: null, toDate: null }

    try {
      if (times.includes(' - ')) {
        const parts = times.split(' - ')
        const fromDate = parts[0]?.trim()
        const toDate = parts.length > 1 ? parts[1]?.trim() : ''
        return { fromDate, toDate }
      } else {
        const year = times.trim()
        return { fromDate: year, toDate: year }
      }
    } catch (e) {
      console.debug(`Error parsing education times '${times}': ${e}`)
      return { fromDate: null, toDate: null }
    }
  }

  protected async getInterests(baseUrl: string): Promise<Interest[]> {
    const interests: Interest[] = []

    try {
      const interestsHeading = this.page
        .locator('h2:has-text("Interests")')
        .first()

      if ((await interestsHeading.count()) > 0) {
        let interestsSection = interestsHeading.locator(
          'xpath=ancestor::*[.//tablist or .//*[@role="tablist"]][1]',
        )
        if ((await interestsSection.count()) === 0) {
          interestsSection = interestsHeading.locator('xpath=ancestor::*[4]')
        }

        const tabs =
          (await interestsSection.count()) > 0
            ? await interestsSection.locator('[role="tab"], tab').all()
            : []

        if (tabs.length > 0) {
          for (const tab of tabs) {
            try {
              const tabName = await tab.textContent()
              if (!tabName) continue
              const category = this.mapInterestTabToCategory(tabName.trim())

              await tab.click()
              await this.waitAndFocus(0.5)

              const tabpanel = interestsSection
                .locator('[role="tabpanel"]')
                .first()
              if ((await tabpanel.count()) > 0) {
                const listItems = await tabpanel.locator('li, listitem').all()

                for (const item of listItems) {
                  try {
                    const interest = await this.parseInterestItem(
                      item,
                      category,
                    )
                    if (interest) interests.push(interest)
                  } catch (e) {
                    console.debug(`Error parsing interest item: ${e}`)
                  }
                }
              }
            } catch (e) {
              console.debug(`Error processing interest tab: ${e}`)
            }
          }
        }
      }

      if (interests.length === 0) {
        const interestsUrl = new URL('details/interests/', baseUrl).toString()
        await this.navigateAndWait(interestsUrl)
        await this.page.waitForSelector('main', { timeout: 10000 })
        await this.waitAndFocus(1.5)

        const tabs = await this.page.locator('[role="tab"], tab').all()

        for (const tab of tabs) {
          try {
            const tabName = await tab.textContent()
            if (!tabName) continue
            const category = this.mapInterestTabToCategory(tabName.trim())

            await tab.click()
            await this.waitAndFocus(0.8)

            const tabpanel = this.page
              .locator('[role="tabpanel"], tabpanel')
              .first()
            const listItems = await tabpanel
              .locator('listitem, li, .pvs-list__paged-list-item')
              .all()

            for (const item of listItems) {
              try {
                const interest = await this.parseInterestItem(item, category)
                if (interest) interests.push(interest)
              } catch (e) {
                console.debug(`Error parsing interest item: ${e}`)
              }
            }
          } catch (e) {
            console.debug(`Error processing interest tab: ${e}`)
          }
        }
      }
    } catch (e) {
      console.warn(`Error getting interests: ${e}`)
    }

    return interests
  }

  protected async parseInterestItem(
    item: Locator,
    category: string,
  ): Promise<Interest | null> {
    try {
      const link = item.locator('a, link').first()
      if ((await link.count()) === 0) return null
      const href = (await link.getAttribute('href')) ?? undefined

      const uniqueTexts = await this.extractUniqueTextsFromElement(item)
      const name = uniqueTexts.length > 0 ? uniqueTexts[0]! : null

      if (name && href) {
        return {
          name,
          category,
          linkedinUrl: href,
        }
      }
      return null
    } catch (e) {
      console.debug(`Error parsing interest: ${e}`)
      return null
    }
  }

  protected mapInterestTabToCategory(tabName: string): string {
    const tabLower = tabName.toLowerCase()
    if (tabLower.includes('compan')) return 'company'
    if (tabLower.includes('group')) return 'group'
    if (tabLower.includes('school')) return 'school'
    if (tabLower.includes('newsletter')) return 'newsletter'
    if (tabLower.includes('voice') || tabLower.includes('influencer'))
      return 'influencer'
    return tabLower
  }

  protected async getAccomplishments(
    baseUrl: string,
  ): Promise<Accomplishment[]> {
    const accomplishments: Accomplishment[] = []

    const accomplishmentSections: Array<[string, string]> = [
      ['certifications', 'certification'],
      ['honors', 'honor'],
      ['publications', 'publication'],
      ['patents', 'patent'],
      ['courses', 'course'],
      ['projects', 'project'],
      ['languages', 'language'],
      ['organizations', 'organization'],
    ]

    for (const [urlPath, category] of accomplishmentSections) {
      try {
        const sectionUrl = new URL(`details/${urlPath}/`, baseUrl).toString()
        await this.navigateAndWait(sectionUrl)
        await this.page.waitForSelector('main', { timeout: 10000 })
        await this.waitAndFocus(1)

        const nothingToSee = await this.page
          .locator('text="Nothing to see for now"')
          .count()
        if (nothingToSee > 0) continue

        const mainList = this.page
          .locator('.pvs-list__container, main ul, main ol')
          .first()
        if ((await mainList.count()) === 0) continue

        let items = await mainList.locator('.pvs-list__paged-list-item').all()
        if (items.length === 0) {
          items = await mainList.locator('> li').all()
        }

        const seenTitles = new Set<string>()
        for (const item of items) {
          try {
            const accomplishment = await this.parseAccomplishmentItem(
              item,
              category,
            )
            if (accomplishment && !seenTitles.has(accomplishment.title)) {
              seenTitles.add(accomplishment.title)
              accomplishments.push(accomplishment)
            }
          } catch (e) {
            console.debug(`Error parsing ${category} item: ${e}`)
          }
        }
      } catch (e) {
        console.debug(`Error getting ${category}s: ${e}`)
      }
    }

    return accomplishments
  }

  protected async parseAccomplishmentItem(
    item: Locator,
    category: string,
  ): Promise<Accomplishment | null> {
    try {
      const entity = item
        .locator('div[data-view-name="profile-component-entity"]')
        .first()
      let spans: Locator[]
      if ((await entity.count()) > 0) {
        spans = await entity.locator('span[aria-hidden="true"]').all()
      } else {
        spans = await item.locator('span[aria-hidden="true"]').all()
      }

      let title = ''
      let issuer = ''
      let issuedDate = ''
      let credentialId = ''

      for (let i = 0; i < Math.min(spans.length, 5); i++) {
        const text = (await spans[i]?.textContent())?.trim()
        if (!text || text.length > 500) continue

        if (i === 0) {
          title = text
        } else if (text.includes('Issued by')) {
          const parts = text.split('·')
          issuer = parts[0]?.replace('Issued by', '').trim()
          if (parts.length > 1) {
            issuedDate = parts[1]?.trim()
          }
        } else if (text.startsWith('Issued ') && !issuedDate) {
          issuedDate = text.replace('Issued ', '')
        } else if (text.startsWith('Credential ID')) {
          credentialId = text.replace('Credential ID ', '')
        } else if (i === 1 && !issuer) {
          issuer = text
        } else if (
          /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(text) &&
          !issuedDate
        ) {
          if (text.includes('·')) {
            issuedDate = text.split('·')[0]?.trim()
          } else {
            issuedDate = text
          }
        }
      }

      const link = item
        .locator('a[href*="credential"], a[href*="verify"]')
        .first()
      const credentialUrl =
        (await link.count()) > 0 ? await link.getAttribute('href') : null

      if (!title || title.length > 200) return null

      return {
        category,
        title,
        issuer: issuer || undefined,
        issuedDate: issuedDate || undefined,
        credentialId: credentialId || undefined,
        credentialUrl: credentialUrl || undefined,
      }
    } catch (e) {
      console.debug(`Error parsing accomplishment: ${e}`)
      return null
    }
  }

  protected async getContacts(baseUrl: string): Promise<Contact[]> {
    const contacts: Contact[] = []

    try {
      const contactUrl = new URL('overlay/contact-info/', baseUrl).toString()
      await this.navigateAndWait(contactUrl)
      await this.waitAndFocus(1)

      const dialog = this.page.locator('dialog, [role="dialog"]').first()
      if ((await dialog.count()) === 0) {
        console.warn('Contact info dialog not found')
        return contacts
      }

      const contactSections = await dialog.locator('h3').all()

      for (const sectionHeading of contactSections) {
        try {
          const headingText = (await sectionHeading.textContent())
            ?.trim()
            .toLowerCase()
          if (!headingText) continue

          const sectionContainer = sectionHeading.locator(
            'xpath=ancestor::*[1]',
          )
          if ((await sectionContainer.count()) === 0) continue

          const contactType = this.mapContactHeadingToType(headingText)
          if (!contactType) continue

          const links = await sectionContainer.locator('a').all()
          for (const link of links) {
            const href = await link.getAttribute('href')
            const text = (await link.textContent())?.trim()
            if (href && text) {
              let label: string | null = null
              const siblingText = await sectionContainer
                .locator('span, generic')
                .all()
              for (const sib of siblingText) {
                const sibText = (await sib.textContent())?.trim()
                if (sibText?.startsWith('(') && sibText.endsWith(')')) {
                  label = sibText.slice(1, -1)
                  break
                }
              }

              if (contactType === 'linkedin') {
                contacts.push({
                  type: contactType,
                  value: href,
                  label: label || undefined,
                })
              } else if (
                contactType === 'email' &&
                href.startsWith('mailto:')
              ) {
                contacts.push({
                  type: contactType,
                  value: href.replace('mailto:', ''),
                  label: label || undefined,
                })
              } else {
                contacts.push({
                  type: contactType,
                  value: text,
                  label: label || undefined,
                })
              }
            }
          }

          if (contactType === 'birthday' && links.length === 0) {
            const birthdayText = await sectionContainer.textContent()
            if (birthdayText) {
              const birthdayValue = birthdayText
                .replace(headingText, '')
                .replace(/Birthday/i, '')
                .trim()
              if (birthdayValue) {
                contacts.push({ type: 'birthday', value: birthdayValue })
              }
            }
          }

          if (contactType === 'phone' && links.length === 0) {
            const phoneText = await sectionContainer.textContent()
            if (phoneText) {
              const phoneValue = phoneText
                .replace(headingText, '')
                .replace(/Phone/i, '')
                .trim()
              if (phoneValue) {
                contacts.push({ type: 'phone', value: phoneValue })
              }
            }
          }

          if (contactType === 'address' && links.length === 0) {
            const addressText = await sectionContainer.textContent()
            if (addressText) {
              const addressValue = addressText
                .replace(headingText, '')
                .replace(/Address/i, '')
                .trim()
              if (addressValue) {
                contacts.push({ type: 'address', value: addressValue })
              }
            }
          }
        } catch (e) {
          console.debug(`Error parsing contact section: ${e}`)
        }
      }
    } catch (e) {
      console.warn(`Error getting contacts: ${e}`)
    }

    return contacts
  }

  protected mapContactHeadingToType(heading: string): string | null {
    const lower = heading.toLowerCase()
    if (lower.includes('profile')) return 'linkedin'
    if (lower.includes('website')) return 'website'
    if (lower.includes('email')) return 'email'
    if (lower.includes('phone')) return 'phone'
    if (lower.includes('twitter') || lower.includes('x.com')) return 'twitter'
    if (lower.includes('birthday')) return 'birthday'
    if (lower.includes('address')) return 'address'
    return null
  }
}
