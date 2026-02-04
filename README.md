# LinkedIn Scraper (TypeScript)

> [!WARNING]
> This project is a TypeScript port of the original [linkedin_scraper](https://github.com/joeyism/linkedin_scraper) by [joeyism](https://github.com/joeyism) using AI. While I will be maintaining and improving this project mostly by myself, I will continue to utilize AI to assist in development and updates.

A high-performance LinkedIn scraper ported from Python to **Bun + TypeScript**, utilizing **Playwright** for browser automation and **Zod** for data validation.

Kudos to the original author for the excellent work on the Python version.

## Features

- **Person Profile Scraper:** Extract full profile details, including experiences, education, interests, and accomplishments.
- **Company Scraper:** Scrape company details, overview, and website info.
- **Job Search Scraper:** Search for jobs and extract posting URLs.
- **Job Scraper:** Detailed job posting extraction.
- **Company Posts Scraper:** Extract recent posts from any company page.
- **Session Management:** Save and load cookies/storage state to bypass frequent logins.
- **Progress Tracking:** Real-time feedback via customizable callbacks (Console, JSON, Multi).

## Installation

```bash
bun install
```

## Quick Start

```typescript
import { BrowserManager, PersonScraper, ConsoleCallback } from "mr-linkedin";

const browser = new BrowserManager({ headless: false });
await browser.start();

// Optional: Login
// await loginWithCredentials(browser.page, { email: "...", password: "..." });

const scraper = new PersonScraper({ 
  page: browser.page, 
  callback: new ConsoleCallback() 
});

const profile = await scraper.scrape("https://www.linkedin.com/in/williamhgates/");
console.log(profile.data.name);

await browser.close();
```

## Development

### Run Tests
```bash
bun test
```

### Type Check
```bash
bun x tsc --noEmit
```

## Standards

- **Strict Typing:** All data models validated via Zod.
- **Modern Async:** Full `async/await` implementation.
- **Playwright:** Robust browser automation replacing Selenium.
