import { describe, expect, test } from 'bun:test'
import {
  normalizePlainTextLines,
  parseDateRange,
  toPlainText,
} from './utils'

describe('parseDateRange', () => {
  describe('basic date range parsing', () => {
    test('handles standard date range', () => {
      const result = parseDateRange('Jan 2020 - Dec 2023')
      expect(result.fromDate).toBe('Jan 2020')
      expect(result.toDate).toBe('Dec 2023')
      expect(result.duration).toBeUndefined()
    })

    test('handles date range with Present', () => {
      const result = parseDateRange('Jan 2020 - Present')
      expect(result.fromDate).toBe('Jan 2020')
      expect(result.toDate).toBe('Present')
    })

    test('normalizes "Current" to "Present"', () => {
      const result = parseDateRange('Jan 2020 - Current')
      expect(result.fromDate).toBe('Jan 2020')
      expect(result.toDate).toBe('Present')
    })

    test('normalizes "Now" to "Present"', () => {
      const result = parseDateRange('Jan 2020 - Now')
      expect(result.fromDate).toBe('Jan 2020')
      expect(result.toDate).toBe('Present')
    })

    test('normalizes "Ongoing" to "Present"', () => {
      const result = parseDateRange('Jan 2020 - Ongoing')
      expect(result.fromDate).toBe('Jan 2020')
      expect(result.toDate).toBe('Present')
    })

    test('handles year-only range', () => {
      const result = parseDateRange('2018 - 2023')
      expect(result.fromDate).toBe('2018')
      expect(result.toDate).toBe('2023')
    })

    test('handles single year (education format)', () => {
      const result = parseDateRange('2020')
      expect(result.fromDate).toBe('2020')
      expect(result.toDate).toBe('2020')
    })

    test('handles empty string', () => {
      const result = parseDateRange('')
      expect(result.fromDate).toBeNull()
      expect(result.toDate).toBeNull()
    })
  })

  describe('with duration option', () => {
    test('extracts duration from work experience', () => {
      const result = parseDateRange('Jan 2020 - Present · 4 yrs 2 mos', {
        includeDuration: true,
      })
      expect(result.fromDate).toBe('Jan 2020')
      expect(result.toDate).toBe('Present')
      expect(result.duration).toBe('4 yrs 2 mos')
    })

    test('handles date range with duration', () => {
      const result = parseDateRange('Jan 2020 - Dec 2023 · 3 yrs 11 mos', {
        includeDuration: true,
      })
      expect(result.fromDate).toBe('Jan 2020')
      expect(result.toDate).toBe('Dec 2023')
      expect(result.duration).toBe('3 yrs 11 mos')
    })

    test('handles single date with duration', () => {
      const result = parseDateRange('Jan 2020', { includeDuration: true })
      expect(result.fromDate).toBe('Jan 2020')
      expect(result.toDate).toBeNull()
      expect(result.duration).toBeNull()
    })

    test('handles empty string with duration option', () => {
      const result = parseDateRange('', { includeDuration: true })
      expect(result.fromDate).toBeNull()
      expect(result.toDate).toBeNull()
      expect(result.duration).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('handles whitespace-only duration', () => {
      const result = parseDateRange('Jan 2020 - Present ·  ', {
        includeDuration: true,
      })
      expect(result.fromDate).toBe('Jan 2020')
      expect(result.toDate).toBe('Present')
      expect(result.duration).toBe('')
    })

    test('handles malformed date string', () => {
      const result = parseDateRange('Not a date')
      expect(result.fromDate).toBe('Not a date')
      expect(result.toDate).toBe('Not a date')
    })
  })
})

describe('plainText helpers', () => {
  test('normalizes whitespace and removes adjacent duplicates', () => {
    const result = normalizePlainTextLines([
      '  US   US10424882B2  ',
      'US US10424882B2',
      'Issued   Sep 24, 2019',
      'Issued Sep 24, 2019',
    ])

    expect(result).toEqual(['US US10424882B2', 'Issued Sep 24, 2019'])
  })

  test('filters known noise lines', () => {
    const result = normalizePlainTextLines([
      'See patent',
      'Other inventors',
      '+3',
      'Real description',
    ])

    expect(result).toEqual(['Real description'])
  })

  test('builds newline-joined plain text', () => {
    const result = toPlainText(['Title', 'Title', 'Meta'])
    expect(result).toBe('Title\nMeta')
  })
})
