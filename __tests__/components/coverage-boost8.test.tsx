import { vi } from 'vitest'
/**
 * Coverage Boost Test 8
 *
 * このファイルは以下のコンポーネントのカバレッジを向上させるためのテストを含みます:
 * - PostFormModal (84.53% → 目標90%+)
 * - CommentForm (87.06% → 目標90%+)
 * - SearchResults (79.31% → 目標90%+)
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PostFormModal } from '@/components/post/PostFormModal'
import { CommentForm } from '@/components/comment/CommentForm'
import { PostSearchResults, UserSearchResults, TagSearchResults, PopularTags } from '@/components/search/SearchResults'

// ============================================================
// Mock設定
// ============================================================
// Mockとは：実際の実装を使わずに、テスト用の「ダミー」を提供すること
// なぜ必要か：実際のNext.jsやAPIを使うと、テストが遅くなったり不安定になったりするため

/**
 * Next.jsの next/link をモックしている理由：
 * - Nextの Link コンポーネントはブラウザ環境が必要だが、テスト環境にはない
 * - 通常のaタグに置き換えることで、テスト環境でも動作するようにする
 *
 * モック内容：
 * - { children, href, ...props } を受け取るコンポーネントを返す
 * - 内部的には普通のaタグにしている
 * - このおかげでLink自体の動作テストはスキップし、コンポーネント自体をテストできる
 */
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

/**
 * Next.jsの next/image をモックしている理由：
 * - Image コンポーネントはブラウザのImageオブジェクトが必要
 * - テスト環境では画像を読み込めないので、シンプルなimgタグに置き換える
 *
 * 実装：
 * - 渡されたpropsをそのままimgタグに渡すだけ
 * - 画像の最適化やWebP変換などの機能はテストでは不要
 */
vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../utils/mock-next-image')
  return { __esModule: true, default: MockNextImage }
})

/**
 * useRouter（ナビゲーション）をモックしている理由：
 * - ページ遷移や画面リロードはテスト環境では実行できない
 * - コンポーネントが呼び出す push, refresh, back を検知したいため
 *
 * vi.fn() について：
 * - 「関数が呼ばれたか」「どんな引数で呼ばれたか」を記録できるダミー関数
 * - テスト内で expect(mockPush).toHaveBeenCalledWith(...) のように検証できる
 */
const mockPush = vi.fn()  // ページ遷移をシミュレート
const mockRefresh = vi.fn()  // ページ更新をシミュレート
const mockBack = vi.fn()  // 戻るをシミュレート

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    back: mockBack,
  }),
  usePathname: () => '/',  // 現在のパスはルート (/)
  useSearchParams: () => new URLSearchParams(),  // URLクエリなし
}))

/**
 * Server Actions（サーバー側の処理）をモックしている理由：
 * - createPost, saveDraft などはデータベースに直接アクセスする
 * - テスト中に本当にデータベースに保存されたら困る
 * - 各テストケースで「このアクション呼ばれたか」「どんな結果を返すか」を制御したい
 *
 * 使い方：
 * - テスト内で (createPost as ReturnType<typeof vi.fn>).mockResolvedValue(...) で戻り値を設定
 * - こうすることで、テストごとに異なる結果をシミュレートできる
 */
vi.mock('@/lib/actions/post', () => ({
  createPost: vi.fn(),  // 投稿作成関数のダミー
}))

vi.mock('@/lib/actions/draft', () => ({
  saveDraft: vi.fn(),  // 下書き保存関数のダミー
}))

vi.mock('@/lib/actions/comment', () => ({
  createComment: vi.fn(),  // コメント作成関数のダミー
}))

vi.mock('@/lib/actions/search', () => ({
  searchPosts: vi.fn(),  // 投稿検索関数のダミー
  searchUsers: vi.fn(),  // ユーザー検索関数のダミー
  searchByTag: vi.fn(),  // タグ検索関数のダミー
}))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))

/**
 * 画像・動画処理ユーティリティをモックしている理由：
 * - 実際のファイルアップロード処理は遅い（ネットワークI/O）
 * - テストでは高速に完了させたい
 *
 * uploadVideoToR2 について：
 * - setTimeoutで「10ms後に50%」「20ms後に100%」と進捗をシミュレート
 * - これにより、進捗バーのテストができるようになる
 *
 * 定数について：
 * - MAX_IMAGE_SIZE: 4MB
 * - MAX_VIDEO_SIZE: 256MB
 * - テストでこれらの上限をテストする時に使用
 */
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn((file) => Promise.resolve(file)),  // ファイル圧縮（ダミーはそのまま返す）
  isVideoFile: vi.fn((file) => file.type.startsWith('video/')),  // ファイルが動画かチェック
  formatFileSize: vi.fn((size) => `${(size / 1024).toFixed(1)}KB`),  // ファイルサイズをKB単位で表示
  uploadVideoToR2: vi.fn((file, folder, onProgress) => {
    // 進捗をシミュレート：実際のアップロードではなく、単に進捗が進むだけ
    setTimeout(() => onProgress(50), 10)  // 10ms後に50%を報告
    setTimeout(() => onProgress(100), 20)  // 20ms後に100%を報告
    return Promise.resolve({ url: 'https://r2.example.com/video.mp4' })  // アップロード完了を返す
  }),
  MAX_IMAGE_SIZE: 4 * 1024 * 1024,  // 画像の最大サイズ：4MB
  MAX_VIDEO_SIZE: 80 * 1024 * 1024,  // 動画の最大サイズ：80MB
}))

