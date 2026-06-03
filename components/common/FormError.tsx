/**
 * @module components/common/FormError
 */

interface FormErrorProps {
  message?: string | null
  className?: string
}

export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null

  return (
    <div
      className={`p-3 rounded-lg bg-destructive/10 text-destructive text-sm${className ? ` ${className}` : ''}`}
      role="alert"
    >
      {message}
    </div>
  )
}
