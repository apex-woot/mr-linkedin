import { describe, expect, test } from 'bun:test'
import { parseDateRange, parseEducationTimes, parseWorkTimes } from './utils'

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

describe('parseWorkTimes (deprecated wrapper)', () => {
  test('calls parseDateRange with includeDuration', () => {
    const result = parseWorkTimes('Jan 2020 - Present · 4 yrs')
    expect(result.fromDate).toBe('Jan 2020')
    expect(result.toDate).toBe('Present')
    expect(result.duration).toBe('4 yrs')
  })
})

describe('parseEducationTimes (deprecated wrapper)', () => {
  test('calls parseDateRange without duration', () => {
    const result = parseEducationTimes('2018 - 2022')
    expect(result.fromDate).toBe('2018')
    expect(result.toDate).toBe('2022')
  })
})
