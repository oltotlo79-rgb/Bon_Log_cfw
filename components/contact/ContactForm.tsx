'use client'

/**
 * @module components/contact/ContactForm
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { submitContactInquiry } from '@/lib/actions/contact'
import { MAX_NAME_LENGTH, MAX_EMAIL_LENGTH, MAX_SUBJECT_LENGTH, MAX_CONTACT_MESSAGE_LENGTH, MIN_CONTACT_MESSAGE_LENGTH } from '@/lib/constants/limits'
import { FormError } from '@/components/common/FormError'
import {
  MSG_CONTACT_CATEGORY_REQUIRED,
  MSG_CONTACT_EMAIL_INVALID,
  MSG_CONTACT_EMAIL_REQUIRED,
  MSG_CONTACT_MESSAGE_MIN_LENGTH,
  MSG_CONTACT_MESSAGE_REQUIRED,
  MSG_CONTACT_NAME_REQUIRED,
  MSG_CONTACT_SEND_FAILED,
  MSG_CONTACT_SUBJECT_REQUIRED,
  MSG_ERROR_FALLBACK,
} from '@/lib/constants/messages'
import { CONTACT_CATEGORIES } from '@/lib/constants/contact-categories'

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: '',
    subject: '',
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError(MSG_CONTACT_NAME_REQUIRED)
      return
    }
    if (!formData.email.trim()) {
      setError(MSG_CONTACT_EMAIL_REQUIRED)
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError(MSG_CONTACT_EMAIL_INVALID)
      return
    }
    if (!formData.category) {
      setError(MSG_CONTACT_CATEGORY_REQUIRED)
      return
    }
    if (!formData.subject.trim()) {
      setError(MSG_CONTACT_SUBJECT_REQUIRED)
      return
    }
    if (!formData.message.trim()) {
      setError(MSG_CONTACT_MESSAGE_REQUIRED)
      return
    }
    if (formData.message.length < MIN_CONTACT_MESSAGE_LENGTH) {
      setError(MSG_CONTACT_MESSAGE_MIN_LENGTH(MIN_CONTACT_MESSAGE_LENGTH))
      return
    }

    setIsSubmitting(true)

    try {
      const result = await submitContactInquiry(formData)

      if ('error' in result && result.error) {
        setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      } else {
        setIsSubmitted(true)
      }
    } catch {
      setError(MSG_CONTACT_SEND_FAILED)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleCategoryChange = (value: string) => {
    setFormData(prev => ({ ...prev, category: value }))
    setError(null)
  }

  // 送信完了表示
  if (isSubmitted) {
    return (
      <div className="rounded-lg bg-muted/50 p-6 text-center">
        <div className="mb-4 flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-12 w-12 text-foreground"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          お問い合わせを受け付けました
        </h3>
        <p className="text-sm text-foreground">
          ご入力いただいたメールアドレスに確認メールをお送りしました。
          <br />
          回答まで2〜3営業日程度お時間をいただく場合がございます。
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            setIsSubmitted(false)
            setFormData({
              name: '',
              email: '',
              category: '',
              subject: '',
              message: '',
            })
          }}
        >
          新しいお問い合わせ
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormError message={error} />

      <div className="space-y-2">
        <Label htmlFor="name">
          お名前 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="山田 太郎"
          value={formData.name}
          onChange={handleChange}
          disabled={isSubmitting}
          maxLength={MAX_NAME_LENGTH}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">
          メールアドレス <span className="text-destructive">*</span>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="example@email.com"
          value={formData.email}
          onChange={handleChange}
          disabled={isSubmitting}
          maxLength={MAX_EMAIL_LENGTH}
        />
        <p className="text-xs text-muted-foreground">
          回答をお送りするメールアドレスを入力してください
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">
          カテゴリ <span className="text-destructive">*</span>
        </Label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          disabled={isSubmitting}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">カテゴリを選択</option>
          {CONTACT_CATEGORIES.map(category => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">
          件名 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="subject"
          name="subject"
          type="text"
          placeholder="お問い合わせの件名"
          value={formData.subject}
          onChange={handleChange}
          disabled={isSubmitting}
          maxLength={MAX_SUBJECT_LENGTH}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">
          お問い合わせ内容 <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="message"
          name="message"
          placeholder="お問い合わせ内容を詳しくお書きください"
          value={formData.message}
          onChange={handleChange}
          disabled={isSubmitting}
          rows={6}
          maxLength={MAX_CONTACT_MESSAGE_LENGTH}
        />
        <p className="text-xs text-muted-foreground">
          {formData.message.length} / {MAX_CONTACT_MESSAGE_LENGTH}文字
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            送信中...
          </>
        ) : (
          '送信する'
        )}
      </Button>
    </form>
  )
}
