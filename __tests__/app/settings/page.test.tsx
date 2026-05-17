import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SettingsPage from '@/app/(main)/settings/page'
import { GUEST_EMAIL } from '@/lib/constants/guest'

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('@/components/theme/ThemeToggle', () => ({
  ThemeSelect: () => <div data-testid="theme-select">テーマ選択</div>,
}))

vi.mock('@/components/settings/SakuraPetalsToggle', () => ({
  BgAnimationSelect: () => <div data-testid="bg-animation-select">花びら</div>,
}))

vi.mock('@/components/weather/WeatherLocationSetting', () => ({
  WeatherLocationSetting: () => (
    <div data-testid="weather-location-setting">天気設定</div>
  ),
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'user@example.com' } })
  })

  it('設定ページタイトルが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('プロフィール編集リンクが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('プロフィール編集')).toBeInTheDocument()
    expect(screen.getByText('ニックネーム、自己紹介、プロフィール画像などを編集')).toBeInTheDocument()
  })

  it('通知設定リンクが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('通知設定')).toBeInTheDocument()
    expect(screen.getByText('通知の種類ごとにON/OFFを設定')).toBeInTheDocument()
  })

  it('アカウント設定リンクが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('アカウント設定')).toBeInTheDocument()
    expect(screen.getByText('公開設定、アカウント削除など')).toBeInTheDocument()
  })

  it('セキュリティ設定リンクが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('セキュリティ設定')).toBeInTheDocument()
    expect(screen.getByText('2段階認証、パスワード管理など')).toBeInTheDocument()
  })

  it('フォローリクエストリンクが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('フォローリクエスト')).toBeInTheDocument()
    expect(screen.getByText('受信したフォローリクエストの確認・承認')).toBeInTheDocument()
  })

  it('ブロック中のユーザーリンクが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('ブロック中のユーザー')).toBeInTheDocument()
    expect(screen.getByText('ブロック中のユーザー一覧とブロック解除')).toBeInTheDocument()
  })

  it('ミュート中のユーザーリンクが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('ミュート中のユーザー')).toBeInTheDocument()
    expect(screen.getByText('ミュート中のユーザー一覧とミュート解除')).toBeInTheDocument()
  })

  it('プラン管理リンクが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('プラン管理')).toBeInTheDocument()
    expect(screen.getByText('プレミアム会員への登録、支払い履歴の確認')).toBeInTheDocument()
  })

  it('表示設定セクションが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('表示設定')).toBeInTheDocument()
  })

  it('ThemeSelectコンポーネントがレンダリングされる', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByTestId('theme-select')).toBeInTheDocument()
  })

  it('プロフィール編集リンクが正しいhrefを持つ', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    const link = screen.getByRole('link', { name: /プロフィール編集/i })
    expect(link).toHaveAttribute('href', '/settings/profile')
  })

  it('通知設定リンクが正しいhrefを持つ', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    const link = screen.getByRole('link', { name: /通知設定/i })
    expect(link).toHaveAttribute('href', '/settings/notifications')
  })

  it('アカウント設定リンクが正しいhrefを持つ', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    const link = screen.getByRole('link', { name: /アカウント設定/i })
    expect(link).toHaveAttribute('href', '/settings/account')
  })

  it('セキュリティ設定リンクが正しいhrefを持つ', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    const link = screen.getByRole('link', { name: /セキュリティ設定/i })
    expect(link).toHaveAttribute('href', '/settings/security')
  })

  it('フォローリクエストリンクが正しいhrefを持つ', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    const link = screen.getByRole('link', { name: /フォローリクエスト/i })
    expect(link).toHaveAttribute('href', '/settings/follow-requests')
  })

  it('ブロック中のユーザーリンクが正しいhrefを持つ', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    const link = screen.getByRole('link', { name: /ブロック中のユーザー/i })
    expect(link).toHaveAttribute('href', '/settings/blocked')
  })

  it('ミュート中のユーザーリンクが正しいhrefを持つ', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    const link = screen.getByRole('link', { name: /ミュート中のユーザー/i })
    expect(link).toHaveAttribute('href', '/settings/muted')
  })

  it('プラン管理リンクが正しいhrefを持つ', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    const link = screen.getByRole('link', { name: /プラン管理/i })
    expect(link).toHaveAttribute('href', '/settings/subscription')
  })

  it('8つのリンクが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(8)
  })

  it('各メニューアイテムにアイコンが表示される', async () => {
    const jsx = await SettingsPage()
    const { container } = render(jsx)
    const svgs = container.querySelectorAll('svg')
    // 各メニューアイテム（8つ）のアイコン + 矢印アイコン（8つ）
    expect(svgs.length).toBeGreaterThanOrEqual(8)
  })

  it('天気アドバイスセクションが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('天気アドバイス')).toBeInTheDocument()
    expect(screen.getByTestId('weather-location-setting')).toBeInTheDocument()
  })
})

describe('SettingsPage（ゲストユーザー）', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'guest', email: GUEST_EMAIL } })
  })

  it('ゲスト案内メッセージが表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(
      screen.getByText(
        /ゲストは表示設定のみ変更できます。/,
      ),
    ).toBeInTheDocument()
  })

  it('表示設定セクションは引き続き表示される', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('表示設定')).toBeInTheDocument()
    expect(screen.getByTestId('theme-select')).toBeInTheDocument()
    expect(screen.getByTestId('bg-animation-select')).toBeInTheDocument()
  })

  it('メニュー項目はすべて表示される（非表示にしない）', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('プロフィール編集')).toBeInTheDocument()
    expect(screen.getByText('通知設定')).toBeInTheDocument()
    expect(screen.getByText('アカウント設定')).toBeInTheDocument()
    expect(screen.getByText('セキュリティ設定')).toBeInTheDocument()
    expect(screen.getByText('フォローリクエスト')).toBeInTheDocument()
    expect(screen.getByText('ブロック中のユーザー')).toBeInTheDocument()
    expect(screen.getByText('ミュート中のユーザー')).toBeInTheDocument()
    expect(screen.getByText('プラン管理')).toBeInTheDocument()
  })

  it('メニュー項目はリンクではなく aria-disabled な div として描画される', async () => {
    const jsx = await SettingsPage()
    const { container } = render(jsx)
    // ゲスト時は <a> 要素を一切生成しない（ナビゲーション経路を断つ）
    expect(container.querySelectorAll('a')).toHaveLength(0)
    // 8 つの行は role=link + aria-disabled で表現する
    const disabledLinks = screen.getAllByRole('link')
    expect(disabledLinks).toHaveLength(8)
    for (const el of disabledLinks) {
      expect(el).toHaveAttribute('aria-disabled', 'true')
      expect(el.tagName).toBe('DIV')
    }
  })

  it('天気アドバイスセクションは表示するが操作不可（data-disabled・WeatherLocationSetting は描画しない）', async () => {
    const jsx = await SettingsPage()
    render(jsx)
    expect(screen.getByText('天気アドバイス')).toBeInTheDocument()
    // WeatherLocationSetting（クライアント Server Action 呼出）はゲストでは描画しない
    expect(screen.queryByTestId('weather-location-setting')).not.toBeInTheDocument()
    // 案内文は表示する（表示はそのまま）
    expect(
      screen.getByText(
        /位置情報を登録すると、天気に基づく盆栽管理アドバイスがタイムラインに表示されます/,
      ),
    ).toBeInTheDocument()
    // 視覚的・データ属性で disabled 状態を示す
    const section = screen.getByTestId('weather-advice-section')
    expect(section).toHaveAttribute('data-disabled', 'true')
    expect(section.className).toMatch(/opacity-50/)
  })
})
