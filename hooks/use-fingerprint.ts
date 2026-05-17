'use client'

import { useEffect, useState } from 'react'
import { getFingerprintWithCache } from '@/lib/fingerprint'

/**
 * デバイス fingerprint を非同期に収集するフック。
 * マウント時に fingerprint を取得し、成功したらステートにセットする。
 */
export function useFingerprint(): string | null {
  const [fingerprint, setFingerprint] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function collect() {
      const fp = await getFingerprintWithCache()
      if (!cancelled && fp) setFingerprint(fp)
    }
    collect()
    return () => {
      cancelled = true
    }
  }, [])

  return fingerprint
}
