import { describe, expect, test } from 'bun:test'
import { EducationParser } from '../../src/extraction/parsers'

describe('EducationParser', () => {
  const parser = new EducationParser()

  test('parses degree and date range', () => {
    const parsed = parser.parse({
      texts: ['State University', 'B.S. Computer Science', '2014 - 2018'],
      links: [{ url: 'https://linkedin.com/school/state-u', text: '', isExternal: false }],
      context: {},
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.institutionName).toBe('State University')
    expect(parsed?.degree).toBe('B.S. Computer Science')
    expect(parsed?.fromDate).toBe('2014')
    expect(parsed?.toDate).toBe('2018')
    expect(parser.validate(parsed!)).toBe(true)
  })
})
