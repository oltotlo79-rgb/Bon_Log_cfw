import { vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ============================================================
// Mocks（モック）
// ============================================================
// モックとは、実際のコンポーネントや機能を「ニセモノ」に置き換えることです。
// テストでは外部ライブラリに依存したくないので、簡略版を作ります。

/**
 * ルーター操作のモック関数群
 * - push: ページ遷移時に呼ばれる関数
 * - back: ブラウザの戻るボタン時に呼ばれる関数
 * - refresh: ページ再読み込み時に呼ばれる関数
 * vi.fn()は関数を追跡するもので、「何回呼ばれた？」「どんな引数だった？」などを確認できます
 */
const mockBack = vi.fn()
const mockPush = vi.fn()
const mockRefresh = vi.fn()

/**
 * next/navigation モックの設定
 *
 * WHY（なぜモックにするのか）:
 * - next/navigationは Next.js の特別なモジュールで、ブラウザ環境が必要
 * - テスト環境ではブラウザがないので、代わりに「ニセモノ」を作る
 *
 * HOW（どう動作するのか）:
 * - useRouter: コンポーネントが useRouter() を呼ぶと、push/back/refresh 関数を返す
 * - usePathname: 現在のパスを返す。このテストでは常に '/' を返す
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, refresh: mockRefresh }),
  usePathname: () => '/',
}))

/**
 * イベント操作の Server Actions モック
 *
 * WHY（なぜモックにするのか）:
 * - 実際の createEvent/updateEvent は データベースに保存する
 * - テスト時はデータベースを避けたい（テストが遅くなる、環境に依存する）
 *
 * HOW（どう動作するのか）:
 * - vi.fn() で空の関数を作成
 * - コンポーネントがこれらを呼び出すことはできるが、実際には何もしない
 */
vi.mock('@/lib/actions/event', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
}))

/**
 * Next.js の Image と Link コンポーネントをシンプルなHTML要素に置き換える
 *
 * WHY（なぜモックにするのか）:
 * - next/image は最適化処理が入っていて、テスト環境では不要
 * - next/link はリンク機能を持っているが、通常のaタグで十分
 *
 * HOW（どう動作するのか）:
 * - Image（next/image）→ <img> タグに置き換え（props をそのまま渡す）
 * - Link（next/link）→ <a> タグに置き換え（href 属性に href props を使う）
 */
vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../utils/mock-next-image')
  return { __esModule: true, default: MockNextImage }
})
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

/**
 * 投稿関連コンポーネントのモック
 *
 * WHY（なぜモックにするのか）:
 * - PostCard をテストしたいが、その中の子コンポーネントまでテストすると複雑になる
 * - 子コンポーネントの詳細な動作は別のテストで確認すればOK
 * - 親コンポーネントが「正しく子に props を渡しているか」だけ確認したい
 *
 * HOW（どう動作するのか）:
 * - data-testid を付けて、テストコード内で「このコンポーネントが描画されたか？」を確認できる
 * - DeletePostButton は onDeleted() を呼び出せるようにしている
 *   → テストで「削除ボタンクリック後、正しく動作するか」を検証できる
 * - ImageGallery は onMediaClick() を呼び出せるようにしている
 *   → テストで「画像クリック後、正しく動作するか」を検証できる
 */
vi.mock('@/components/post/LikeButton', () => ({
  LikeButton: () => <div data-testid="like-button" />,
}))
vi.mock('@/components/post/BookmarkButton', () => ({
  BookmarkButton: () => <div data-testid="bookmark-button" />,
}))
vi.mock('@/components/post/DeletePostButton', () => ({
  DeletePostButton: ({ onDeleted }: any) => <button data-testid="delete-button" onClick={onDeleted}>削除</button>,
}))
vi.mock('@/components/post/ImageGallery', () => ({
  ImageGallery: ({ onMediaClick }: any) => <div data-testid="image-gallery" onClick={onMediaClick} />,
}))
vi.mock('@/components/post/QuotedPost', () => ({
  QuotedPost: () => <div data-testid="quoted-post" />,
}))
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: () => <button data-testid="report-button">通報</button>,
}))

