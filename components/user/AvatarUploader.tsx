/**
 * @module components/user/AvatarUploader
 */

'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { prepareFileForUpload } from '@/lib/client-image-compression'
import { AVATAR_COMPRESSION_MAX_SIZE_MB, AVATAR_MAX_DIMENSION, MAX_IMAGE_SIZE_MB } from '@/lib/constants/limits'
import { Camera as CameraIcon } from 'lucide-react'

type AvatarUploaderProps = {
  currentUrl: string | null
  nickname: string
}

export function AvatarUploader({ currentUrl, nickname }: AvatarUploaderProps) {

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
        maxSizeMB: AVATAR_COMPRESSION_MAX_SIZE_MB,
        maxWidthOrHeight: AVATAR_MAX_DIMENSION,
      })

      const formData = new FormData()
      formData.append('file', compressedFile)

      const response = await fetch('/api/upload/avatar', {
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

      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 rounded-full bg-muted overflow-hidden">
          {preview ? (
            <Image
              src={preview}
              alt={nickname}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-muted-foreground">
              {nickname.charAt(0)}
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          <CameraIcon className="w-4 h-4 mr-2" />
          画像を変更
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}

      <p className="text-xs text-muted-foreground mt-2">
        JPEG、PNG、WebP形式（{MAX_IMAGE_SIZE_MB}MB以下）
      </p>
    </div>
  )
}
