import type { ResistanceRisk } from '@prisma/client'

export const VALID_PESTICIDE_TYPES = ['fungicide', 'insecticide', 'acaricide', 'compound', 'other'] as const
export type ValidPesticideType = (typeof VALID_PESTICIDE_TYPES)[number]

function isValidPesticideType(value: string): value is ValidPesticideType {
  return (VALID_PESTICIDE_TYPES as readonly string[]).includes(value)
}

/** レガシー type パラメータ（herbicide 等）を有効な PesticideType に正規化 */
export function normalizePesticideType(type: string | undefined): ValidPesticideType | undefined {
  if (!type) return undefined
  if (type === 'herbicide') return 'other'
  return isValidPesticideType(type) ? type : undefined
}

const MAFF_PESTICIDE_BASE_URL = 'https://pesticide.maff.go.jp/agricultural-chemicals/details'

export function getMaffUrl(registrationNumber: string): string {
  return `${MAFF_PESTICIDE_BASE_URL}/${registrationNumber}`
}

/** 耐性のつきやすさの表示ラベル */
export const RESISTANCE_RISK_LABELS: Record<ResistanceRisk, string> = {
  low: 'つきにくい',
  medium: 'ややつきやすい',
  high: 'つきやすい',
} as const

/** 耐性リスクの比較用数値マップ（high = 3 が最大）*/
export const RESISTANCE_RISK_ORDER: Record<ResistanceRisk, number> = {
  high: 3,
  medium: 2,
  low: 1,
} as const

export function getResistanceRiskLabel(risk: ResistanceRisk | null | undefined): string | null {
  if (risk == null) return null
  return RESISTANCE_RISK_LABELS[risk] ?? null
}