/**
 * メンション処理のモック
 *
 * WHY（なぜモックにするのか）:
 * - parseContentSegments は複雑な文字列解析処理
 * - PostCard がこの関数を「正しく呼び出しているか」だけ確認したい
 *
 * HOW（どう動作するのか）:
 * - 入力: "Hello #tag <@user1>" のような文字列
 * - 処理: '#' で始まる部分を hashtag、'<@' で始まる部分を mention として分類
 * - 出力: [
 *     { type: 'text', content: 'Hello ' },
 *     { type: 'hashtag', tag: '#tag' },
 *     { type: 'text', content: ' ' },
 *     { type: 'mention', userId: 'user1', display: '<@user1>' }
 *   ] のような配列
 */
vi.mock('@/lib/mention-utils', () => ({
  parseContentSegments: (content: string) => {
    const segments: any[] = []
    const parts = content.split(/(#\S+|<@\S+?>)/)
    for (const part of parts) {
      if (part.startsWith('#')) segments.push({ type: 'hashtag', tag: part })
      else if (part.startsWith('<@')) segments.push({ type: 'mention', userId: part.slice(2, -1), display: part })
      else if (part) segments.push({ type: 'text', content: part })
    }
    return segments
  },
}))

vi.mock('@/lib/actions/hide-post', () => ({ hidePost: vi.fn(), getHiddenPostIds: vi.fn() }))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))

// ============================================================
// Imports（モック設定後にインポート）
// ============================================================
// 重要: vi.mock() はファイルの上部に書かないと動作しません。
// インポートが実行される前にモックを設定する必要があります。

import { EventForm } from '@/components/event/EventForm'
import { PostCard } from '@/components/post/PostCard'

// ============================================================
// EventForm テスト
// ============================================================
/**
 * EventForm（イベント作成・編集フォーム）のテストグループ
 *
 * describe() は「関連するテストをグループ化する」ための関数です。
 * これにより、テスト結果を見やすく整理できます。
 */
