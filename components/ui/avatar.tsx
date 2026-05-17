/**
 * Radix UI Avatar の薄いラッパ。
 * `AvatarFallback` に `userId` を渡すと、画像読み込み失敗時に円相プレースホルダを表示する。
 */
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { getDefaultAvatarPath } from "@/lib/utils/avatar"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  userId,
  children,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback> & {
  userId?: string
}) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    >
      {userId ? (
        <Image
          src={getDefaultAvatarPath(userId)}
          alt="デフォルトアバター"
          fill
          sizes="64px"
          className="object-cover"
        />
      ) : (
        children
      )}
    </AvatarPrimitive.Fallback>
  )
}

export { Avatar, AvatarImage, AvatarFallback }
