import type { Locator, Page } from 'playwright'

/** Per-item metadata carried alongside the Locator */
export interface TaggedLocator {
  locator: Locator
  context: Record<string, string>
}

/** Raw section data for modal-based extraction (contacts) */
export interface RawSection {
  heading: string
  text: string
  labels: string[]
  anchors: Array<{ href: string | null; text: string | null }>
}

/** Discriminated union — different sections need different output shapes */
export type PageExtractorResult =
  | { kind: 'list'; items: TaggedLocator[] }
  | { kind: 'single'; element: Locator; context: Record<string, string> }
  | { kind: 'raw'; data: RawSection[] }

/** Config passed to every page extractor */
export interface PageExtractorConfig {
  /** LinkedIn profile base URL, e.g. "https://www.linkedin.com/in/someone" */
  baseUrl: string
  /** Playwright page instance */
  page: Page
  /** Section-specific scroll/wait overrides */
  scroll?: {
    pauseTime?: number
    maxScrolls?: number
  }
  focusWait?: number
}

/** Every section implements this interface */
export interface PageExtractor {
  /** Section identifier — matches SelectorRegistry keys and Parser.sectionName */
  readonly sectionName: string
  /** Navigate to the section page, scroll, open modals, click tabs, find items */
  extract(config: PageExtractorConfig): Promise<PageExtractorResult>
}
