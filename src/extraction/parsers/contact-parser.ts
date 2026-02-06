import type { Contact } from '../../models'
import { mapContactHeadingToType } from '../../scrapers/person/utils'
import type { RawSection } from '../page-extractors'
import type { ParseInput, RawParser } from './types'

interface RawAnchor {
  href: string | null
  text: string | null
}

export class ContactParser implements RawParser<Contact> {
  readonly sectionName = 'contact'

  parse(_input: ParseInput): Contact | null {
    return null
  }

  parseRaw(sections: RawSection[]): Contact[] {
    const contacts: Contact[] = []

    for (const section of sections) {
      const contactType = mapContactHeadingToType(section.heading)
      if (!contactType) continue

      const label = section.labels[0]

      if (contactType === 'birthday' || contactType === 'phone' || contactType === 'address') {
        const value = extractPlainValue(section.text, section.heading)
        if (value) contacts.push({ type: contactType, value })
        continue
      }

      for (const anchor of section.anchors) {
        const normalized = normalizeAnchor(anchor)
        if (!normalized) continue

        if (contactType === 'email') {
          const value = normalized.href?.startsWith('mailto:')
            ? normalized.href.replace('mailto:', '')
            : normalized.text

          if (value) {
            contacts.push(label ? { type: 'email', value, label } : { type: 'email', value })
          }
          continue
        }

        if (contactType === 'linkedin') {
          if (normalized.href) {
            contacts.push(
              label
                ? { type: 'linkedin', value: normalized.href, label }
                : { type: 'linkedin', value: normalized.href },
            )
          }
          continue
        }

        const value = normalized.href || normalized.text
        if (value) {
          contacts.push(label ? { type: contactType, value, label } : { type: contactType, value })
        }
      }
    }

    return dedupeContacts(contacts)
  }

  validate(item: Contact): boolean {
    return !!item.type && !!item.value
  }
}

function normalizeAnchor(anchor: RawAnchor): RawAnchor | null {
  const href = normalizeValue(anchor.href)
  const text = normalizeValue(anchor.text)

  if (!href && !text) return null

  return { href, text }
}

function extractPlainValue(text: string, heading: string): string | null {
  let cleaned = normalizeValue(text)
  if (!cleaned) return null

  const headingRegex = new RegExp(`^${escapeRegex(heading)}\\s*`, 'i')
  cleaned = cleaned.replace(headingRegex, '').trim()
  cleaned = cleaned.replace(/^\s*:\s*/, '').trim()

  return cleaned || null
}

function dedupeContacts(contacts: Contact[]): Contact[] {
  const seen = new Set<string>()
  const deduped: Contact[] = []

  for (const contact of contacts) {
    const key = `${contact.type}|${contact.value}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(contact)
  }

  return deduped
}

function normalizeValue(value: string | null | undefined): string | null {
  if (!value) return null

  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized || null
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
