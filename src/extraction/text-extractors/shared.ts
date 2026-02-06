import type { Locator } from 'playwright'
import type { ExtractedLink, ExtractedText } from './types'

export function deduplicateTexts(texts: string[]): string[] {
  const seen = new Set<string>()
  const deduplicated: string[] = []

  for (const rawText of texts) {
    const text = rawText.trim()
    if (!text || seen.has(text)) continue

    let isSubstring = false
    for (const existing of seen) {
      if ((existing.length > 3 && text.includes(existing)) || (text.length > 3 && existing.includes(text))) {
        isSubstring = true
        break
      }
    }

    if (!isSubstring) {
      seen.add(text)
      deduplicated.push(text)
    }
  }

  return deduplicated
}

export async function extractLinksFromElement(element: Locator): Promise<ExtractedLink[]> {
  const anchors = await element.locator('a[href]').all()
  const links: ExtractedLink[] = []

  for (const anchor of anchors) {
    try {
      const href = await anchor.getAttribute('href')
      if (!href) continue

      links.push({
        url: href,
        text: (await anchor.textContent())?.trim() ?? '',
        isExternal: !href.includes('linkedin.com'),
      })
    } catch {}
  }

  return links
}

export async function detectSubItems(
  element: Locator,
  textExtractFn: (el: Locator) => Promise<string[]>,
): Promise<ExtractedText[]> {
  const subItems: ExtractedText[] = []

  try {
    const nestedUl = element.locator('ul').first()
    if ((await nestedUl.count()) === 0) return subItems

    const nestedLis = await nestedUl.locator('> li').all()
    if (nestedLis.length <= 1) return subItems

    for (const li of nestedLis) {
      const texts = await textExtractFn(li)
      if (texts.length === 0) continue

      subItems.push({
        texts,
        links: await extractLinksFromElement(li),
        confidence: texts.length >= 2 ? 0.8 : 0.5,
      })
    }
  } catch {
    // Best-effort nested extraction.
  }

  return subItems
}
