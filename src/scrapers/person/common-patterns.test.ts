import { describe, expect, mock, test } from 'bun:test'
import type { Locator } from 'playwright'
import { deduplicateItems, parseItems } from './common-patterns'

describe('parseItems', () => {
  test('parses all items successfully', async () => {
    const mockItems = [
      createMockLocator('item1'),
      createMockLocator('item2'),
      createMockLocator('item3'),
    ]

    const parser = mock(async (item: Locator, idx: number) => ({
      name: await item.textContent(),
      index: idx,
    }))

    const results = await parseItems(mockItems, parser, { itemType: 'test' })

    expect(results).toHaveLength(3)
    expect(results[0]?.name).toBe('item1')
    expect(results[1]?.name).toBe('item2')
    expect(results[2]?.name).toBe('item3')
    expect(parser).toHaveBeenCalledTimes(3)
  })

  test('skips null results from parser', async () => {
    const mockItems = [
      createMockLocator('item1'),
      createMockLocator('item2'),
      createMockLocator('item3'),
    ]

    const parser = async (item: Locator) => {
      const text = await item.textContent()
      return text === 'item2' ? null : { name: text }
    }

    const results = await parseItems(mockItems, parser, { itemType: 'test' })

    expect(results).toHaveLength(2)
    expect(results[0]?.name).toBe('item1')
    expect(results[1]?.name).toBe('item3')
  })

  test('continues parsing after errors', async () => {
    const mockItems = [
      createMockLocator('item1'),
      createMockLocator('item2'),
      createMockLocator('item3'),
    ]

    const parser = async (item: Locator) => {
      const text = await item.textContent()
      if (text === 'item2') throw new Error('Parse error')
      return { name: text }
    }

    const results = await parseItems(mockItems, parser, { itemType: 'test' })

    expect(results).toHaveLength(2)
    expect(results[0]?.name).toBe('item1')
    expect(results[1]?.name).toBe('item3')
  })

  test('respects shouldSkip predicate', async () => {
    const mockItems = [
      createMockLocator('item1'),
      createMockLocator('skip-me'),
      createMockLocator('item3'),
    ]

    const parser = async (item: Locator) => ({
      name: await item.textContent(),
    })

    const results = await parseItems(mockItems, parser, {
      itemType: 'test',
      shouldSkip: async (item) => {
        const text = await item.textContent()
        return text?.includes('skip') ?? false
      },
    })

    expect(results).toHaveLength(2)
    expect(results[0]?.name).toBe('item1')
    expect(results[1]?.name).toBe('item3')
  })

  test('calls onSuccess callback', async () => {
    const mockItems = [createMockLocator('item1')]

    const parser = async (item: Locator) => ({
      name: await item.textContent(),
    })

    const onSuccess = mock(() => {})

    await parseItems(mockItems, parser, {
      itemType: 'test',
      onSuccess,
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith({ name: 'item1' }, 0)
  })

  test('calls onError callback', async () => {
    const mockItems = [createMockLocator('item1')]

    const parser = async () => {
      throw new Error('Test error')
    }

    const onError = mock(() => {})

    await parseItems(mockItems, parser, {
      itemType: 'test',
      onError,
    })

    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('deduplicateItems', () => {
  test('removes duplicates based on key', () => {
    const items = [
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' },
      { id: '1', name: 'First Duplicate' },
      { id: '3', name: 'Third' },
    ]

    const result = deduplicateItems(items, (item) => item.id)

    expect(result).toHaveLength(3)
    expect(result[0]?.name).toBe('First') // First occurrence kept
    expect(result[1]?.name).toBe('Second')
    expect(result[2]?.name).toBe('Third')
  })

  test('handles empty array', () => {
    const result = deduplicateItems<{ id: string }>([], (item) => item.id)
    expect(result).toEqual([])
  })

  test('handles array with no duplicates', () => {
    const items = [
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' },
      { id: '3', name: 'Third' },
    ]

    const result = deduplicateItems(items, (item) => item.id)

    expect(result).toHaveLength(3)
    expect(result).toEqual(items)
  })

  test('handles composite keys', () => {
    const items = [
      { company: 'A', title: 'Engineer' },
      { company: 'B', title: 'Engineer' },
      { company: 'A', title: 'Engineer' }, // Duplicate
      { company: 'A', title: 'Manager' }, // Different title, not duplicate
    ]

    const result = deduplicateItems(
      items,
      (item) => `${item.company}|${item.title}`,
    )

    expect(result).toHaveLength(3)
  })
})

// Helper function to create mock Playwright Locator
function createMockLocator(text: string): Locator {
  return {
    textContent: async () => text,
  } as unknown as Locator
}
