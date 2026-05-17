'use client'

import { Textarea } from '@/components/ui/textarea'
import { MediaPreviewGrid } from '../MediaPreviewGrid'
import type { MediaFile } from '../hooks/useMediaUpload'

type ContentInputSectionProps = {
  content: string
  onChange: (v: string) => void
  maxLength: number
  mediaFiles: MediaFile[]
  onMediaRemove: (idx: number) => void
  uploading?: boolean
  placeholder?: string
  rows?: number
  className?: string
  autoFocus?: boolean
  'data-testid'?: string
}

/**
 * テキスト入力エリア + メディアプレビュー表示
 *
 * stateなし（純粋な表示コンポーネント）
 */
export function ContentInputSection({
  content,
  onChange,
  maxLength,
  mediaFiles,
  onMediaRemove,
  uploading = false,
  placeholder,
  rows,
  className,
  autoFocus,
  'data-testid': dataTestId,
}: ContentInputSectionProps) {
  return (
    <>
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className={className}
        data-testid={dataTestId}
      />
      <MediaPreviewGrid
        mediaFiles={mediaFiles}
        onRemove={onMediaRemove}
        uploading={uploading}
      />
    </>
  )
}
