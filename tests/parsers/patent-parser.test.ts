import { describe, expect, test } from 'bun:test'
import { PatentParser } from '../../src/extraction/parsers'

describe('PatentParser', () => {
  const parser = new PatentParser()

  test('parses metadata and decodes redirect url', () => {
    const parsed = parser.parse({
      texts: [
        'Distributed Data Processing System',
        'US US10424882B2 · Issued Sep 24, 2019',
        'Improves distributed query execution.',
      ],
      links: [
        {
          url: 'https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fpatents.example.test%2Fabc',
          text: 'Show patent',
          isExternal: false,
        },
      ],
      context: {},
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.title).toBe('Distributed Data Processing System')
    expect(parsed?.issuer).toBe('US')
    expect(parsed?.number).toBe('US10424882B2')
    expect(parsed?.issuedDate).toBe('Sep 24, 2019')
    expect(parsed?.url).toBe('https://patents.example.test/abc')
    expect(parser.validate(parsed!)).toBe(true)
  })
})
