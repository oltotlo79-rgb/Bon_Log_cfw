'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteBonsai } from '@/lib/actions/bonsai'
import { useToast } from '@/hooks/use-toast'
import { MSG_BONSAI_DELETE_FAILED } from '@/lib/constants/messages'
import { ROUTE_BONSAI } from '@/lib/constants/routes'
import { buildBonsaiEditPath } from '@/lib/constants/path-builders'

interface BonsaiActionsProps {
  bonsaiId: string
  bonsaiName: string
}

function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

export function BonsaiActions({ bonsaiId, bonsaiName }: BonsaiActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`「${bonsaiName}」を削除しますか？\n成長記録もすべて削除されます。`)) {
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteBonsai(bonsaiId)
      if (!result.success) {
        toast({ title: result.error, variant: 'destructive' })
      } else {
        router.push(ROUTE_BONSAI)
        router.refresh()
      }
    } catch {
      toast({ title: MSG_BONSAI_DELETE_FAILED, variant: 'destructive' })
    } finally {
      // アンマウント後は setState しない（テスト/ナビ後などの unhandled rejection 防止）
      if (mountedRef.current) {
        setIsDeleting(false)
        setIsOpen(false)
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-muted rounded-lg transition-colors"
        disabled={isDeleting}
        aria-label="メニュー"
        data-testid="bonsai-menu"
      >
        <MoreVerticalIcon className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-48 bg-card border rounded-lg shadow-lg z-50 py-1">
            <Link
              href={buildBonsaiEditPath(bonsaiId)}
              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <PencilIcon className="w-4 h-4" />
              編集
            </Link>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
              {isDeleting ? '削除中...' : '削除'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
