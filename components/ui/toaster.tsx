/**
 * @module components/ui/toaster
 */

'use client'

import { useToast } from '@/hooks/use-toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === 'destructive' ? 'alert' : 'status'}
          className={`
            rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-5
            ${toast.variant === 'destructive'
              ? 'bg-destructive/10 border-destructive/20 text-destructive'
              : 'bg-white border-gray-200 text-gray-900'
            }
          `}
        >
          {toast.title && (
            <p className="font-semibold text-sm">{toast.title}</p>
          )}
          {toast.description && (
            <p className="text-sm opacity-90">{toast.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}