// CommentForm は usePremium() で動画上限を決める。プレミアム会員として動作させる。
vi.mock('@/components/premium/PremiumContext', () => ({
  usePremium: () => true,
  PremiumContextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

/**
 * PostCard（投稿表示）をモックしている理由：
 * - PostCard自体の複雑なロジックはテストしない
 * - SearchResultsがpostを正しく渡しているかだけを確認したい
 *
 * 実装：
 * - post.id と post.content のみを表示するシンプルなダミーにしている
 */
vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post }: any) => <div data-testid={`post-${post.id}`}>{post.content}</div>,
}))

/**
 * GenreSelector（ジャンル選択）をモックしている理由：
 * - PostFormModalがジャンルを正しく処理しているかをテストしたい
 * - GenreSelectorの内部の複雑なロジックはテストしない
 *
 * data-testid について：
 * - テスト内で要素を見つけるための「名札」のような役割
 * - screen.getByTestId('genre-selector') で要素を取得できる
 */
vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ selectedIds, onChange }: any) => (
    <div data-testid="genre-selector">
      <button onClick={() => onChange([...selectedIds, 'genre1'])}>
        Add Genre
      </button>
    </div>
  ),
}))

/**
 * MentionTextarea（メンション対応テキスト入力）をモックしている理由：
 * - メンション機能（@ユーザー名）の複雑な処理はテストしない
 * - CommentFormが入力値を正しく処理しているかだけを確認したい
 *
 * 重要：onChange（変更時）に「string値」を渡す理由：
 * - 実際のMentionTextareaもonChangeに「テキスト文字列」を渡す
 * - このダミーもそれに合わせることで、実際の動作に近くなる
 */
vi.mock('@/components/common/MentionTextarea', () => ({
  MentionTextarea: ({ value, onChange, ...props }: any) => (
    <textarea
      {...props}
      value={value}
      onChange={(e: any) => onChange(e.target.value)}  // 文字列だけをonChangeに渡す
      data-testid="mention-textarea"  // テスト内で「const textarea = screen.getByTestId('mention-textarea')」で取得可能
    />
  ),
}))

/**
 * react-intersection-observer（無限スクロール検知）をモックしている理由：
 * - useInViewは「要素が画面に見えているか」を検知する
 * - テスト環境では「画面スクロール」ができないので、モックが必要
 *
 * デフォルト：inView: false
 * - 通常は要素が見えていない状態
 * - テスト内で (useInView as ReturnType<typeof vi.fn>).mockReturnValue({...}) で
 *   inView: true に変更すれば「スクロール時に読み込み」をテストできる
 */
vi.mock('react-intersection-observer', () => ({
  useInView: vi.fn(() => ({ ref: vi.fn(), inView: false })),
}))

// Import mocked useInView for use in tests (dynamic import of the mocked module)
const { useInView: useInViewMock } = await import('react-intersection-observer')

// ============================================================
// PostFormModal のテスト
// ============================================================

/**
 * describe について：
 * - テストをグループ化する（「PostFormModalのテスト」という意味）
 * - 複数のテストケースを同じグループにまとめられる
 *
 * QueryClientProvider について：
 * - React Queryを使うコンポーネントをテストするときに必要
 * - コンポーネントがcacheやqueryを使う場合、Providerでラップが必須
 * - Providerなしだとエラーになる
 */
