/**
 * @module components/event/EventActionsDropdown
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buildEventEditPath } from '@/lib/constants/path-builders'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit, Trash2, Flag, Share } from 'lucide-react'

interface EventActionsDropdownProps {
  eventId: string
  isOwner: boolean
  onDelete?: () => void
  onReport?: () => void
}

export function EventActionsDropdown({
  eventId,
  isOwner,
  onDelete,
  onReport,
}: EventActionsDropdownProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        aria-label="イベント操作メニュー"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-48 bg-card border rounded-lg shadow-lg z-50"
          aria-label="イベント操作"
        >
          {isOwner ? (
            <>
              <Link
                href={buildEventEditPath(eventId)}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted w-full"
                onClick={() => setOpen(false)}
              >
                <Edit className="h-4 w-4" />
                編集
              </Link>
              <button
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted w-full text-left text-destructive"
                onClick={() => {
                  setOpen(false)
                  onDelete?.()
                }}
              >
                <Trash2 className="h-4 w-4" />
                削除
              </button>
            </>
          ) : (
            <button
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted w-full text-left"
              onClick={() => {
                setOpen(false)
                onReport?.()
              }}
            >
              <Flag className="h-4 w-4" />
              通報
            </button>
          )}
          <button
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted w-full text-left"
            onClick={() => {
              setOpen(false)
              navigator.clipboard.writeText(`${window.location.origin}/events/${eventId}`)
            }}
          >
            <Share className="h-4 w-4" />
            共有
          </button>
        </div>
      )}
    </div>
  )
}
