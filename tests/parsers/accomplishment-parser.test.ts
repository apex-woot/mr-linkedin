import { describe, expect, test } from 'bun:test'
import { AccomplishmentParser } from '../../src/extraction/parsers'

describe('AccomplishmentParser', () => {
  const parser = new AccomplishmentParser()

  test('parses accomplishment fields from text patterns', () => {
    const parsed = parser.parse({
      texts: ['AWS Certified Developer', 'Issued by Amazon Web Services · Jan 2024', 'Credential ID ABC-123'],
      links: [{ url: 'https://example.test/verify', text: 'verify', isExternal: true }],
      context: { category: 'certification' },
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.category).toBe('certification')
    expect(parsed?.title).toBe('AWS Certified Developer')
    expect(parsed?.issuer).toBe('Amazon Web Services')
    expect(parsed?.issuedDate).toBe('Jan 2024')
    expect(parsed?.credentialId).toBe('ABC-123')
    expect(parsed?.credentialUrl).toBe('https://example.test/verify')
    expect(parser.validate(parsed!)).toBe(true)
  })
})
