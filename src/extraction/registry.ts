import fs from 'node:fs/promises'

export interface SectionSelectorSet {
  itemSelectors: string[]
  containerSelectors?: string[]
}

export interface SelectorVersion {
  version: string
  updatedAt: string
  sections: Record<string, SectionSelectorSet>
}

const DEFAULT_VERSION: SelectorVersion = {
  version: 'v1',
  updatedAt: new Date(0).toISOString(),
  sections: {
    experience: {
      itemSelectors: [
        '.pvs-list__paged-list-item',
        'li.artdeco-list__item',
        'div[data-view-name="profile-component-entity"]',
        '[componentkey^="entity-collection-item"]',
        'main ul > li',
        'main ol > li',
      ],
      containerSelectors: ['main'],
    },
    accomplishment: {
      itemSelectors: [
        '.pvs-list__paged-list-item',
        'li.artdeco-list__item',
        'div[data-view-name="profile-component-entity"]',
        'main ul > li',
        'main ol > li',
      ],
      containerSelectors: ['main'],
    },
    education: {
      itemSelectors: [
        '[componentkey^="entity-collection-item"]',
        '.pvs-list__container .pvs-list__paged-list-item',
        'main ul > li',
        'main ol > li',
      ],
      containerSelectors: ['main'],
    },
    patent: {
      itemSelectors: [
        '[data-view-name="profile-patents-details-view"] div:has(> div > p):not(:has(> p))',
        '[componentkey^="com.linkedin.sdui.profile.card"] ul > li',
        '.pvs-list__container .pvs-list__paged-list-item',
        'li.artdeco-list__item',
      ],
      containerSelectors: ['main'],
    },
    interest: {
      itemSelectors: ['[role="tabpanel"] li', '[role="tabpanel"] .pvs-list__paged-list-item', 'main ul > li'],
      containerSelectors: ['main'],
    },
    contact: {
      itemSelectors: ['dialog section', '[role="dialog"] section', '.artdeco-modal section'],
      containerSelectors: ['dialog', '[role="dialog"]', '.artdeco-modal'],
    },
    'top-card': {
      itemSelectors: ['section.artdeco-card[data-member-id]', 'main section.artdeco-card'],
      containerSelectors: ['main'],
    },
    about: {
      itemSelectors: [
        '[data-testid="expandable-text-box"]',
        '[data-view-name="profile-card-about"]',
        '[data-view-name="profile-card"]',
      ],
      containerSelectors: ['main'],
    },
  },
}

class SelectorRegistry {
  private versions = new Map<string, SelectorVersion>([[DEFAULT_VERSION.version, DEFAULT_VERSION]])
  private activeVersion = DEFAULT_VERSION.version

  getActiveVersion(): SelectorVersion {
    return this.versions.get(this.activeVersion) ?? DEFAULT_VERSION
  }

  getSection(sectionName: string): SectionSelectorSet | null {
    return this.getActiveVersion().sections[sectionName] ?? null
  }

  setActiveVersion(version: string): boolean {
    if (!this.versions.has(version)) return false
    this.activeVersion = version
    return true
  }

  register(version: SelectorVersion): void {
    this.versions.set(version.version, version)
  }

  async loadFromFile(filePath: string): Promise<SelectorVersion> {
    const content = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(content) as SelectorVersion
    this.register(parsed)
    this.activeVersion = parsed.version
    return parsed
  }

  async saveToFile(filePath: string, version?: string): Promise<void> {
    const selected = version ? this.versions.get(version) : this.getActiveVersion()

    if (!selected) return

    await fs.writeFile(filePath, JSON.stringify(selected, null, 2), 'utf8')
  }
}

export const selectorRegistry = new SelectorRegistry()
export const DEFAULT_SELECTOR_VERSION = DEFAULT_VERSION
