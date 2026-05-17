import { render, screen } from '@testing-library/react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

describe('Avatar', () => {
  describe('Avatar (ルートコンポーネント)', () => {
    it('子要素を表示する', () => {
      render(
        <Avatar>
          <span>テスト子要素</span>
        </Avatar>
      )

      expect(screen.getByText('テスト子要素')).toBeInTheDocument()
    })

    it('data-slot="avatar"を設定する', () => {
      render(
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
      )

      expect(screen.getByText('A').parentElement).toHaveAttribute('data-slot', 'avatar')
    })

    it('カスタムclassNameをマージする', () => {
      render(
        <Avatar className="custom-class">
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
      )

      const avatar = screen.getByText('A').parentElement
      expect(avatar).toHaveClass('custom-class')
    })

    it('追加のpropsを転送する', () => {
      render(
        <Avatar data-testid="my-avatar">
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
      )

      expect(screen.getByTestId('my-avatar')).toBeInTheDocument()
    })
  })

  describe('AvatarFallback', () => {
    it('テキストをフォールバックとして表示する', () => {
      render(
        <Avatar>
          <AvatarFallback>UN</AvatarFallback>
        </Avatar>
      )

      expect(screen.getByText('UN')).toBeInTheDocument()
    })

    it('data-slot="avatar-fallback"を設定する', () => {
      render(
        <Avatar>
          <AvatarFallback>田中</AvatarFallback>
        </Avatar>
      )

      expect(screen.getByText('田中')).toHaveAttribute('data-slot', 'avatar-fallback')
    })

    it('カスタムclassNameをマージする', () => {
      render(
        <Avatar>
          <AvatarFallback className="custom-fallback">FB</AvatarFallback>
        </Avatar>
      )

      expect(screen.getByText('FB')).toHaveClass('custom-fallback')
    })

    it('アイコン要素をフォールバックとして表示する', () => {
      render(
        <Avatar>
          <AvatarFallback>
            <svg role="img" aria-label="ユーザーアイコン" />
          </AvatarFallback>
        </Avatar>
      )

      expect(screen.getByRole('img', { name: 'ユーザーアイコン' })).toBeInTheDocument()
    })

    it('userIdが指定された場合、円相アバター画像を表示する', () => {
      render(
        <Avatar>
          <AvatarFallback userId="test-user-123">無視される</AvatarFallback>
        </Avatar>
      )

      const img = screen.getByRole('img', { name: 'デフォルトアバター' })
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', expect.stringContaining('/images/generated/avatars/enso-avatar-'))
    })

    it('userIdが未指定の場合、childrenを表示する', () => {
      render(
        <Avatar>
          <AvatarFallback>YT</AvatarFallback>
        </Avatar>
      )

      expect(screen.getByText('YT')).toBeInTheDocument()
      expect(screen.queryByRole('img', { name: 'デフォルトアバター' })).not.toBeInTheDocument()
    })
  })

  describe('AvatarImage', () => {
    // Note: Radix UIのAvatarImageは画像読み込み完了までDOMに挿入されない。
    // JSDOM環境では画像読み込みイベントが発火しないため、
    // AvatarImageの存在はAvatarコンテナ内での構成テストで間接的に確認する。

    it('画像読み込み前はフォールバックのみ表示される', () => {
      render(
        <Avatar>
          <AvatarImage src="/user.jpg" alt="ユーザー画像" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      )

      // 画像はまだ表示されていない（Radix UIの仕様）
      expect(screen.queryByRole('img', { name: 'ユーザー画像' })).not.toBeInTheDocument()
      // フォールバックが代わりに表示される
      expect(screen.getByText('U')).toBeInTheDocument()
    })
  })

  describe('完全な構成', () => {
    it('画像読み込み前にフォールバックが表示される', () => {
      render(
        <Avatar>
          <AvatarImage src="/user.jpg" alt="ユーザー" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      )

      expect(screen.getByText('U')).toBeInTheDocument()
    })

    it('AvatarとAvatarFallbackが正しいdata-slot属性を持つ', () => {
      const { container } = render(
        <Avatar>
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      )

      expect(container.querySelector('[data-slot="avatar"]')).toBeInTheDocument()
      expect(container.querySelector('[data-slot="avatar-fallback"]')).toBeInTheDocument()
    })

    it('AvatarとAvatarFallbackにpropsを転送する', () => {
      render(
        <Avatar data-testid="avatar-root">
          <AvatarFallback data-testid="avatar-fb">U</AvatarFallback>
        </Avatar>
      )

      expect(screen.getByTestId('avatar-root')).toBeInTheDocument()
      expect(screen.getByTestId('avatar-fb')).toBeInTheDocument()
    })
  })
})