describe('EventForm', () => {
  /**
   * beforeEach() は各テストケース実行前に走る関数
   *
   * WHY（なぜ必要か）:
   * - vi.fn() で作ったモック関数は、テスト間で状態が残る
   * - 例えば、テスト1で mockBack が呼ばれたら、
   *   テスト2で expect(mockBack).toHaveBeenCalledTimes(1) となってしまう
   * - これを防ぐため、各テスト前にモックをリセットする
   *
   * HOW（何をしているのか）:
   * - vi.clearAllMocks(): すべてのモック関数をリセット（呼び出し回数をゼロにする）
   */
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * テストケース1: オプション項目の入力変更ができることを確認
   *
   * WHAT（何をテストしているか）:
   * - EventForm が複数のオプションフィールドを持っており、
   *   各フィールドに値を入力してそれが保存されることを確認
   *
   * HOW（どのようにテストするか）:
   * 1. render(<EventForm />): コンポーネントを画面に描画する
   * 2. fireEvent.change(): ユーザーが入力フィールドに値を入力したのをシミュレート
   *    - fireEvent は「ユーザー操作をまねる」ための関数
   *    - change イベント = ユーザーが入力フィールドを変更した
   * 3. screen.getByLabelText(): label 属性の text から入力フィールドを探す
   *    - "終了日時" というラベルがついたフィールドを探す
   * 4. expect(...).toHaveValue(...): フィールドの値が期待通りか確認
   *
   * WHY（なぜこのテストが重要か）:
   * - フォームが「ユーザーの入力を受け付けて保存できる」かは基本機能
   * - これができないとフォーム自体が機能しない
   *
   * 各 fireEvent.change → expect は同じパターンで、
   * 異なるフィールドを8個テストしている
   */
  it('allows changing optional fields', () => {
    // Step1: コンポーネント描画
    render(<EventForm mode="create" />)

    // Step2-4: 終了日時フィールドのテスト
    fireEvent.change(screen.getByLabelText('終了日時'), { target: { value: '2026-02-01T10:00' } })
    expect(screen.getByLabelText('終了日時')).toHaveValue('2026-02-01T10:00')

    // 市区町村フィールドのテスト
    fireEvent.change(screen.getByLabelText('市区町村'), { target: { value: 'さいたま市' } })
    expect(screen.getByLabelText('市区町村')).toHaveValue('さいたま市')

    // 会場名フィールドのテスト
    fireEvent.change(screen.getByLabelText('会場名'), { target: { value: '盆栽美術館' } })
    expect(screen.getByLabelText('会場名')).toHaveValue('盆栽美術館')

    // 主催者フィールドのテスト
    fireEvent.change(screen.getByLabelText('主催者'), { target: { value: '盆栽協会' } })
    expect(screen.getByLabelText('主催者')).toHaveValue('盆栽協会')

    // 入場料フィールドのテスト
    fireEvent.change(screen.getByLabelText('入場料'), { target: { value: '500円' } })
    expect(screen.getByLabelText('入場料')).toHaveValue('500円')

    // チェックボックス（即売あり）のテスト
    fireEvent.click(screen.getByLabelText('即売あり'))
    expect(screen.getByLabelText('即売あり')).toBeChecked()

    // 詳細説明フィールドのテスト
    fireEvent.change(screen.getByLabelText('詳細説明'), { target: { value: 'テスト説明' } })
    expect(screen.getByLabelText('詳細説明')).toHaveValue('テスト説明')

    // 外部リンクフィールドのテスト
    fireEvent.change(screen.getByLabelText('外部リンク'), { target: { value: 'https://example.com' } })
    expect(screen.getByLabelText('外部リンク')).toHaveValue('https://example.com')
  })

  /**
   * テストケース2: キャンセルボタンをクリックすると前ページに戻ることを確認
   *
   * WHAT（何をテストしているか）:
   * - キャンセルボタンが正しく動作して、ブラウザの戻るボタン と同じ挙動をするか
   *
   * HOW（どのようにテストするか）:
   * 1. render(): コンポーネント描画
   * 2. fireEvent.click(): キャンセルボタンをクリック（ユーザー操作をシミュレート）
   * 3. expect(mockBack).toHaveBeenCalled():
   *    - mockBack は最初に vi.fn() で作ったモック関数
   *    - toHaveBeenCalled() は「この関数が呼ばれたか？」を確認
   *    - 呼ばれていれば テストOK
   *
   * WHY（なぜこのテストが重要か）:
   * - ユーザーが「キャンセル」を押したら前ページに戻る は基本的な UX
   * - これができないと、ユーザーがやり直したい時に困る
   */
  it('calls router.back() when cancel button is clicked', () => {
    render(<EventForm mode="create" />)
    fireEvent.click(screen.getByText('キャンセル'))
    expect(mockBack).toHaveBeenCalled()
  })

  /**
   * テストケース3: 作成モード（create）でボタンが "登録する" と表示されることを確認
   *
   * WHAT（何をテストしているか）:
   * - EventForm は「新規作成」と「編集」の2つのモードを持つ
   * - 新規作成モードの時は "登録する" と表示される
   *
   * HOW（どのようにテストするか）:
   * 1. render(<EventForm mode="create" />): 作成モードで描画
   * 2. expect(screen.getByText('登録する')).toBeInTheDocument():
   *    - "登録する" というテキストが画面に表示されているか確認
   *    - toBeInTheDocument() は「このテキストが存在するか？」を確認
   *
   * WHY（なぜこのテストが重要か）:
   * - モードによってボタン表示を変えるのは重要な UX
   * - 間違ったテキストが表示されると ユーザーが混乱する
   */
  it('shows "登録する" in create mode', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByText('登録する')).toBeInTheDocument()
  })

  /**
   * テストケース4: 編集モード（edit）でボタンが "更新する" と表示されることを確認
   *
   * WHAT（何をテストしているか）:
   * - EventForm の編集モードで "更新する" というボタンが表示される
   *
   * HOW（どのようにテストするか）:
   * 1. render(<EventForm mode="edit" initialData={{...}}/>):
   *    - 編集モードで描画
   *    - initialData には既存データを渡す（編集画面では既存データを表示する必要があるため）
   * 2. expect(screen.getByText('更新する')).toBeInTheDocument():
   *    - "更新する" というテキストが画面に存在するか確認
   *
   * WHY（なぜこのテストが重要か）:
   * - 新規作成と編集で異なるボタンテキストを表示することで、ユーザーが
   *   「今、新規作成しているのか、編集しているのか」を区別できる
   */
  it('shows "更新する" in edit mode', () => {
    render(
      <EventForm
        mode="edit"
        initialData={{
          id: 'evt1',
          title: 'テスト',
          startDate: new Date('2026-02-01T10:00'),
          endDate: null,
          prefecture: '東京都',
          city: null,
          venue: null,
          organizer: null,
          fee: null,
          hasSales: false,
          description: null,
          externalUrl: null,
        }}
      />
    )
    expect(screen.getByText('更新する')).toBeInTheDocument()
  })
})

