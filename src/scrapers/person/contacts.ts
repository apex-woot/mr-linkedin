import type { Page } from 'playwright'
import type { Contact } from '../../models'
import { navigateAndWait, waitAndFocus } from '../utils'
import { mapContactHeadingToType } from './utils'

export async function getContacts(
  page: Page,
  baseUrl: string,
): Promise<Contact[]> {
  const contacts: Contact[] = []

  try {
    const contactUrl = `${baseUrl.replace(/\/$/, '')}/overlay/contact-info/`
    await navigateAndWait(page, contactUrl)
    await waitAndFocus(page, 1)

    const dialog = page.locator('dialog, [role="dialog"]').first()
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

        const sectionContainer = sectionHeading.locator('xpath=ancestor::*[1]')
        if ((await sectionContainer.count()) === 0) continue

        const contactType = mapContactHeadingToType(headingText)
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
            } else if (contactType === 'email' && href.startsWith('mailto:')) {
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
            if (birthdayValue)
              contacts.push({ type: 'birthday', value: birthdayValue })
          }
        }

        if (contactType === 'phone' && links.length === 0) {
          const phoneText = await sectionContainer.textContent()
          if (phoneText) {
            const phoneValue = phoneText
              .replace(headingText, '')
              .replace(/Phone/i, '')
              .trim()
            if (phoneValue) contacts.push({ type: 'phone', value: phoneValue })
          }
        }

        if (contactType === 'address' && links.length === 0) {
          const addressText = await sectionContainer.textContent()
          if (addressText) {
            const addressValue = addressText
              .replace(headingText, '')
              .replace(/Address/i, '')
              .trim()
            if (addressValue)
              contacts.push({ type: 'address', value: addressValue })
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
