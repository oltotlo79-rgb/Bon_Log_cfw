import React from 'react'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'
import { ERR_GUEST_CANNOT_CREATE, ERR_GUEST_PROFILE_EDIT } from '@/lib/constants/errors'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('SettingsGuestRestriction', () => {
  it('タイトルとデフォルトメッセージ・新規登録リンクを表示する', () => {
    render(<SettingsGuestRestriction title="アカウント設定" />)

    expect(screen.getByText('アカウント設定')).toBeInTheDocument()
    expect(screen.getByText(ERR_GUEST_CANNOT_CREATE)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /設定に戻る/i })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: /新規登録する/i })).toHaveAttribute('href', '/register')
  })

  it('message を渡した場合はその文言を表示する', () => {
    render(
      <SettingsGuestRestriction title="プロフィール編集" message={ERR_GUEST_PROFILE_EDIT} />
    )

    expect(screen.getByText('プロフィール編集')).toBeInTheDocument()
    expect(screen.getByText(ERR_GUEST_PROFILE_EDIT)).toBeInTheDocument()
    expect(screen.queryByText(ERR_GUEST_CANNOT_CREATE)).not.toBeInTheDocument()
  })
})