// ============================================================
// PostCard テスト
// ============================================================

/**
 * makePost() ヘルパー関数
 *
 * WHAT（何か）:
 * - テストで使う「ダミー投稿データ」を作る関数
 *
 * WHY（なぜ必要か）:
 * - PostCard をテストするには、投稿データが必要
 * - 毎回手書きで投稿データを作ると、コードが長くなり、間違いが増える
 * - すべてのテストで「基本的な投稿データ」は同じなので、共通化するのが効率的
 *
 * HOW（どう動作するか）:
 * - デフォルトの投稿データを定義
 * - overrides パラメータで「特定のテストだけ異なるデータ」を指定できる
 * - スプレッド演算子 (...) で overrides の値がデフォルト値を上書き
 *
 * 例：
 * makePost() → すべてデフォルト値の投稿
 * makePost({ content: 'Hello' }) → content だけ 'Hello' に変更した投稿
 * makePost({ likeCount: 100, genres: [{ id: 'g1', name: '松柏類' }] })
 *   → likeCount と genres だけ変更した投稿
 *
 * 各フィールドの説明:
 * - id: 投稿の一意識別子
 * - user: 投稿したユーザーの情報
 * - content: 投稿本文
 * - createdAt: 投稿作成日時（ISO文字列形式）
 * - genres: 投稿のジャンルタグ（盆栽用語：松柏類など）
 * - media: 投稿に含まれる画像・動画
 * - quotePost: 引用元の投稿（引用投稿の場合のみ）
 * - repostPost: リポスト元の投稿（リポスト時のみ）
 * - likeCount: いいね数
 * - commentCount: コメント数
 */
function makePost(overrides: any = {}): any {
  return {
    id: 'post1',
    user: { id: 'user1', nickname: 'テストユーザー', avatarUrl: null },
    content: 'Hello World',
    createdAt: new Date().toISOString(),
    genres: [],
    media: [],
    quotePost: null,
    repostPost: null,
    likeCount: 5,
    commentCount: 3,
    ...overrides,
  }
}

