type BodySizeDisplayProps = {
  minMm: number | null
  maxMm: number | null
}

/**
 * 害虫・益虫の体長を表示する。bodySizeMinMm / bodySizeMaxMm は Float? のため、
 * 両方 null の場合は何も表示しない。min と max が同値の場合は「約 N mm」と表示。
 */
export function BodySizeDisplay({ minMm, maxMm }: BodySizeDisplayProps) {
  if (minMm == null && maxMm == null) return null

  let sizeText: string
  if (minMm != null && maxMm != null && minMm === maxMm) {
    sizeText = `約 ${minMm} mm`
  } else if (minMm != null && maxMm != null) {
    sizeText = `${minMm}〜${maxMm} mm`
  } else if (minMm != null) {
    sizeText = `${minMm} mm 以上`
  } else {
    sizeText = `${maxMm} mm 以下`
  }

  return (
    <p className="text-sm text-muted-foreground mt-1">
      体長: {sizeText}
    </p>
  )
}