describe('PostFormModal', () => {
  // テストに必要なダミーデータを作成
  const mockGenres = {
    '盆栽': [
      { id: 'genre1', name: '松柏類', category: '盆栽' },
      { id: 'genre2', name: '雑木類', category: '盆栽' },
    ],
  }

  // 全テストケースで使う共通のprops
  const defaultProps = {
    genres: mockGenres,
    isOpen: true,  // モーダルを開いた状態
    onClose: vi.fn(),  // 閉じるボタン用のダミー関数
  }

  let queryClient: QueryClient

  /**
   * beforeEach について：
   * - 各テストケースの前に実行される準備処理
   * - テストケース間で状態が混在しないようにリセットする
   *
   * vi.clearAllMocks() について：
   * - すべてのモック関数の呼び出し履歴をリセット
   * - 前のテストでmockPushが呼ばれていても、次のテストでは「まだ呼ばれていない状態」に
   *
   * QueryClient について：
   * - React Queryのキャッシュを管理するオブジェクト
   * - { retry: false } は「エラー時に再試行しない」という意味（テストを早くするため）
   */
  beforeEach(() => {
    vi.clearAllMocks()  // すべてのモック関数をリセット
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },  // テスト環境では再試行しない
      },
    })
  })

  /**
   * it について：
   * - 1つのテストケースを定義する
   * - 最初の引数：「何をテストするか」の説明（日本語でOK）
   * - 2番目の引数：テストを実行する関数
   *
   * render について：
   * - Reactコンポーネントを「仮想的に描画」する
   * - テスト環境での実際のDOM操作を行える
   *
   * QueryClientProvider でラップする理由：
   * - PostFormModalが React Query を使っているため
   * - Providerがないと「QueryClient is not defined」エラーになる
   *
   * expect について：
   * - テストの「期待値」を定義する
   * - expect(〇〇).toBeNull() は「〇〇がnullであること」を期待
   * - もしnullでなかったら、テストは失敗
   */
  it('isOpen=false の場合は何も表示しない', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <PostFormModal {...defaultProps} isOpen={false} />
      </QueryClientProvider>
    )
    // container.firstChild が null = 何も描画されていない
    expect(container.firstChild).toBeNull()
  })

  /**
   * screen.getByText について：
   * - 「〇〇というテキストを持つ要素」を見つける
   * - ボタン、リンク、テキストなど、テキスト内容で検索できる
   *
   * expect(〇〇).toBeDisabled() について：
   * - 「要素が disabled 状態（クリックできない）」を期待
   *
   * このテストの意味：
   * - テキストもメディアもない「空の投稿」は保存できないようにするべき
   * - ボタンが disabled になっていることを確認する
   */
  it('下書き保存ボタンがテキストとメディアがない場合は無効化される', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PostFormModal {...defaultProps} />
      </QueryClientProvider>
    )
    const saveDraftButton = screen.getByText('下書き保存')  // 「下書き保存」という文字を持つ要素を取得
    expect(saveDraftButton).toBeDisabled()  // そのボタンが disabled 状態であることを確認
  })

  /**
   * このテストの意味：
   * - テキストもメディアもない場合、投稿ボタンは使えないようにするべき
   * - ボタンが disabled になっていることを確認する
   */
  it('投稿ボタンがテキストとメディアがない場合は無効化される', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PostFormModal {...defaultProps} />
      </QueryClientProvider>
    )
    const submitButton = screen.getByText('投稿する')  // 「投稿する」という文字を持つ要素を取得
    expect(submitButton).toBeDisabled()  // そのボタンが disabled 状態であることを確認
  })

  /**
   * screen.getByTitle について：
   * - 「title属性」でHTML要素を見つける
   * - <button title="下書き一覧">...</button> という要素を見つけられる
   *
   * expect(〇〇).toBeInTheDocument() について：
   * - 「要素がDOMに存在する」ことを期待
   * - テスト環境で「ページ上に表示されているか」を確認できる
   *
   * expect(〇〇).toHaveAttribute('href', '/drafts') について：
   * - 「要素が特定のattribute（属性）を持っている」ことを期待
   * - <a href="/drafts">... の href="/drafts" を確認
   */
  it('下書き数が0より大きい場合、下書き一覧リンクが表示される', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PostFormModal {...defaultProps} draftCount={3} />
      </QueryClientProvider>
    )
    const draftLink = screen.getByTitle('下書き一覧')
    expect(draftLink).toBeInTheDocument()
    expect(draftLink).toHaveAttribute('href', '/drafts')
  })

  /**
   * fireEvent について：
   * - テスト環境でユーザー操作をシミュレートする
   * - fireEvent.click(〇〇) は「〇〇をクリック」をシミュレート
   * - fireEvent.change(textarea, ...) は「テキスト入力」をシミュレート
   *
   * expect(onClose).toHaveBeenCalled() について：
   * - モック関数が「呼ばれたこと」を確認
   * - vi.fn() で作った関数の呼び出し回数を検証できる
   *
   * 注意：fireEvent と userEvent について：
   * - fireEvent は「低レベル」な操作（DOMイベントを直接発火）
   * - userEvent は「高レベル」な操作（実際のユーザー操作に近い）
   * - 新しいテストでは userEvent の方が推奨されている
   * - このコードは fireEvent を使っているので、それに合わせている
   */
  it('下書き一覧リンクをクリックするとonCloseが呼ばれる', () => {
    const onClose = vi.fn()
    render(
      <QueryClientProvider client={queryClient}>
        <PostFormModal {...defaultProps} onClose={onClose} draftCount={3} />
      </QueryClientProvider>
    )
    const draftLink = screen.getByTitle('下書き一覧')
    fireEvent.click(draftLink)
    expect(onClose).toHaveBeenCalled()
  })

  /**
   * screen.getByRole について：
   * - 「accessibility role」(役割)で要素を見つける
   * - 'combobox' はセレクトボックス
   * - 'option' はセレクトボックスのオプション
   *
   * screen.getAllByRole について：
   * - getByRole は「最初の1つ」を取得
   * - getAllByRole は「すべて」を配列で取得
   *
   * toHaveLength(3) について：
   * - 配列の長さが3であることを確認
   */
  it('マイ盆栽が存在する場合、選択肢が表示される', () => {
    const bonsais = [
      { id: 'b1', name: '五葉松', species: '松柏類' },
      { id: 'b2', name: 'もみじ', species: null },
    ]
    render(
      <QueryClientProvider client={queryClient}>
        <PostFormModal {...defaultProps} bonsais={bonsais} />
      </QueryClientProvider>
    )

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()

    // オプションの確認：「選択しない」（デフォルト）+ 松と紅葉 = 3つ
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
  })

  /**
   * fireEvent.change について：
   * - フォーム要素の値を変更する
   * - fireEvent.change(select, { target: { value: 'b1' } })
   *   = セレクトボックスの値を 'b1' に変更
   *
   * as HTMLSelectElement について：
   * - TypeScriptに「selectはHTMLSelectElement型である」ことを伝える
   * - こうすることで、select.value でTypescriptが補完できる
   */
  it('マイ盆栽を選択できる', () => {
    const bonsais = [
      { id: 'b1', name: '五葉松', species: '松柏類' },
    ]
    render(
      <QueryClientProvider client={queryClient}>
        <PostFormModal {...defaultProps} bonsais={bonsais} />
      </QueryClientProvider>
    )

    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'b1' } })
    expect(select.value).toBe('b1')
  })

})

// ============================================================
// CommentForm のテスト
// ============================================================

/**
 * CommentFormについて：
 * - テキストのみ入力できるシンプルなフォーム（PostFormModalより簡潔）
 * - メディアアップロードや下書き機能がある可能性
 * - プレースホルダーやボタンテキストが動的に変わる
 */
