import { describe, expect, test } from 'bun:test'
import { AboutParser, TopCardParser } from '../../src/extraction/parsers'

describe('TopCardParser', () => {
  const parser = new TopCardParser()

  test('parses name/headline/origin and strips contact info suffix', () => {
    const parsed = parser.parse({
      texts: ['Alex Doe', 'Founder', 'Austin, Texas, United States Contact info'],
      links: [],
      context: {},
    })

    expect(parsed).toEqual({
      name: 'Alex Doe',
      headline: 'Founder',
      origin: 'Austin, Texas, United States',
    })
    expect(parser.validate(parsed!)).toBe(true)
  })
})

describe('AboutParser', () => {
  const parser = new AboutParser()

  test('filters heading and joins remaining lines', () => {
    const parsed = parser.parse({
      texts: ['About', 'Building resilient data systems.', 'Mentoring teams.'],
      links: [],
      context: {},
    })

    expect(parsed).toBe('Building resilient data systems.\nMentoring teams.')
    expect(parser.validate(parsed!)).toBe(true)
  })
})
