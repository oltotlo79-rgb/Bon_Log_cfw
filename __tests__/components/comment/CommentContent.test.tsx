import { render, screen } from '../../utils/test-utils'
import { CommentContent } from '@/components/comment/CommentContent'

describe('CommentContent', () => {
  it('テキストコンテンツを表示する', () => {
    render(<CommentContent content="これはテストコメントです" />)
    expect(screen.getByText('これはテストコメントです')).toBeInTheDocument()
  })

  it('コンテンツが空の場合は何も表示しない', () => {
    const { container } = render(<CommentContent content="" />)
    expect(container.querySelector('p')).not.toBeInTheDocument()
  })

  it('メンションをリンクとして表示する', () => {
    const mentionUsers = new Map([
      ['user123', { id: 'user123', nickname: 'john', avatarUrl: null }],
    ])
    render(
      <CommentContent
        content="Hello <@user123> さん！"
        mentionUsers={mentionUsers}
      />
    )
    const link = screen.getByText('@john')
    expect(link.closest('a')).toHaveAttribute('href', '/users/user123')
  })

  it('存在しないメンションは@unknownと表示する', () => {
    const mentionUsers = new Map<string, { id: string; nickname: string; avatarUrl: string | null }>()
    render(
      <CommentContent
        content="Hello <@nonexistent> さん！"
        mentionUsers={mentionUsers}
      />
    )
    expect(screen.getByText('@unknown')).toBeInTheDocument()
  })

  it('mentionUsersが未指定でもメンションを表示する', () => {
    render(<CommentContent content="Hello <@user1> さん！" />)
    expect(screen.getByText('@unknown')).toBeInTheDocument()
  })

  it('ハッシュタグをリンクとして表示する', () => {
    render(<CommentContent content="盆栽について #盆栽 のタグ" />)
    const link = screen.getByText('#盆栽')
    expect(link.closest('a')).toHaveAttribute('href', '/search?q=%23%E7%9B%86%E6%A0%BD')
  })

  it('画像メディアを表示する', () => {
    const media = [{ id: 'm1', url: '/test-image.jpg', type: 'image', sortOrder: 0 }]
    render(<CommentContent content="テスト" media={media} />)
    const img = document.querySelector('img[src="/test-image.jpg"]')
    expect(img).toBeInTheDocument()
  })

  it('動画メディアを表示する', () => {
    const media = [{ id: 'm1', url: '/test-video.mp4', type: 'video', sortOrder: 0 }]
    render(<CommentContent content="テスト" media={media} />)
    const video = document.querySelector('video[src="/test-video.mp4"]')
    expect(video).toBeInTheDocument()
  })

  it('メディアが複数ある場合にgrid-cols-2クラスを適用する', () => {
    const media = [
      { id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
      { id: 'm2', url: '/img2.jpg', type: 'image', sortOrder: 1 },
    ]
    const { container } = render(<CommentContent content="テスト" media={media} />)
    expect(container.querySelector('.grid-cols-2')).toBeInTheDocument()
  })

  it('メディアが1枚の場合にgrid-cols-2クラスを適用しない', () => {
    const media = [{ id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 }]
    const { container } = render(<CommentContent content="テスト" media={media} />)
    expect(container.querySelector('.grid-cols-2')).not.toBeInTheDocument()
  })

  it('画像1枚の場合はsizes属性がフル幅想定になる', () => {
    const media = [{ id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 }]
    render(<CommentContent content="テスト" media={media} />)
    const img = document.querySelector('img[src="/img1.jpg"]')
    expect(img).toHaveAttribute('sizes', '(max-width: 768px) 100vw, 600px')
  })

  it('画像複数枚の場合はsizes属性がグリッド想定になる', () => {
    const media = [
      { id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
      { id: 'm2', url: '/img2.jpg', type: 'image', sortOrder: 1 },
    ]
    render(<CommentContent content="テスト" media={media} />)
    const img1 = document.querySelector('img[src="/img1.jpg"]')
    const img2 = document.querySelector('img[src="/img2.jpg"]')
    expect(img1).toHaveAttribute('sizes', '(max-width: 768px) 50vw, 300px')
    expect(img2).toHaveAttribute('sizes', '(max-width: 768px) 50vw, 300px')
  })

  it('メディアなしの場合はグリッドを表示しない', () => {
    const { container } = render(<CommentContent content="テスト" />)
    expect(container.querySelector('.grid')).not.toBeInTheDocument()
  })

  it('メンションとハッシュタグが混在するコンテンツを正しく表示する', () => {
    const mentionUsers = new Map([
      ['user1', { id: 'user1', nickname: 'alice', avatarUrl: null }],
    ])
    render(
      <CommentContent
        content="<@user1> が #盆栽 について投稿"
        mentionUsers={mentionUsers}
      />
    )
    expect(screen.getByText('@alice')).toBeInTheDocument()
    expect(screen.getByText('#盆栽')).toBeInTheDocument()
  })
})