describe('PostCard', () => {
  /**
   * 各テスト前にモック関数をリセット
   * （詳細は EventForm の beforeEach コメントを参照）
   */
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * テストケース1: プロフィール画像がない場合、ニックネームの最初の文字を表示する
   *
   * WHAT（何をテストするか）:
   * - ユーザーがアバター画像を設定していない場合、
   *   ニックネームの最初の文字を「イニシャルアバター」として表示する機能
   *
   * HOW（どのようにテストするか）:
   * 1. makePost(): デフォルト投稿を作成
   *    - user.nickname が 'テストユーザー'
   *    - user.avatarUrl が null（画像なし）
   * 2. render(<PostCard />): 投稿カードを描画
   * 3. expect(screen.getByText('テ')).toBeInTheDocument():
   *    - 'テ'（ニックネームの最初の文字）が画面に表示されているか確認
   *
   * WHY（なぜこのテストが重要か）:
   * - すべてのユーザーがプロフィール画像を持つとは限らない
   * - 画像がなくても見栄えよく表示するのは重要な UX
   * - デフォルトのアバターが正しく表示されることを確認
   */
  it('renders avatar initial when avatarUrl is null', () => {
    render(<PostCard post={makePost()} currentUserId="user2" />)
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  /**
   * テストケース2: プロフィール画像が設定されている場合、それを表示する
   *
   * WHAT（何をテストするか）:
   * - ユーザーがアバター画像を設定した場合、その画像が正しく表示される
   *
   * HOW（どのようにテストするか）:
   * 1. makePost({ user: { ... avatarUrl: '/avatar.jpg' } }):
   *    - user オブジェクトを上書きして、avatarUrl を指定
   * 2. render(): コンポーネント描画
   * 3. screen.getByAltText('テスト'):
   *    - <img alt="テスト" src="/avatar.jpg" /> のような画像タグを探す
   *    - getByAltText は alt 属性の値から要素を探す
   * 4. expect(img).toHaveAttribute('src', '/avatar.jpg'):
   *    - <img> タグの src 属性が '/avatar.jpg' であることを確認
   *
   * WHY（なぜこのテストが重要か）:
   * - 画像が正しいパスで表示されることを確認
   * - もし画像パスが間違っていたら、ユーザーは画像が見えない
   */
  it('renders avatar image when avatarUrl is set', () => {
    const post = makePost({ user: { id: 'user1', nickname: 'テスト', avatarUrl: '/avatar.jpg' } })
    render(<PostCard post={post} currentUserId="user2" />)
    const img = screen.getByAltText('テスト')
    expect(img).toHaveAttribute('src', '/avatar.jpg')
  })

  /**
   * テストケース3: リポスト（他人の投稿を共有）を表示する
   *
   * WHAT（何をテストするか）:
   * - リポスト機能：あなたが他人の投稿をシェアした場合、
   *   「◯◯さんがリポスト」という表示が出る
   *
   * HOW（どのようにテストするか）:
   * 1. makePost({ repostPost: { ... } }):
   *    - 元の投稿データを repostPost フィールドに指定
   *    - これが「リポスト機能が使われている」ことを示す
   * 2. render(): コンポーネント描画
   * 3. expect(screen.getByText('がリポスト')).toBeInTheDocument():
   *    - 「◯◯がリポスト」というテキストが表示されているか確認
   * 4. expect(screen.getByText('テストユーザー')).toBeInTheDocument():
   *    - リポストしたユーザー名が表示されているか確認
   *
   * WHY（なぜこのテストが重要か）:
   * - リポスト機能は Twitter でいう「リツイート」
   * - これが正しく表示されないと、ユーザーが「この投稿の元は誰か」がわからない
   */
  it('renders repost indicator', () => {
    const post = makePost({
      repostPost: {
        id: 'orig1',
        content: '元の投稿',
        createdAt: new Date().toISOString(),
        user: { id: 'user3', nickname: '元ユーザー', avatarUrl: null },
        media: [],
      },
    })
    render(<PostCard post={post} currentUserId="user2" />)
    expect(screen.getByText('がリポスト')).toBeInTheDocument()
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  /**
   * テストケース4: 投稿のジャンルタグが表示される
   *
   * WHAT（何をテストするか）:
   * - 投稿に「松柏類」などのジャンルタグが付いている場合、
   *   それらが画面に表示される
   *
   * HOW（どのようにテストするか）:
   * 1. makePost({ genres: [{ id: 'g1', name: '松柏類', ... }] }):
   *    - genres フィールドに盆栽ジャンルの配列を指定
   * 2. render(): コンポーネント描画
   * 3. expect(screen.getByText('松柏類')).toBeInTheDocument():
   *    - ジャンル名 '松柏類' が表示されているか確認
   *
   * WHY（なぜこのテストが重要か）:
   * - ジャンルタグは投稿を分類する重要な機能
   * - ジャンルタグが表示されないと、ユーザーが投稿の種類を判別できない
   * - 検索やフィルタリング機能の基礎になる
   */
  it('renders genre tags', () => {
    const post = makePost({
      genres: [{ id: 'g1', name: '松柏類', category: 'shouhin' }],
    })
    render(<PostCard post={post} currentUserId="user2" />)
    expect(screen.getByText('松柏類')).toBeInTheDocument()
  })

  /**
   * テストケース5: メニューのオープン・クローズが正しく動作する
   *
   * WHAT（何をテストするか）:
   * - 投稿カード右上の「もっと」ボタンでメニューが開き、
   *   メニュー背景（オーバーレイ）をクリックでメニューが閉じる
   *
   * HOW（どのようにテストするか）:
   * ＜ステップ1: メニューを開く＞
   * 1. screen.getAllByRole('button'): 画面のすべてのボタンを取得
   * 2. menuButtons.find(b => b.querySelector('svg')):
   *    - SVG アイコンを含むボタンを探す（それが「もっと」ボタン）
   *    - querySelector は子要素を探すメソッド
   * 3. fireEvent.click(moreButton!):
   *    - 「もっと」ボタンをクリック
   *    - ! は TypeScript の「null でない」を示す記号
   * 4. expect(screen.getByTestId('report-button')).toBeInTheDocument():
   *    - 通報ボタンが表示される（メニューが開いた）
   *
   * ＜ステップ2: メニューを閉じる＞
   * 5. document.querySelector('.fixed.inset-0'):
   *    - オーバーレイ（メニュー背景の半透明部分）を探す
   *    - '.fixed.inset-0' は Tailwind CSS のクラス
   * 6. fireEvent.click(overlay!):
   *    - オーバーレイをクリック
   * 7. expect(screen.queryByTestId('report-button')).not.toBeInTheDocument():
   *    - 通報ボタンが消えた（メニューが閉じた）
   *    - queryByTestId は「見つからないかもしれない」場合に使う
   *    - getByTestId は「必ず見つかる」前提で使う（見つからないとエラー）
   *
   * WHY（なぜこのテストが重要か）:
   * - モーダルメニューの開閉は UI の基本的な機能
   * - これが動作しないと、ユーザーが操作できない
   * - オーバーレイクリックでメニューを閉じる UX は標準的
   */
  it('opens and closes menu via overlay', () => {
    render(<PostCard post={makePost()} currentUserId="user2" />)
    // ステップ1: メニューを開く
    const menuButtons = screen.getAllByRole('button')
    const moreButton = menuButtons.find(b => b.querySelector('svg'))
    fireEvent.click(moreButton!)
    // 通報ボタンが表示される（ユーザーは投稿の所有者ではない）
    expect(screen.getByTestId('report-button')).toBeInTheDocument()
    // ステップ2: オーバーレイをクリックしてメニューを閉じる
    const overlay = document.querySelector('.fixed.inset-0')
    fireEvent.click(overlay!)
    expect(screen.queryByTestId('report-button')).not.toBeInTheDocument()
  })

  /**
   * テストケース6: 投稿の所有者には削除ボタンが表示される
   *
   * WHAT（何をテストするか）:
   * - あなたが投稿した投稿のメニューには「削除」ボタンが表示される
   * - 他人の投稿には「削除」ボタンは表示されない（テスト5参照）
   *
   * HOW（どのようにテストするか）:
   * 1. makePost(): 投稿データ（投稿者 user1）
   * 2. render(<PostCard ... currentUserId="user1" />):
   *    - currentUserId を "user1" に設定（投稿者本人）
   * 3. メニューボタンをクリック（テスト5と同じ方法）
   * 4. expect(screen.getByTestId('delete-button')).toBeInTheDocument():
   *    - 削除ボタンが表示されているか確認
   *
   * WHY（なぜこのテストが重要か）:
   * - セキュリティ: 他人の投稿は削除できないようにする必要がある
   * - 正しい権限チェックが実装されていることを確認
   */
  it('shows delete button for owner in menu', () => {
    const post = makePost()
    render(<PostCard post={post} currentUserId="user1" />)
    const menuButtons = screen.getAllByRole('button')
    const moreButton = menuButtons.find(b => b.querySelector('svg'))
    fireEvent.click(moreButton!)
    expect(screen.getByTestId('delete-button')).toBeInTheDocument()
  })

  /**
   * テストケース7: ログインしていない場合、ログインリンクが表示される
   *
   * WHAT（何をテストするか）:
   * - currentUserId を渡さない（ログインしていない状態）と、
   *   「ログインしてください」的なリンクが表示される
   *
   * HOW（どのようにテストするか）:
   * 1. render(<PostCard post={makePost()} />):
   *    - currentUserId パラメータを渡さない
   * 2. screen.getAllByRole('link'):
   *    - 画面のすべてのリンク（<a> タグ）を取得
   * 3. .filter(a => a.getAttribute('href') === '/login'):
   *    - そのうち href="/login" のリンクをフィルタ
   * 4. expect(loginLinks.length).toBeGreaterThan(0):
   *    - ログインリンクが1つ以上存在することを確認
   *    - toBeGreaterThan(0) は「0より大きい」つまり「1以上」を意味する
   *
   * WHY（なぜこのテストが重要か）:
   * - 未認証ユーザーには、いいねやコメント機能が使えないことを告知する必要がある
   * - ログインページへのリンクがないと、ユーザーはログインできない
   */
  it('shows login link when currentUserId is not set', () => {
    render(<PostCard post={makePost()} />)
    const loginLinks = screen.getAllByRole('link').filter(a => a.getAttribute('href') === '/login')
    expect(loginLinks.length).toBeGreaterThan(0)
  })

  /**
   * テストケース8: ログインしていれば、いいねボタンとブックマークボタンが表示される
   *
   * WHAT（何をテストするか）:
   * - 認証済みユーザーには、
   *   LikeButton（いいねボタン）と BookmarkButton（ブックマークボタン）が表示される
   *
   * HOW（どのようにテストするか）:
   * 1. render(<PostCard ... currentUserId="user2" />):
   *    - currentUserId を指定（ログイン状態）
   * 2. expect(screen.getByTestId('like-button')).toBeInTheDocument():
   *    - いいねボタンのモック（最初に vi.mock したもの）が表示されているか確認
   * 3. expect(screen.getByTestId('bookmark-button')).toBeInTheDocument():
   *    - ブックマークボタンのモックが表示されているか確認
   *
   * WHY（なぜこのテストが重要か）:
   * - 認証状態によってボタンの表示/非表示が切り替わることを確認
   * - テスト7（ログインなし）との対比で、権限チェックが正しく動作していることを検証
   */
  it('shows LikeButton and BookmarkButton when authenticated', () => {
    render(<PostCard post={makePost()} currentUserId="user2" />)
    expect(screen.getByTestId('like-button')).toBeInTheDocument()
    expect(screen.getByTestId('bookmark-button')).toBeInTheDocument()
  })

  /**
   * テストケース9: 引用投稿を表示する
   *
   * WHAT（何をテストするか）:
   * - あなたが他人の投稿を「引用投稿」した場合、
   *   元の投稿が表示される
   *
   * HOW（どのようにテストするか）:
   * 1. makePost({ quotePost: { ... } }):
   *    - quotePost フィールドに引用元の投稿データを指定
   *    - 引用投稿と異なり、元の投稿がカード形式で埋め込まれる
   * 2. render(): コンポーネント描画
   * 3. expect(screen.getByTestId('quoted-post')).toBeInTheDocument():
   *    - QuotedPost コンポーネント（モック）が表示されているか確認
   *
   * WHY（なぜこのテストが重要か）:
   * - 引用投稿機能は、会話の流れを保つのに重要
   * - 引用元が表示されないと、「何への引用か」がわからない
   * - 子コンポーネント（QuotedPost）が正しく組み込まれていることを確認
   */
  it('renders QuotedPost when quotePost is set', () => {
    const post = makePost({
      quotePost: {
        id: 'q1',
        content: '引用元',
        createdAt: new Date().toISOString(),
        user: { id: 'u2', nickname: '引用者', avatarUrl: null },
      },
    })
    render(<PostCard post={post} currentUserId="user2" />)
    expect(screen.getByTestId('quoted-post')).toBeInTheDocument()
  })

  /**
   * テストケース10: 画像ギャラリーが表示される
   *
   * WHAT（何をテストするか）:
   * - 投稿に画像が含まれている場合、ImageGallery コンポーネントが表示される
   *
   * HOW（どのようにテストするか）:
   * 1. makePost({ media: [{ id: 'm1', url: '/img.jpg', ... }] }):
   *    - media フィールドに画像データを指定
   * 2. render(): コンポーネント描画
   * 3. expect(screen.getByTestId('image-gallery')).toBeInTheDocument():
   *    - ImageGallery コンポーネント（モック）が表示されているか確認
   *
   * WHY（なぜこのテストが重要か）:
   * - 画像付き投稿は、テキストだけの投稿と異なる見た目になる
   * - メディア表示コンポーネントが正しく組み込まれていることを確認
   * - 画像がない投稿では表示されないことも重要
   */
  it('renders ImageGallery when media is present', () => {
    const post = makePost({
      media: [{ id: 'm1', url: '/img.jpg', type: 'image', sortOrder: 0 }],
    })
    render(<PostCard post={post} currentUserId="user2" />)
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument()
  })

  /**
   * テストケース11: 投稿カードをクリックすると投稿詳細ページに遷移する
   *
   * WHAT（何をテストするか）:
   * - ユーザーが投稿カードをクリックすると、
   *   その投稿の詳細ページ（/posts/[id]）に遷移する
   *
   * HOW（どのようにテストするか）:
   * 1. render(): コンポーネント描画
   * 2. screen.getByTestId('post-card'):
   *    - data-testid="post-card" の要素（投稿カード全体）を取得
   * 3. fireEvent.click(...):
   *    - 投稿カード全体をクリック
   * 4. expect(mockPush).toHaveBeenCalledWith('/posts/post1'):
   *    - mockPush（router.push のモック）が正しい URL で呼ばれたか確認
   *    - toHaveBeenCalledWith('...'): 指定の引数で呼ばれたかを確認
   *
   * WHY（なぜこのテストが重要か）:
   * - 投稿クリック → 詳細ページ遷移 は基本的なナビゲーション
   * - これができないと、ユーザーが投稿の詳細を見られない
   * - router.push が正しく呼ばれることを確認
   */
  it('navigates on card click', () => {
    render(<PostCard post={makePost()} currentUserId="user2" />)
    fireEvent.click(screen.getByTestId('post-card'))
    expect(mockPush).toHaveBeenCalledWith('/posts/post1')
  })
})
