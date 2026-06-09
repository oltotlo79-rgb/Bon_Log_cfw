'use client'

import { useState } from 'react'
import { TERM_DESCRIPTION_COLLAPSE_THRESHOLD } from '@/lib/constants/limits'

type TermDescriptionExpandedProps = {
  description: string
  collapseThreshold?: number
}

/**
 * 長文の説明文を折りたたんで表示する。
 * SEO クローラー向けに全文を DOM に含めつつ、max-height + overflow で視覚的に折りたたむ。
 * collapseThreshold 以下の場合は展開ボタンを出さず全文表示する。
 */
export function TermDescriptionExpanded({
  description,
  collapseThreshold = TERM_DESCRIPTION_COLLAPSE_THRESHOLD,
}: TermDescriptionExpandedProps) {
  const needsCollapse = description.length > collapseThreshold
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <div
        className={
          needsCollapse && !expanded
            ? 'max-h-36 overflow-hidden relative'
            : undefined
        }
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{description}</p>
        {needsCollapse && !expanded && (
          // グラデーションで文章の途切れを自然に見せる
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 text-sm text-primary hover:underline"
        >
          {expanded ? '折りたたむ' : '続きを読む'}
        </button>
      )}
    </div>
  )
}
