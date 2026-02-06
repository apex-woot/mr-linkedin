import { describe, expect, test } from 'bun:test'
import { InterestParser } from '../../src/extraction/parsers'

describe('InterestParser', () => {
  const parser = new InterestParser()

  test('parses interest with category and linkedin url', () => {
    const parsed = parser.parse({
      texts: ['Example Company'],
      links: [{ url: 'https://www.linkedin.com/company/example', text: '', isExternal: false }],
      context: { category: 'company' },
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.name).toBe('Example Company')
    expect(parsed?.category).toBe('company')
    expect(parsed?.linkedinUrl).toBe('https://www.linkedin.com/company/example')
    expect(parser.validate(parsed!)).toBe(true)
  })
})
