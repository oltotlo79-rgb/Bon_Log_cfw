/**
 * @module components/user/HeaderUploader
 */

'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { prepareFileForUpload } from '@/lib/client-image-compression'
import {
  HEADER_COMPRESSION_MAX_SIZE_MB,
  HEADER_MAX_DIMENSION,
  HEADER_RECOMMENDED_WIDTH,
  HEADER_RECOMMENDED_HEIGHT,
  MAX_IMAGE_SIZE_MB,
} from '@/lib/constants/limits'
import { Camera as CameraIcon } from 'lucide-react'

type HeaderUploaderProps = {
  currentUrl: string | null
}

export function HeaderUploader({ currentUrl }: HeaderUploaderProps) {

  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') setPreview(reader.result)
    }
    reader.readAsDataURL(file)

    handleUpload(file)
  }

  async function handleUpload(file: File) {
    setLoading(true)
    setError(null)

    try {
      const compressedFile = await prepareFileForUpload(file, {
        maxSizeMB: HEADER_COMPRESSION_MAX_SIZE_MB,
        maxWidthOrHeight: HEADER_MAX_DIMENSION,
      })

      const formData = new FormData()
      formData.append('file', compressedFile)

      const response = await fetch('/api/upload/header', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        setError(result.error || 'アップロードに失敗しました')
        setPreview(currentUrl)
      } else {
        router.refresh()
      }
    } catch {
      setError('アップロードに失敗しました')
      setPreview(currentUrl)
    }

    setLoading(false)
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        className="relative h-32 rounded-lg bg-muted overflow-hidden cursor-pointer group"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <Image
            src={preview}
            alt="ヘッダー画像"
            fill
            sizes="(max-width: 640px) 100vw, 640px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <CameraIcon className="w-8 h-8" />
          </div>
        )}

        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {loading ? (
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Button variant="secondary" size="sm">
              <CameraIcon className="w-4 h-4 mr-2" />
              変更する
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}

      <p className="text-xs text-muted-foreground mt-2">
        JPEG、PNG、WebP形式（{MAX_IMAGE_SIZE_MB}MB以下）、推奨サイズ: {HEADER_RECOMMENDED_WIDTH}x{HEADER_RECOMMENDED_HEIGHT}px
      </p>
    </div>
  )
}
