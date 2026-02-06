import type { Locator, Page } from 'playwright'
import type { Contact } from '../../models'
import { log } from '../../utils/logger'
import { waitAndFocus } from '../utils'
import { mapContactHeadingToType } from './utils'

interface RawAnchor {
  href: string | null
  text: string | null
}

interface RawSection {
  heading: string
  text: string
  labels: string[]
  anchors: RawAnchor[]
}

const DIALOG_SELECTOR = 'dialog, [role="dialog"], .artdeco-modal'
const CONTACT_INFO_TRIGGER_SELECTORS = [
  '#top-card-text-details-contact-info',
  'a[href*="/overlay/contact-info/"]:has-text("Contact info")',
  'a:has-text("Contact info")',
] as const

export async function getContactInfo(
  page: Page,
  _baseUrl: string,
): Promise<Contact[]> {
  try {
    const dialog = await openContactInfoDialog(page)
    if (!dialog) {
      return []
    }

    await waitAndFocus(page, 1)
    return await extractContactsFromDialog(dialog)
  } catch (e) {
    log.warning(`Error getting contacts: ${e}`)
    return []
  }
}

async function openContactInfoDialog(page: Page): Promise<Locator | null> {
  for (const selector of CONTACT_INFO_TRIGGER_SELECTORS) {
    const trigger = page.locator(selector).first()
    if ((await trigger.count()) === 0) {
      continue
    }

    try {
      await trigger.scrollIntoViewIfNeeded()
      await Promise.all([
        page.waitForSelector(DIALOG_SELECTOR, { state: 'visible', timeout: 7000 }),
        trigger.click({ timeout: 7000 }),
      ])

      return page.locator(DIALOG_SELECTOR).first()
    } catch (e) {
      log.debug(`Failed opening contact info dialog with selector '${selector}': ${e}`)
    }
  }

  log.warning('Contact info trigger not found or dialog did not open')
  return null
}

export async function extractContactsFromDialog(
  dialog: Locator,
): Promise<Contact[]> {
  const rawSections = await extractRawSections(dialog)
  const contacts: Contact[] = []

  for (const section of rawSections) {
    const contactType = mapContactHeadingToType(section.heading)
    if (!contactType) {
      continue
    }

    const label = section.labels[0]

    if (contactType === 'birthday' || contactType === 'phone' || contactType === 'address') {
      const value = extractPlainValue(section.text, section.heading)
      if (value) {
        contacts.push({ type: contactType, value })
      }
      continue
    }

    for (const anchor of section.anchors) {
      const normalized = normalizeAnchor(anchor)
      if (!normalized) {
        continue
      }

      if (contactType === 'email') {
        const value = normalized.href?.startsWith('mailto:')
          ? normalized.href.replace('mailto:', '')
          : normalized.text

        if (value) {
          contacts.push({
            type: 'email',
            value,
            label: label || undefined,
          })
        }
        continue
      }

      if (contactType === 'linkedin') {
        if (normalized.href) {
          contacts.push({
            type: 'linkedin',
            value: normalized.href,
            label: label || undefined,
          })
        }
        continue
      }

      const value = normalized.href || normalized.text
      if (value) {
        contacts.push({
          type: contactType,
          value,
          label: label || undefined,
        })
      }
    }
  }

  return dedupeContacts(contacts)
}

async function extractRawSections(dialog: Locator): Promise<RawSection[]> {
  return await dialog.evaluate((root) => {
    const normalize = (input: string | null | undefined): string => {
      if (!input) {
        return ''
      }
      return input.replace(/\s+/g, ' ').trim()
    }

    const findContainer = (headingEl: HTMLHeadingElement): Element => {
      const headingText = normalize(headingEl.textContent)
      let current: Element | null = headingEl.parentElement

      while (current && current !== root) {
        const currentText = normalize(current.textContent)
        const headingCount = current.querySelectorAll('h3').length
        const hasAnchor = current.querySelector('a') !== null

        if (
          headingCount === 1 &&
          (hasAnchor || currentText.length > headingText.length + 2)
        ) {
          return current
        }

        current = current.parentElement
      }

      return headingEl.parentElement ?? headingEl
    }

    const headingNodes = Array.from(root.querySelectorAll('h3'))

    return headingNodes
      .map((headingNode) => {
        const heading = normalize(headingNode.textContent).toLowerCase()
        if (!heading) {
          return null
        }

        const container = findContainer(headingNode)
        const text = normalize(container.textContent)
        const labels = Array.from(container.querySelectorAll('span, p, li'))
          .map((el) => normalize(el.textContent))
          .map((t) => {
            const match = t.match(/^\(([^)]+)\)$/)
            return match?.[1]?.trim() ?? null
          })
          .filter((value): value is string => !!value)

        const anchors = Array.from(container.querySelectorAll('a')).map(
          (anchor) => ({
            href: normalize(anchor.getAttribute('href')) || null,
            text: normalize(anchor.textContent) || null,
          }),
        )

        return {
          heading,
          text,
          labels,
          anchors,
        }
      })
      .filter((item): item is RawSection => item !== null)
  })
}

function normalizeAnchor(anchor: RawAnchor): RawAnchor | null {
  const href = normalizeValue(anchor.href)
  const text = normalizeValue(anchor.text)

  if (!href && !text) {
    return null
  }

  return { href, text }
}

function extractPlainValue(text: string, heading: string): string | null {
  let cleaned = normalizeValue(text)
  if (!cleaned) {
    return null
  }

  const headingRegex = new RegExp(`^${escapeRegex(heading)}\\s*`, 'i')
  cleaned = cleaned.replace(headingRegex, '').trim()
  cleaned = cleaned.replace(/^:\s*/, '').trim()

  return cleaned || null
}

function dedupeContacts(contacts: Contact[]): Contact[] {
  const seen = new Set<string>()
  const deduped: Contact[] = []

  for (const contact of contacts) {
    const key = `${contact.type}|${contact.value}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(contact)
  }

  return deduped
}

function normalizeValue(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized || null
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
