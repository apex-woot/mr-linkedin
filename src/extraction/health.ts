import type { PipelineResult } from './pipeline'

export type HealthStatus = 'healthy' | 'degraded' | 'broken'

export interface HealthReport {
  section: string
  status: HealthStatus
  textExtractor: string | null
  confidence: number
  itemCount: number
  message: string
}

export interface HealthThresholds {
  healthyConfidence: number
  degradedConfidence: number
}

const DEFAULT_THRESHOLDS: HealthThresholds = {
  healthyConfidence: 0.65,
  degradedConfidence: 0.35,
}

export function buildHealthReport<T>(
  section: string,
  result: PipelineResult<T>,
  thresholds: Partial<HealthThresholds> = {},
): HealthReport {
  const effective = {
    ...DEFAULT_THRESHOLDS,
    ...thresholds,
  }

  const confidence = result.diagnostics.avgConfidence
  const status = computeStatus(confidence, result.items.length, effective)

  return {
    section,
    status,
    textExtractor: result.diagnostics.textExtractorUsed,
    confidence,
    itemCount: result.items.length,
    message: buildMessage(section, status, result),
  }
}

export function computeStatus(
  confidence: number,
  itemCount: number,
  thresholds: HealthThresholds,
): 'healthy' | 'degraded' | 'broken' {
  if (itemCount === 0 || confidence <= 0) return 'broken'
  if (confidence >= thresholds.healthyConfidence) return 'healthy'
  if (confidence >= thresholds.degradedConfidence) return 'degraded'
  return 'broken'
}

function buildMessage<T>(
  section: string,
  status: 'healthy' | 'degraded' | 'broken',
  result: PipelineResult<T>,
): string {
  const extractor = result.diagnostics.textExtractorUsed ?? 'none'
  const confidence = result.diagnostics.avgConfidence

  if (status === 'healthy') return `${section} extraction healthy using ${extractor}`

  if (status === 'degraded')
    return `${section} extraction degraded: ${result.items.length} items, confidence ${confidence.toFixed(2)}`

  return `${section} extraction broken: no reliable text extractor succeeded`
}
