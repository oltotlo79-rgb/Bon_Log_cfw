'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { addBonsaiRecord } from '@/lib/actions/bonsai'
import Image from 'next/image'
import { prepareFileForUpload, MAX_IMAGE_SIZE } from '@/lib/client-image-compression'
import { MAX_BONSAI_RECORD_IMAGES, DEFAULT_COMPRESSION_MAX_SIZE_MB, MAX_IMAGE_DIMENSION } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK, MSG_IMAGE_SIZE_LIMIT } from '@/lib/constants/messages'

interface BonsaiRecordFormProps {
  bonsaiId: string
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function BonsaiRecordForm({ bonsaiId }: BonsaiRecordFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const validFiles: File[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_IMAGE_SIZE) {
        setError(MSG_IMAGE_SIZE_LIMIT(MAX_IMAGE_SIZE / 1024 / 1024, file.size / 1024 / 1024, file.name))
        continue
      }
      validFiles.push(file)
    }

    const newImages = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))

    setImages((prev) => [...prev, ...newImages].slice(0, MAX_BONSAI_RECORD_IMAGES))

    // 同じファイルを再選択可能にするため input をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev]
      // BlobURLを解放（メモリリーク防止）
      const target = newImages[index]
      if (target) URL.revokeObjectURL(target.preview)
      newImages.splice(index, 1)
      return newImages
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!content.trim() && images.length === 0) {
      setError('テキストまたは画像を入力してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const imageUrls: string[] = []
      for (const image of images) {
        const compressedFile = await prepareFileForUpload(image.file, {
          maxSizeMB: DEFAULT_COMPRESSION_MAX_SIZE_MB,
          maxWidthOrHeight: MAX_IMAGE_DIMENSION,
        })

        const formData = new FormData()
        formData.append('file', compressedFile)

        const response = await fetch('/api/upload/avatar', {
          method: 'POST',
          body: formData,
        })
        const result = await response.json()
        if (result.url) {
          imageUrls.push(result.url)
        }
      }

      const result = await addBonsaiRecord({
        bonsaiId,
        content: content.trim() || undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      })

      if ('error' in result) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
        return
      }

      setContent('')
      setImages([])
      router.refresh()
    } catch {
      setError('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="成長の様子や作業内容を記録..."
        />
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          ※ここに記録した内容はタイムラインには投稿されません。タイムラインで任意のマイ盆栽を引用して投稿することで、タイムラインに投稿しつつマイ盆栽の記録にも残すことができます。
        </p>
      </div>

      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((image, index) => (
            <div key={index} className="relative w-20 h-20">
              <Image
                src={image.preview}
                alt={`画像 ${index + 1}`}
                fill
                className="object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
            id="record-images"
          />
          <label
            htmlFor="record-images"
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-muted transition-colors ${
              images.length >= MAX_BONSAI_RECORD_IMAGES ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <CameraIcon className="w-5 h-5" />
            <span className="text-sm">画像を追加</span>
          </label>
          <p className="text-xs text-muted-foreground mt-1">最大4枚まで</p>
        </div>

        <button
          type="submit"
          disabled={loading || (!content.trim() && images.length === 0)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? '保存中...' : '記録する'}
        </button>
      </div>
    </form>
  )
}