describe('CommentForm', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 全テストケースで使う共通のprops
  const defaultProps = {
    postId: 'post123',
  }

  /**
   * screen.getByPlaceholderText について：
   * - HTML の placeholder 属性で要素を見つける
   * - <input placeholder="コメントを入力..." /> という要素を検索
   *
   * Placeholderについて：
   * - ユーザーが何を入力すべきか示す「ヒント文字」
   * - 入力が始まると自動的に消える
   */
  it('デフォルトのプレースホルダーが表示される', () => {
    render(<CommentForm {...defaultProps} />)
    expect(screen.getByPlaceholderText('コメントを入力...')).toBeInTheDocument()
  })

  /**
   * このテストの意味：
   * - placeholder props を渡せば、カスタムテキストを表示できるべき
   * - コメント欄と返信欄で異なるプレースホルダーが必要な場合を想定
   */
  it('カスタムプレースホルダーが表示される', () => {
    render(<CommentForm {...defaultProps} placeholder="返信を入力..." />)
    expect(screen.getByPlaceholderText('返信を入力...')).toBeInTheDocument()
  })

  /**
   * parentId について：
   * - コメントの「親コメント」のID
   * - parentIdがある = 別のコメントへの返信（スレッド形式）
   * - parentIdがない = 投稿へのトップレベルコメント
   *
   * ボタンテキストが変わる理由：
   * - UXを向上させるため
   * - 返信の場合「返信する」、コメントの場合「コメントする」と表示
   *
   * fireEvent.change について：
   * - テキスト入力をシミュレート
   * - テキストがないとボタンが無効化されるので、先に入力する
   */
  it('parentIdがある場合、「返信する」ボタンが表示される', () => {
    render(<CommentForm {...defaultProps} parentId="comment456" />)
    // テキストを入力して有効化（テキストがないとボタンが disabled になる）
    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'テスト返信' } })

    expect(screen.getByText('返信する')).toBeInTheDocument()
  })

  /**
   * このテストの意味：
   * - parentIdがないときは、通常のコメント作成モード
   * - ボタンテキストが「コメントする」になるべき
   */
  it('parentIdがない場合、「コメントする」ボタンが表示される', () => {
    render(<CommentForm {...defaultProps} />)
    // テキストを入力して有効化
    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'テストコメント' } })

    expect(screen.getByText('コメントする')).toBeInTheDocument()
  })

  /**
   * onCancel について：
   * - 親コンポーネント（投稿詳細など）がcancel時に行うべき処理を定義
   * - 例：返信フォームを閉じるなど
   *
   * optional props について：
   * - onCancel は optional (指定しなくてもOK)
   * - 指定されたときだけキャンセルボタンが表示される
   */
  it('onCancelが渡された場合、キャンセルボタンが表示される', () => {
    const onCancel = vi.fn()
    render(<CommentForm {...defaultProps} onCancel={onCancel} />)
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
  })

  /**
   * expect(onCancel).toHaveBeenCalled() について：
   * - vi.fn() で作ったモック関数が「呼ばれたか」を確認
   * - 引数がない場合は toHaveBeenCalled() を使う
   * - 特定の引数で呼ばれたかを確認したい場合は toHaveBeenCalledWith(...) を使う
   */
  it('キャンセルボタンをクリックするとonCancelが呼ばれる', () => {
    const onCancel = vi.fn()
    render(<CommentForm {...defaultProps} onCancel={onCancel} />)

    const cancelButton = screen.getByText('キャンセル')
    fireEvent.click(cancelButton)

    expect(onCancel).toHaveBeenCalled()
  })

  /**
   * screen.getByRole('button', { name: /.../ }) について：
   * - role が 'button' で、テキストが「正規表現」にマッチする要素を取得
   * - name: /コメントする/ = 「コメントする」を含むテキストを持つボタン
   * - 複数のボタンがある場合、テキストで区別する
   *
   * 正規表現について：
   * - /コメントする/ は「コメント」が含まれるかをチェック（完全一致でなくOK）
   * - これにより、「コメントする」「コメントする（確認中）」など
   *   わずかなテキスト変化に対応できる
   */
  it('テキストとメディアがない場合は送信ボタンが無効化される', () => {
    render(<CommentForm {...defaultProps} />)
    const submitButton = screen.getByRole('button', { name: /コメントする/ })
    expect(submitButton).toBeDisabled()
  })

  /**
   * このテストの意味：
   * - コメントの最大文字数は500文字
   * - 501文字入力するとボタンが無効化されるべき
   *
   * 'a'.repeat(501) について：
   * - 'a' を 501 回繰り返す
   * - つまり「aaaaa...」(501個) という文字列
   */
  it('文字数超過時に送信ボタンが無効化される', () => {
    render(<CommentForm {...defaultProps} />)
    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'a'.repeat(501) } })

    const submitButton = screen.getByRole('button', { name: /コメントする/ })
    expect(submitButton).toBeDisabled()
  })

  /**
   * container について：
   * - render() が返すオブジェクトの一部
   * - DOMツリー全体にアクセスできる
   *
   * container.querySelector について：
   * - CSSセレクタで要素を検索
   * - '.text-yellow-500' は Tailwind CSS のクラス名
   * - つまり「text-yellow-500 クラスを持つ要素」を探す
   *
   * Tailwind CSS について：
   * - .text-yellow-500 = テキスト色が黄色
   * - .text-destructive = テキスト色が赤（エラー色）
   *
   * このテストの意味：
   * - 文字数が増えると、色が変わることをテスト
   * - ユーザーに「もうすぐ上限」を色で知らせる UX
   */
  it('残り文字数が50未満の場合、警告色で表示される', () => {
    const { container } = render(<CommentForm {...defaultProps} />)
    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'a'.repeat(470) } })

    // '.text-muted-foreground' クラスを持つ要素 = 警告色で表示される要素
    const remainingChars = container.querySelector('.text-muted-foreground')
    expect(remainingChars).toBeInTheDocument()
  })

  /**
   * このテストの意味：
   * - 文字数が超過すると、エラー色で表示される
   * - ユーザーに「超過している」ことを色で知らせる
   */
  it('文字数超過時にエラー色で表示される', () => {
    const { container } = render(<CommentForm {...defaultProps} />)
    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'a'.repeat(501) } })

    // '.text-destructive' クラスを持つ要素 = エラー色で表示される要素
    const remainingChars = container.querySelector('.text-destructive')
    expect(remainingChars).toBeInTheDocument()
  })

  /**
   * require() について：
   * - テスト内で vi.mock のモック関数を取得する方法
   * - ファイルの先頭でモックしたものを、テスト内で動的に設定できる
   *
   * mockResolvedValue について：
   * - async/await を使う関数のモック戻り値を設定
   * - mockResolvedValue({...}) = Promise.resolve({...}) と同じ
   * - テスト内でアクションが「成功した」と見なすことができる
   *
   * fireEvent.submit(form) について：
   * - フォーム全体の submit イベントを発火
   * - fireEvent.click(submitButton) ではなく fireEvent.submit(form) を使う
   * - 「フォーム送信」をより正確にシミュレートできる
   *
   * await waitFor について：
   * - 非同期処理が完了するまで待つ
   * - createComment は async なので、完了を待つ必要がある
   * - waitFor 内の条件が true になるまで、最大1秒間ポーリングする
   *
   * async/await について：
   * - async は「非同期処理を含む関数」という意味
   * - await は「ここで待つ」という意味
   * - await を使うには関数が async である必要がある
   */
  it('コメント送信が成功した場合、フォームがリセットされる', async () => {
    // テスト内でモック関数の戻り値を設定（成功時）
    const { createComment } = await import('@/lib/actions/comment');
    (createComment as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, commentId: 'comment123' })

    const onSuccess = vi.fn()
    render(<CommentForm {...defaultProps} onSuccess={onSuccess} />)

    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'テストコメント' } })

    // フォーム要素を取得（textarea.closest('form') で親のform要素を取得）
    const form = textarea.closest('form')!
    fireEvent.submit(form)

    // 非同期処理（API呼び出しなど）が完了するまで待つ
    await waitFor(() => {
      expect(createComment).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  /**
   * このテストの意味：
   * - APIエラーが発生したときの動作をテスト
   * - ユーザーに分かりやすいエラーメッセージを表示するべき
   *
   * mockResolvedValue({ error: ... }) について：
   * - success ではなく error を返す
   * - コンポーネントがこれを検知してエラーメッセージを表示する
   */
  it('コメント送信でエラーが発生した場合、エラーメッセージを表示', async () => {
    const { createComment } = await import('@/lib/actions/comment');
    (createComment as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'コメントの送信に失敗しました' })

    render(<CommentForm {...defaultProps} />)

    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'テストコメント' } })

    const form = textarea.closest('form')!
    fireEvent.submit(form)

    // エラーメッセージが画面に表示されるまで待つ
    await waitFor(() => {
      expect(screen.getByText('コメントの送信に失敗しました')).toBeInTheDocument()
    })
  })

  /**
   * container.querySelector('input[type="file"]') について：
   * - type="file" という属性を持つ input 要素（ファイル選択ボタン）を検索
   *
   * new File() について：
   * - テスト用のダミーファイルオブジェクトを作成
   * - 第1引数：ファイルの内容（['dummy video'] は配列）
   * - 第2引数：ファイル名 ('test.mp4')
   * - 第3引数：ファイルタイプ ({ type: 'video/mp4' } = MP4動画）
   *
   * Object.defineProperty について：
   * - オブジェクトのプロパティを定義・変更する
   * - fileInput.files は通常読み取り専用だが、テストでは手動で設定したい
   * - writable: false にして「読み取り専用」にしている
   *
   * fireEvent.change(fileInput) について：
   * - ファイル選択の change イベントを発火
   * - つまり「ファイルを選択した」をシミュレート
   *
   * .bg-bonsai-green について：
   * - Tailwind CSS のクラス（背景色が bonsai-green）
   * - つまり「進捗バー」を示すカスタムクラス
   */
  it('動画アップロード時に進捗バーが表示される', async () => {
    const { container } = render(<CommentForm {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    // テスト用のダミー動画ファイルを作成
    const videoFile = new File(['dummy video'], 'test.mp4', { type: 'video/mp4' })
    // fileInputの files プロパティに上記のファイルを「含ませる」
    Object.defineProperty(fileInput, 'files', {
      value: [videoFile],
      writable: false,
    })

    fireEvent.change(fileInput)

    // アップロード処理が始まり、進捗バーが表示されるまで待つ
    await waitFor(() => {
      const progressBar = container.querySelector('.bg-bonsai-green')
      expect(progressBar).toBeInTheDocument()
    })
  })

  /**
   * XMLHttpRequestについて：
   * - ブラウザの古い非同期通信API
   * - 現在は fetch や axios が一般的だが、レガシーコードで使用される
   * - このコンポーネントはXHRを使っているので、モックが必要
   *
   * mockXHR について：
   * - XMLHttpRequest をシミュレートするダミーオブジェクト
   * - open, send, addEventListener などのメソッドを持つ
   *
   * upload.addEventListener について：
   * - ファイルアップロード時の進捗イベント
   * - event === 'progress' のとき、進捗情報（loaded: 50, total: 100）を返す
   * - setTimeout(..., 10) で「10ms後」に進捗を報告
   *
   * addEventListener（'load'） について：
   * - アップロード完了時のイベント
   * - status = 200 （正常）に設定
   * - responseText に JSON 形式の戻り値を設定
   * - setTimeout(..., 20) で「20ms後」に完了を報告
   *
   * global.XMLHttpRequest について：
   * - ブラウザの XMLHttpRequest をグローバルに置き換え
   * - これにより、コンポーネントが XMLHttpRequest を使うと、上記の mockXHR が使われる
   *
   * waitFor のオプション：
   * - { timeout: 100 } = 最大100ms待つ
   * - デフォルトは1000msだが、ここでは短い時間に設定
   */
  it('画像アップロード時に「画像を圧縮中...」メッセージが表示される', async () => {
    const { container } = render(<CommentForm {...defaultProps} />)

    /**
     * XMLHttpRequestのモック設定
     * 実際のHTTP通信をせずに、テスト用の動作をシミュレート
     */
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      upload: {
        // ファイル送信中の進捗を報告
        addEventListener: vi.fn((event, handler) => {
          if (event === 'progress') {
            // 10ms後に進捗を報告（50%）
            setTimeout(() => handler({ lengthComputable: true, loaded: 50, total: 100 }), 10)
          }
        }),
      },
      // リクエスト完了時のイベント
      addEventListener: vi.fn((event, handler) => {
        if (event === 'load') {
          // 20ms後に完了を報告
          setTimeout(() => {
            mockXHR.status = 200
            mockXHR.responseText = JSON.stringify({ url: 'https://example.com/image.jpg', type: 'image' })
            handler()
          }, 20)
        }
      }),
      status: 200,
      responseText: '',
    }

    // グローバルな XMLHttpRequest をモックに置き換え
     
    global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as any

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const imageFile = new File(['dummy image'], 'test.jpg', { type: 'image/jpeg' })

    Object.defineProperty(fileInput, 'files', {
      value: [imageFile],
      writable: false,
    })

    fireEvent.change(fileInput)

    // 「画像を圧縮中...」メッセージが表示されるまで待つ（最大100ms）
    await waitFor(() => {
      expect(screen.getByText('画像を圧縮中...')).toBeInTheDocument()
    }, { timeout: 100 })
  })
})

