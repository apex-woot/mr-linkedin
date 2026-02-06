import type { Page } from 'playwright'
import { log } from '../utils/logger'
import type { SelectorVersion } from './registry'

export interface SelfHealContext {
  section: string
  failedSelectors: string[]
  expectedShape: string
  html: string
}

export interface SelfHealProvider {
  generateSelectors(context: SelfHealContext): Promise<SelectorVersion | null>
}

export interface SelfHealOptions {
  provider?: SelfHealProvider
  maxHtmlLength?: number
}

export async function attemptSelfHeal(
  page: Page,
  section: string,
  failedSelectors: string[],
  options: SelfHealOptions = {},
): Promise<SelectorVersion | null> {
  if (!options.provider) return null

  try {
    const html = await captureSectionHtml(page, options.maxHtmlLength ?? 4000)
    const context: SelfHealContext = {
      section,
      failedSelectors,
      expectedShape: 'array of item containers that contain human-visible text',
      html,
    }

    return await options.provider.generateSelectors(context)
  } catch (error) {
    log.debug(`self-heal failed for ${section}: ${error}`)
    return null
  }
}

export function buildSelfHealPrompt(context: SelfHealContext): string {
  return [
    `Section: ${context.section}`,
    `Failed selectors: ${context.failedSelectors.join(', ') || 'none'}`,
    `Expected output shape: ${context.expectedShape}`,
    'Generate resilient selectors preferring ARIA, semantic tags, then data attributes.',
    'Avoid hashed class names.',
    'HTML snippet:',
    context.html,
  ].join('\n\n')
}

async function captureSectionHtml(page: Page, maxLength: number): Promise<string> {
  const mainHtml = await page
    .locator('main')
    .innerHTML()
    .catch(() => '')
  return mainHtml.slice(0, maxLength)
}
