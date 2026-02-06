import type { Page } from 'playwright'
import { AboutPageExtractor } from '../../extraction/page-extractors'
import { AboutParser } from '../../extraction/parsers'
import { ExtractionPipeline } from '../../extraction/pipeline'
import { AriaTextExtractor, RawTextExtractor, SemanticTextExtractor } from '../../extraction/text-extractors'
import { log } from '../../utils/logger'
import { getAttributeSafe } from '../utils'
import { extractTopCardFromPage } from './top-card'

export interface TopCardProfileInfo {
  name: string
  location: string | null
  headline: string | null
  origin: string | null
}

export async function getTopCardProfileInfo(page: Page): Promise<TopCardProfileInfo> {
  try {
    const topCardInfo = await extractTopCardFromPage(page)

    return {
      name: topCardInfo.name,
      location: topCardInfo.origin,
      headline: topCardInfo.headline,
      origin: topCardInfo.origin,
    }
  } catch (e) {
    log.warning(`Error getting name/location: ${e}`)
    return { name: 'Unknown', location: null, headline: null, origin: null }
  }
}

export async function checkOpenToWork(page: Page): Promise<boolean> {
  try {
    const imgTitle = await getAttributeSafe(page, '.pv-top-card-profile-picture img', 'title', '')
    return imgTitle.toUpperCase().includes('#OPEN_TO_WORK')
  } catch {
    return false
  }
}

export async function getAbout(page: Page): Promise<string | null> {
  try {
    const pipeline = new ExtractionPipeline<string>({
      pageExtractor: new AboutPageExtractor(),
      textExtractors: [new AriaTextExtractor(), new SemanticTextExtractor(), new RawTextExtractor()],
      parser: new AboutParser(),
      confidenceThreshold: 0.1,
      captureHtmlOnFailure: true,
    })

    const result = await pipeline.extract({
      page,
      baseUrl: page.url(),
    })
    return result.items[0] ?? null
  } catch (e) {
    log.debug(`Error getting about section: ${e}`)
    return null
  }
}