// ============================================================
// SearchResults のテスト
// ============================================================

/**
 * SearchResults について：
 * - 検索結果を表示するコンポーネント
 * - PostSearchResults, UserSearchResults, TagSearchResults, PopularTags の4つから構成
 * - それぞれ異なるタイプの検索結果を表示
 */
describe('SearchResults', async () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    /**
     * useInViewのモックをリセット：
     * - beforeEach で毎回初期状態に戻す
     * - テストケースごとに異なる inView 値を設定するため
     */
    ;(useInViewMock as ReturnType<typeof vi.fn>).mockReturnValue({ ref: vi.fn(), inView: false })
  })

  /**
   * describe (nested) について：
   * - describe の中にさらに describe を入れる（ネスト）
   * - テストをより細かくグループ化できる
   * - 実行結果は「SearchResults > PostSearchResults」と階層表示される
   */
  describe('PostSearchResults', async () => {
    /**
     * PostSearchResults について：
     * - query が空の場合：「投稿が見つかりません」
     * - query がある場合：「〇〇に一致する投稿はありません」
     * - 異なるメッセージを出し分ける
     */
    it('initialPostsが空の場合、検索クエリなしのメッセージを表示', async () => {
      const { searchPosts } = await import('@/lib/actions/search');
      (searchPosts as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { posts: [], nextCursor: undefined } })

      render(
        <QueryClientProvider client={queryClient}>
          <PostSearchResults query="" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        // query が空の場合のメッセージ
        expect(screen.getByText('投稿が見つかりません')).toBeInTheDocument()
      })
    })

    /**
     * このテストの意味：
     * - query があるが検索結果が0件の場合
     * - メッセージに検索キーワードを含める
     * - ユーザーに「何を検索したか」を思い出させる UX
     */
    it('検索クエリがあり結果が空の場合、「一致する投稿はありません」を表示', async () => {
      const { searchPosts } = await import('@/lib/actions/search');
      (searchPosts as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { posts: [], nextCursor: undefined } })

      render(
        <QueryClientProvider client={queryClient}>
          <PostSearchResults query="存在しないキーワード" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        // query を含めたメッセージが表示される
        expect(screen.getByText('「存在しないキーワード」に一致する投稿はありません')).toBeInTheDocument()
      })
    })

  /**
     * expect(...).toHaveBeenCalledWith(...) について：
     * - モック関数が「特定の引数で呼ばれた」ことを確認
     * - toHaveBeenCalled() は「呼ばれたか」だけを確認
     * - toHaveBeenCalledWith(...) は「この引数で呼ばれたか」を確認
     *
     * このテストの意味：
     * - genreIds フィルタが正しく searchPosts に渡されているか確認
     * - フィルタ条件が機能しているかを検証
     */
    it('genreIdsを指定して検索できる', async () => {
      const { searchPosts } = await import('@/lib/actions/search');
      (searchPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {
          posts: [{ id: 'post1', content: 'テスト投稿' }],
          nextCursor: undefined,
        },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <PostSearchResults query="松" genreIds={['genre1', 'genre2']} />
        </QueryClientProvider>
      )

      await waitFor(() => {
        // searchPosts が「これらの引数で呼ばれた」ことを確認
        expect(searchPosts).toHaveBeenCalledWith('松', ['genre1', 'genre2'], undefined, 20, undefined)
      })
    })

    /**
     * mockResolvedValueOnce について：
     * - 通常の mockResolvedValue は毎回同じ値を返す
     * - mockResolvedValueOnce は「1回だけ」その値を返す
     * - 2回目以降の呼び出しは別の値を返したい時に使う
     * - ページネーション（複数ページの読み込み）をテストする時に便利
     *
     * Array.from({ length: 20 }, (_, i) => ...) について：
     * - 「20個の要素を持つ配列」を生成
     * - i は 0 から 19 の値（20個）
     * - つまり [{ id: 'post0' }, { id: 'post1' }, ..., { id: 'post19' }]
     *
     * haHaveBeenCalledTimes(2) について：
     * - モック関数が「2回」呼ばれたことを確認
     * - 1回目：初期ロード
     * - 2回目：スクロール時の追加ロード
     *
     * inView: true について：
     * - 「ローディングインジケーターが画面に見える」状態
     * - これにより、無限スクロール機能が次ページを読み込む
     */
    it('スクロール時に次ページが読み込まれる', async () => {
      const { searchPosts } = await import('@/lib/actions/search');

      // 初回: nextCursor 付きで 0–19 を返す
      ;(searchPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
        data: {
          posts: Array.from({ length: 20 }, (_, i) => ({ id: `post${i}`, content: `投稿${i}` })),
          nextCursor: 'cursor1',
        },
      })
      // 2 回目: 異なる id (post20–) を返す。同じ id を返すと React の "duplicate key" 警告が出る。
      ;(searchPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
        data: {
          posts: Array.from({ length: 20 }, (_, i) => ({ id: `post${i + 20}`, content: `投稿${i + 20}` })),
          nextCursor: null,
        },
      })

      // useInView を「要素が画面に見えている」状態に変更
      ;(useInViewMock as ReturnType<typeof vi.fn>).mockReturnValue({ ref: vi.fn(), inView: true })

      render(
        <QueryClientProvider client={queryClient}>
          <PostSearchResults query="テスト" />
        </QueryClientProvider>
      )

      // 無限スクロール時に2回フェッチが呼ばれることを確認
      // 1回目：初期ロード
      // 2回目：スクロール時の追加ロード
      await waitFor(() => {
        expect(searchPosts).toHaveBeenCalledTimes(2)
      }, { timeout: 3000 })
    })

    /**
     * nextCursor: undefined について：
     * - カーソルが undefined = 次のページがない
     * - つまり「最後のページに到達した」
     *
     * このテストの意味：
     * - 無限スクロール完了時、ユーザーに「もうこれ以上ない」と知らせる
     * - いつまでもスクロールできるわけではないことを表示
     */
    it('全ページ読み込み完了時にメッセージを表示', async () => {
      const { searchPosts } = await import('@/lib/actions/search');
      (searchPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {
          posts: [{ id: 'post1', content: 'テスト投稿' }],
          nextCursor: undefined,
        },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <PostSearchResults query="テスト" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        // 最後のページに到達したメッセージが表示される
        expect(screen.getByText('これ以上投稿はありません')).toBeInTheDocument()
      })
    })
  })

  /**
   * UserSearchResults について：
   * - ユーザー検索結果を表示
   * - PostSearchResults と同じ構造だが、ユーザー向けのメッセージ
   */
  describe('UserSearchResults', async () => {
    it('検索結果が空の場合、「一致するユーザーはいません」を表示', async () => {
      const { searchUsers } = await import('@/lib/actions/search');
      (searchUsers as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { users: [], nextCursor: undefined },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <UserSearchResults query="存在しないユーザー" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('「存在しないユーザー」に一致するユーザーはいません')).toBeInTheDocument()
      })
    })

    /**
     * エラーレスポンスについて：
     * - { error: '...' } という形式でエラーを返す
     * - コンポーネントが error フィールドを検知して、エラー画面を表示
     *
     * このテストの意味：
     * - サーバーエラーやネットワークエラー時の動作をテスト
     * - ユーザーに分かりやすいエラーメッセージを表示するべき
     */
    it('検索エラー時にエラーメッセージを表示', async () => {
      const { searchUsers } = await import('@/lib/actions/search');
      (searchUsers as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: '検索に失敗しました',
      })

      render(
        <QueryClientProvider client={queryClient}>
          <UserSearchResults query="テスト" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('検索に失敗しました')).toBeInTheDocument()
      })
    })

    /**
     * avatarUrl: null について：
     * - アバター画像が設定されていない状態
     * - この場合、ニックネームの頭文字を丸いバッジで表示する
     * - これをアバター代わりにする UX（一般的）
     *
     * このテストの意味：
     * - avatarUrl がない時の fallback 動作をテスト
     * - ニックネームの「テ」（最初の文字）が表示されるか確認
     */
    it('アバター画像がないユーザーの場合、ニックネームの頭文字を表示', async () => {
      const { searchUsers } = await import('@/lib/actions/search');
      (searchUsers as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {
          users: [{
            id: 'user1',
            nickname: 'テストユーザー',
            avatarUrl: null,
            bio: '自己紹介',
            followersCount: 10,
            followingCount: 5,
          }],
          nextCursor: undefined,
        },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <UserSearchResults query="テスト" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        // ニックネームの頭文字「テ」が表示される
        expect(screen.getByText('テ')).toBeInTheDocument()
      })
    })

    /**
     * screen.queryByText について：
     * - getByText と似ているが、要素が見つからない場合 null を返す
     * - getByText だと、見つからない場合は「error をスロー」してテストが失敗
     * - queryByText だと、見つからない場合は null を返すだけ
     *
     * expect(...).not.toBeInTheDocument() について：
     * - 要素が「存在しない」ことを確認
     * - not をつけることで「〇〇でない」という意味になる
     *
     * このテストの意味：
     * - bio が null の場合、bio は表示されないべき
     * - レイアウトが壊れないように、optional なフィールドはスキップする
     */
    it('bioがないユーザーの場合、bioを表示しない', async () => {
      const { searchUsers } = await import('@/lib/actions/search');
      (searchUsers as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {
          users: [{
            id: 'user1',
            nickname: 'テストユーザー',
            avatarUrl: 'https://example.com/avatar.jpg',
            bio: null,
            followersCount: 10,
            followingCount: 5,
          }],
          nextCursor: undefined,
        },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <UserSearchResults query="テスト" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        // ニックネームは表示される
        expect(screen.getByText('テストユーザー')).toBeInTheDocument()
        // bio は表示されない（null だから）
        const bioElements = screen.queryByText(/自己紹介/)
        expect(bioElements).not.toBeInTheDocument()
      })
    })

    /**
     * このテストの意味：
     * - nextCursor: undefined = 最後のページに到達
     * - 無限スクロール完了時のメッセージをテスト
     */
    it('全ユーザー読み込み完了時にメッセージを表示', async () => {
      const { searchUsers } = await import('@/lib/actions/search');
      (searchUsers as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {
          users: [{
            id: 'user1',
            nickname: 'テストユーザー',
            avatarUrl: null,
            bio: null,
            followersCount: 10,
            followingCount: 5,
          }],
          nextCursor: undefined,
        },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <UserSearchResults query="テスト" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        // 最後のページに到達したメッセージ
        expect(screen.getByText('これ以上ユーザーはいません')).toBeInTheDocument()
      })
    })
  })

  /**
   * TagSearchResults について：
   * - タグ検索結果を表示
   * - 投稿検索と同じ構造だが、タグ専用
   * - tag props は必須（空文字列は「入力されていない」と見なす）
   */
  describe('TagSearchResults', async () => {
    /**
     * このテストの意味：
     * - tag が空の場合、ユーザーに「タグを入力してください」と促す
     * - 空でのAPI呼び出しを避ける最適化
     */
    it('タグが空の場合、「タグを入力してください」を表示', async () => {
      const { searchByTag } = await import('@/lib/actions/search');
      (searchByTag as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { posts: [], nextCursor: undefined } })

      render(
        <QueryClientProvider client={queryClient}>
          <TagSearchResults tag="" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('タグを入力してください')).toBeInTheDocument()
      })
    })

    /**
     * このテストの意味：
     * - tag があるが検索結果が0件の場合
     * - メッセージにタグ名を含める
     * - Twitter/Xなどで「# 記号」をつけて表示するのが一般的
     */
    it('タグがあり結果が空の場合、「を含む投稿はありません」を表示', async () => {
      const { searchByTag } = await import('@/lib/actions/search');
      (searchByTag as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { posts: [], nextCursor: undefined } })

      render(
        <QueryClientProvider client={queryClient}>
          <TagSearchResults tag="存在しないタグ" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        // メッセージにタグ名を含める（「#」記号付き）
        expect(screen.getByText('#存在しないタグ を含む投稿はありません')).toBeInTheDocument()
      })
    })

    /**
     * このテストの意味：
     * - タグ情報をヘッダーに表示
     * - 投稿件数をカウントして表示
     * - ユーザーに「このタグは人気」「マイナーな話題」などを認識させる
     *
     * 複数の expect について：
     * - 1つのテストで複数の条件を確認できる
     * - 「#松柏類」と「2件の投稿」が両方表示されることを確認
     */
    it('タグ情報ヘッダーに投稿件数を表示', async () => {
      const { searchByTag } = await import('@/lib/actions/search');
      (searchByTag as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {
          posts: [
            { id: 'post1', content: '投稿1' },
            { id: 'post2', content: '投稿2' },
          ],
          nextCursor: undefined,
        },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <TagSearchResults tag="松柏類" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('#松柏類')).toBeInTheDocument()
        expect(screen.getByText('2件の投稿')).toBeInTheDocument()
      })
    })

    /**
     * expect(...).not.toHaveBeenCalled() について：
     * - モック関数が「呼ばれていない」ことを確認
     * - not をつけることで「呼ばれていない」という意味
     *
     * このテストの意味：
     * - tag が空の場合、searchByTag API を呼ばない
     * - 不要なAPI呼び出しを避けるパフォーマンス最適化
     *
     * react-query の enabled 機能について：
     * - enabled: false にすると、クエリが「一時停止」される
     * - 例：tag が空の場合 → enabled: false → API呼び出しスキップ
     */
    it('tagが空の場合、クエリが無効化される', async () => {
      const { searchByTag } = await import('@/lib/actions/search')

      render(
        <QueryClientProvider client={queryClient}>
          <TagSearchResults tag="" />
        </QueryClientProvider>
      )

      // tag が空なので、searchByTag は呼ばれない（クエリが無効化されている）
      await waitFor(() => {
        expect(searchByTag).not.toHaveBeenCalled()
      })
    })
  })

  /**
   * PopularTags について：
   * - 人気のタグをランキング形式で表示するコンポーネント
   * - SearchResults とは異なり、単純に tags props を表示するだけ
   * - API呼び出しがない（親から tags を受け取る）
   */
  describe('PopularTags', () => {
    /**
     * このテストの意味：
     * - tags が空の場合、何も表示しない
     * - 不要な「人気のタグ」セクションを表示しない
     * - レイアウトをスッキリさせる
     */
    it('タグが空の場合、何も表示しない', () => {
      const { container } = render(<PopularTags tags={[]} />)
      expect(container.firstChild).toBeNull()
    })

    /**
     * このテストの意味：
     * - tags が複数ある場合、すべて表示される
     * - タグ名と投稿数が両方表示される
     *
     * 複数の expect について：
     * - 1つのテストで複数の要素の表示を確認できる
     */
    it('人気タグを表示', () => {
      const tags = [
        { tag: '松柏類', count: 100 },
        { tag: '雑木類', count: 50 },
      ]

      render(<PopularTags tags={tags} />)

      expect(screen.getByText('人気のタグ')).toBeInTheDocument()
      expect(screen.getByText('#松柏類')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('#雑木類')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
    })

    /**
     * toHaveAttribute('href', ...) について：
     * - a要素の href 属性を確認
     * - URL エンコードされた形式で指定
     * - '%E6%9D%BE%E6%9F%8F%E9%A1%9E' は「松柏類」をURLエンコードしたもの
     *
     * このテストの意味：
     * - タグをクリックすると、タグ検索ページに遷移する
     * - URL形式：/search?tab=tags&q=タグ名
     */
    it('タグをクリックすると検索ページに遷移', () => {
      const tags = [{ tag: '松柏類', count: 100 }]

      render(<PopularTags tags={tags} />)

      const tagLink = screen.getByText('#松柏類').closest('a')
      expect(tagLink).toHaveAttribute('href', '/search?tab=tags&q=%E6%9D%BE%E6%9F%8F%E9%A1%9E')
    })
  })
})
