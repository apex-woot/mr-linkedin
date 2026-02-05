/**
 * LinkedIn Selectors Configuration
 *
 * This file centralizes all CSS selectors used for scraping LinkedIn.
 * When LinkedIn changes their HTML structure, update selectors here.
 *
 * Each selector is an array - the scraper will try them in order (fallback strategy).
 */

export interface SelectorConfig {
  /** CSS selector string */
  selector: string
  /** Optional description of what this selector targets */
  description?: string
}

export interface SelectorGroup {
  /** Primary selectors to try first */
  primary: SelectorConfig[]
  /** Fallback selectors if primary fails */
  fallback?: SelectorConfig[]
}

/**
 * Profile name selectors
 */
export const NAME_SELECTORS: SelectorGroup = {
  primary: [
    { selector: 'h2.ddde811d._4c8db39c', description: 'New H2 name (2025+)' },
    { selector: 'main h2', description: 'Generic H2 in main' },
  ],
  fallback: [
    { selector: 'h1', description: 'Old H1 name (pre-2025)' },
    {
      selector: '[data-view-name*="profile-top-card"] h2',
      description: 'Top card H2',
    },
  ],
}

/**
 * Location selectors
 */
export const LOCATION_SELECTORS: SelectorGroup = {
  primary: [
    { selector: '.text-body-small', description: 'Generic small text' },
    {
      selector: 'main p.ddde811d._19ee2a11',
      description: 'New location class',
    },
  ],
  fallback: [
    {
      selector: '.text-body-small.inline.t-black--light.break-words',
      description: 'Old location class',
    },
    { selector: '.pv-top-card--list-bullet', description: 'Legacy location' },
  ],
}

/**
 * About section selectors
 */
export const ABOUT_SELECTORS: SelectorGroup = {
  primary: [
    {
      selector: '[data-view-name="profile-card-about"]',
      description: 'Specific about card',
    },
    {
      selector: '[data-testid="expandable-text-box"]',
      description: 'Expandable text content',
    },
  ],
  fallback: [
    {
      selector: '[data-view-name="profile-card"]',
      description: 'Generic profile card',
    },
    {
      selector: 'span[aria-hidden="true"]',
      description: 'Old aria-hidden span',
    },
  ],
}

/**
 * Experience section selectors
 */
export const EXPERIENCE_SELECTORS: SelectorGroup = {
  primary: [
    {
      selector: 'h2:has-text("Experience")',
      description: 'Experience heading',
    },
    {
      selector: '[data-view-name="profile-card-experience"]',
      description: 'Experience card',
    },
    { selector: 'main ul > li', description: 'Modern semantic list items' },
  ],
  fallback: [
    { selector: '.pvs-list__container', description: 'Old list container' },
    { selector: '.pvs-list__paged-list-item', description: 'Old list items' },
  ],
}

/**
 * Education section selectors
 */
export const EDUCATION_SELECTORS: SelectorGroup = {
  primary: [
    { selector: 'h2:has-text("Education")', description: 'Education heading' },
    {
      selector: '[data-view-name="profile-card-education"]',
      description: 'Education card',
    },
    { selector: 'main ul > li', description: 'Modern semantic list items' },
  ],
  fallback: [
    { selector: '.pvs-list__container', description: 'Old list container' },
    { selector: '.pvs-list__paged-list-item', description: 'Old list items' },
  ],
}

/**
 * Profile picture selectors (for open to work badge)
 */
export const PROFILE_PICTURE_SELECTORS: SelectorGroup = {
  primary: [
    {
      selector: '.pv-top-card-profile-picture img',
      description: 'Profile image',
    },
  ],
  fallback: [
    { selector: 'img[alt*="profile picture"]', description: 'Alt text search' },
  ],
}

/**
 * Contact info selectors
 */
export const CONTACT_SELECTORS: SelectorGroup = {
  primary: [
    { selector: 'dialog', description: 'Native dialog element' },
    { selector: '[role="dialog"]', description: 'ARIA dialog' },
  ],
  fallback: [{ selector: '.artdeco-modal', description: 'Old modal class' }],
}

/**
 * Interest section selectors
 */
export const INTEREST_SELECTORS: SelectorGroup = {
  primary: [
    { selector: 'h2:has-text("Interests")', description: 'Interests heading' },
    { selector: '[role="tab"]', description: 'Tab elements' },
    { selector: '[role="tabpanel"]', description: 'Tab panel' },
  ],
  fallback: [
    { selector: 'tab', description: 'Old tab element' },
    { selector: 'tabpanel', description: 'Old tabpanel element' },
  ],
}

/**
 * Accomplishment section selectors
 */
export const ACCOMPLISHMENT_SELECTORS: SelectorGroup = {
  primary: [
    {
      selector: '.pvs-list__container, main ul, main ol',
      description: 'List containers',
    },
    { selector: 'span[aria-hidden="true"]', description: 'Hidden spans' },
  ],
  fallback: [
    { selector: '.pvs-list__paged-list-item', description: 'Old list items' },
  ],
}

/**
 * Data attribute selectors for profile cards
 */
export const PROFILE_CARD_DATA_ATTRIBUTES = {
  about: 'profile-card-about',
  experience: 'profile-card-experience',
  education: 'profile-card-education',
  skills: 'profile-card-skills',
  interests: 'profile-card-interests',
  accomplishments: 'profile-card-accomplishments',
  recommendations: 'profile-card-recommendations',
} as const

/**
 * Test ID selectors (more stable than classes)
 */
export const TEST_ID_SELECTORS = {
  expandableText: '[data-testid="expandable-text-box"]',
  expandableButton: '[data-testid="expandable-text-button"]',
} as const

/**
 * Waiting configurations
 */
export const WAIT_CONFIG = {
  /** Default timeout for element selection */
  defaultTimeout: 5000,
  /** Timeout for safe text extraction */
  textExtractionTimeout: 2000,
  /** Time to wait after navigation */
  postNavigationWait: 3000,
  /** Time to wait for focus */
  focusWait: 1000,
} as const
