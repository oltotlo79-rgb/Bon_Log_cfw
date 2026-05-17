'use client'

import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Props = {
  imageUrl: string
  alt: string
  name?: string
  className?: string
}

/**
 * 病害虫画像のサムネイル。クリックで拡大表示（ライトボックス）する。
 */
export function DiseasePestImageLightbox({
  imageUrl,
  alt,
  name,
  className,
}: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'rounded-lg overflow-hidden shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            'cursor-zoom-in transition-opacity hover:opacity-90',
            className
          )}
          aria-label={`${alt}を大きく表示`}
        >
          <Image
            src={imageUrl}
            alt={alt}
            width={120}
            height={120}
            unoptimized
            className="rounded-lg object-cover w-[120px] h-[120px]"
          />
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-[min(90vw,640px)] p-2 sm:p-4 bg-black/95 border-border/50"
        showCloseButton={true}
      >
        <div className="relative flex items-center justify-center w-full" style={{ maxHeight: '85vh' }}>
          {/* 拡大画像: next/image の intrinsic レイアウトを使用し、max-h で85vhに制限する。
              width/height はアスペクト比のヒント。sizes は DialogContent の max-width 640px に合わせる。 */}
          <Image
            src={imageUrl}
            alt={alt}
            width={1280}
            height={1280}
            sizes="(max-width: 640px) 90vw, 640px"
            draggable={false}
            className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded"
          />
        </div>
        {name && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            {name}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
