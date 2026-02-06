import type { Locator } from 'playwright'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult, RawSection } from './types'

const DIALOG_SELECTOR = 'dialog, [role="dialog"], .artdeco-modal'
const CONTACT_INFO_TRIGGER_SELECTORS = [
  '#top-card-text-details-contact-info',
  'a[href*="/overlay/contact-info/"]:has-text("Contact info")',
  'a:has-text("Contact info")',
] as const

export class ContactPageExtractor implements PageExtractor {
  readonly sectionName = 'contact'

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const dialog = await this.openContactInfoDialog(config)
    if (!dialog) return { kind: 'raw', data: [] }

    const data = await this.extractRawSections(dialog)
    return { kind: 'raw', data }
  }

  private async openContactInfoDialog(config: PageExtractorConfig): Promise<Locator | null> {
    for (const selector of CONTACT_INFO_TRIGGER_SELECTORS) {
      const trigger = config.page.locator(selector).first()
      if ((await trigger.count()) === 0) continue

      try {
        await trigger.scrollIntoViewIfNeeded()
        await Promise.all([
          config.page.waitForSelector(DIALOG_SELECTOR, {
            state: 'visible',
            timeout: 7000,
          }),
          trigger.click({ timeout: 7000 }),
        ])

        return config.page.locator(DIALOG_SELECTOR).first()
      } catch {}
    }

    return null
  }

  async extractRawSections(dialog: Locator): Promise<RawSection[]> {
    return await dialog.evaluate((root) => {
      const normalize = (input: string | null | undefined): string => {
        if (!input) return ''
        return input.replace(/\s+/g, ' ').trim()
      }

      const findContainer = (headingEl: HTMLHeadingElement): Element => {
        const headingText = normalize(headingEl.textContent)
        let current: Element | null = headingEl.parentElement

        while (current && current !== root) {
          const currentText = normalize(current.textContent)
          const headingCount = current.querySelectorAll('h3').length
          const hasAnchor = current.querySelector('a') !== null

          if (headingCount === 1 && (hasAnchor || currentText.length > headingText.length + 2)) {
            return current
          }

          current = current.parentElement
        }

        return headingEl.parentElement ?? headingEl
      }

      const headingNodes = Array.from(root.querySelectorAll('h3'))

      return headingNodes
        .map((headingNode) => {
          const heading = normalize(headingNode.textContent).toLowerCase()
          if (!heading) return null

          const container = findContainer(headingNode)
          const text = normalize(container.textContent)
          const labels = Array.from(container.querySelectorAll('span, p, li'))
            .map((el) => normalize(el.textContent))
            .map((t) => {
              const match = t.match(/^\(([^)]+)\)$/)
              return match?.[1]?.trim() ?? null
            })
            .filter((value): value is string => !!value)

          const anchors = Array.from(container.querySelectorAll('a')).map((anchor) => ({
            href: normalize(anchor.getAttribute('href')) || null,
            text: normalize(anchor.textContent) || null,
          }))

          return {
            heading,
            text,
            labels,
            anchors,
          }
        })
        .filter((item): item is RawSection => item !== null)
    })
  }
}
