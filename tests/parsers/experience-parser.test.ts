import { describe, expect, test } from 'bun:test'
import { ExperienceParser } from '../../src/extraction/parsers'

describe('ExperienceParser', () => {
  const parser = new ExperienceParser()

  test('parses a single-position experience', () => {
    const parsed = parser.parse({
      texts: [
        'Senior Engineer',
        'Example Corp · Full-time',
        'Jan 2020 - Present · 4 yrs',
        'Austin, Texas, United States',
        'Built core platform systems.',
      ],
      links: [{ url: 'https://linkedin.com/company/example', text: '', isExternal: false }],
      context: {},
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.company).toBe('Example Corp')
    expect(parsed?.positions[0]?.title).toBe('Senior Engineer')
    expect(parsed?.positions[0]?.employmentType).toBe('Full-time')
    expect(parsed?.positions[0]?.fromDate).toBe('Jan 2020')
    expect(parsed?.positions[0]?.toDate).toBe('Present')
    expect(parser.validate(parsed!)).toBe(true)
  })

  test('parses a multi-position experience', () => {
    const parsed = parser.parse({
      texts: ['Example Corp'],
      links: [],
      context: {},
      subItems: [
        {
          texts: ['Staff Engineer', 'Jan 2022 - Present · 2 yrs', 'Remote'],
          links: [],
          context: {},
        },
      ],
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.company).toBe('Example Corp')
    expect(parsed?.positions.length).toBe(1)
    expect(parsed?.positions[0]?.title).toBe('Staff Engineer')
    expect(parser.validate(parsed!)).toBe(true)
  })
})
