/**
 * @module components/common/KeyboardShortcutsProvider
 */

'use client'

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'

type KeyboardShortcutsProviderProps = {
  userId: string
}

export function KeyboardShortcutsProvider({ userId }: KeyboardShortcutsProviderProps) {
  const { showHelp, setShowHelp, gKeyPressed } = useKeyboardShortcuts({
    userId,
    onNewPost: () => {
      const composeButton = document.querySelector<HTMLButtonElement>('[data-compose-button]')
      if (composeButton) {
        composeButton.click()
      }
    },
  })

  return (
    <>
      <KeyboardShortcutsHelp
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {gKeyPressed && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-card border rounded-lg shadow-lg animate-fade-in"
          role="status"
          aria-live="polite"
        >
          <span className="text-sm text-muted-foreground">
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded">g</kbd>
            {' '}の後にキーを押してください...
          </span>
        </div>
      )}
    </>
  )
}
