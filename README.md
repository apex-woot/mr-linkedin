# @apexwoot/mr-scraper

[![npm version](https://img.shields.io/npm/v/@apexwoot/mr-scraper.svg)](https://www.npmjs.com/package/@apexwoot/mr-scraper)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)

A high-performance LinkedIn person-profile scraper for **Bun + Node.js**. Built with **Playwright** and **Zod** for robust automation and type-safe data extraction.

## Features

- **Dual Runtime Support:** Optimized builds for both **Bun** and **Node.js** natively.
- **Data Extraction:** LinkedIn person profiles.
- **New Extraction Architecture:** `PageExtractor -> TextExtractor -> Parser` pipeline for resilient section parsing.

- **Type Safety:** Full TypeScript support with Zod-validated schemas.
- **Session Management:** Persist authentication via `storageState` to bypass logins.
- **Extensible:** Custom callbacks for real-time progress tracking (JSON, Multi, Console).

### 🚀 Improved Robustness

| Feature | Python Version | This Version |
| :--- | :---: | :---: |
| **Experience** | Basic | **Robust & Detailed** |
| **Patents** | Limited | **Full Extraction** |
| **Data Validation** | Pydantic | **Strict Zod Schemas** |
| **Concurrency** | Threading | **Modern Async/Await** |

## Session Persistence

To avoid repeated logins and bot detection, save and reuse your session state:

```typescript
// Save session
await loginWithCredentials(page, { email, password });
await browser.context.storageState({ path: 'state.json' });

// Reuse session
const browser = new BrowserManager({ storageState: 'state.json' });
await browser.start();
```

## Development

```bash
bun install    # Setup
bun test       # Run tests
bun run build  # Build dist
```

## Architecture

- `Page Extractors` locate section roots/items and handle navigation.
- `Text Extractors` pull normalized text/links from DOM elements.
- `Parsers` convert extracted text into typed person models.
- The orchestrator uses this pipeline for all person sections (top card, about, experience, education, patents, interests, accomplishments, contacts).

## Roadmap / TODO

- [x] High-performance Bun + Playwright core
- [x] Robust extraction across person sections (Experience, Education, Patents, Interests, Accomplishments, Contacts, Top card, About)
- [ ] Proxy support integration
- [ ] LinkedIn Messaging scraping support
- [ ] Recruiter-specific data points
- [ ] Automated CAPTCHA solving hooks

---

*Disclaimer: This tool is for educational purposes only. Users are responsible for complying with LinkedIn's Terms of Service.*

<small>TypeScript port of [linkedin_scraper](https://github.com/joeyism/linkedin_scraper) by [joeyism](https://github.com/joeyism) done mostly by AI.</small>
