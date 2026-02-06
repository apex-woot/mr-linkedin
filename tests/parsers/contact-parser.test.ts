import { describe, expect, test } from 'bun:test'
import { ContactParser } from '../../src/extraction/parsers'
import type { RawSection } from '../../src/extraction/page-extractors'

describe('ContactParser', () => {
  const parser = new ContactParser()

  test('parses raw sections and deduplicates contacts', () => {
    const sections: RawSection[] = [
      {
        heading: 'Email',
        text: 'Email',
        labels: [],
        anchors: [
          { href: 'mailto:test@example.com', text: 'test@example.com' },
          { href: 'mailto:test@example.com', text: 'test@example.com' },
        ],
      },
      {
        heading: 'Profile',
        text: 'Profile',
        labels: [],
        anchors: [{ href: 'https://www.linkedin.com/in/sample', text: 'Profile' }],
      },
      {
        heading: 'Phone',
        text: 'Phone: +1 (555) 123-4567',
        labels: [],
        anchors: [],
      },
    ]

    const parsed = parser.parseRaw(sections)
    expect(parsed).toEqual([
      { type: 'email', value: 'test@example.com' },
      { type: 'linkedin', value: 'https://www.linkedin.com/in/sample' },
      { type: 'phone', value: '+1 (555) 123-4567' },
    ])
  })
})
