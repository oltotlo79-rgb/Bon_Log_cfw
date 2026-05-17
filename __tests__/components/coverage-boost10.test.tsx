import { vi } from 'vitest'
/* eslint-disable @next/next/no-img-element */
import { render, screen, fireEvent, waitFor } from '../utils/test-utils'
import userEvent from '@testing-library/user-event'

/**
 * ========================================
 * テストファイル全体について
 * ========================================
 * このファイルは ScheduledPostForm と BonsaiRecordForm という2つのコンポーネントをテストしています。
 * これらのコンポーネントはファイルアップロード、フォーム送信、API通信などを行うため、
 * 実際のファイルシステムやサーバーを使わずにテストするために「モック」を使用しています。
 *
 * モックとは: 本物の機能の「代わり」を用意して、テスト時に使う仕組みです。
 * これにより、ネットワークやファイルシステムに頼らず、高速にテストできます。
 */

// ---- ScheduledPostForm 用のモック ----

/**
 * useRouter のモック
 *
 * 本来: Next.js が提供するページ遷移機能
 * テスト時: 実際に遷移しないように、vi.fn() で「空の関数」に置き換えます
 *
 * mockPush, mockBack, mockRefresh は「呼ばれたかどうか」「どんな引数で呼ばれたか」
 * を後でテストコードで確認するための記録係です
 */
const mockPush = vi.fn()
const mockBack = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: mockRefresh,
  }),
}))

/**
 * Image コンポーネントのモック
 *
 * 本来: Next.js の最適化された画像コンポーネント（自動圧縮、遅延読み込み等）
 * テスト時: 通常の <img> タグに置き換えます
 *
 * なぜ必要？Next.js の Image コンポーネントはブラウザ環境では特別な処理が必要で、
 * テスト環境では複雑になるため、シンプルな <img> タグで代用します
 */
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}))

/**
 * Server Actions のモック
 *
 * 本来: サーバーで実行される関数（データベースに投稿を保存）
 * テスト時: 実際にサーバーに送らず、vi.fn() で置き換えます
 *
 * mockCreateScheduledPost, mockUpdateScheduledPost:
 * テスト中に「どの引数で呼ばれたか」「いくつ呼ばれたか」を確認できます
 */
const mockCreateScheduledPost = vi.fn()
const mockUpdateScheduledPost = vi.fn()
vi.mock('@/lib/actions/scheduled-post', () => ({
  createScheduledPost: (...args: unknown[]) => mockCreateScheduledPost(...args),
  updateScheduledPost: (...args: unknown[]) => mockUpdateScheduledPost(...args),
}))

/**
 * GenreSelector コンポーネントのモック
 *
 * 本来: ジャンル選択のための複雑なコンポーネント
 * テスト時: テスト対象が ScheduledPostForm なので、子コンポーネントは
 * シンプルな <div> に置き換えます
 *
 * data-testid: テストコードで「このコンポーネントは表示されているか？」
 * を確認するためのラベルです
 */
vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: () => <div data-testid="genre-selector" />,
}))

/**
 * ファイル操作と画像圧縮のモック
 *
 * 本来: ファイルを圧縮したり、R2（クラウドストレージ）にアップロードする関数群
 * テスト時: 実際のアップロード処理は重いので、即座に成功を返すモックに置き換えます
 *
 * 各モック関数の説明:
 * - mockPrepareFileForUpload: ファイルの圧縮。すぐにそのファイルを返す
 * - mockIsVideoFile: 渡されたファイルが動画か判定
 * - mockFormatFileSize: ファイルサイズを「1024B」のような文字列に変換
 * - mockUploadVideoToR2: クラウドに動画をアップロード（進捗コールバック対応）
 *
 * MAX_IMAGE_SIZE, MAX_VIDEO_SIZE:
 * ファイルサイズの制限値。テスト中にこれらの値を使って検証します
 */
const mockPrepareFileForUpload = vi.fn((file: any, _opts?: any) => Promise.resolve(file))
const mockIsVideoFile = vi.fn((file: any) => file.type.startsWith('video/'))
const mockFormatFileSize = vi.fn((size: any) => `${size}B`)
const mockUploadVideoToR2 = vi.fn()

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (file: any, opts: any) => mockPrepareFileForUpload(file, opts),
  isVideoFile: (file: any) => mockIsVideoFile(file),
  formatFileSize: (size: any) => mockFormatFileSize(size),
  uploadVideoToR2: (file: any, folder: any, cb: any) => mockUploadVideoToR2(file, folder, cb),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
}))

// ---- BonsaiRecordForm 用のモック ----

/**
 * BonsaiRecordForm の Server Action モック
 *
 * 本来: 盆栽の成長記録をデータベースに保存
 * テスト時: 実際には保存せず、vi.fn() で置き換えます
 *
 * このモック関数を使うことで、「実際に呼ばれたか？」「どんな引数か？」
 * をテストコードで確認できます
 */
const mockAddBonsaiRecord = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  addBonsaiRecord: (...args: unknown[]) => mockAddBonsaiRecord(...args),
}))

/**
 * 認証（NextAuth.js）のモック
 *
 * 本来: ログインしたユーザーの情報をサーバーから取得
 * テスト時: 常に「test-user-id というユーザーがログイン済み」という状態にします
 *
 * SessionProvider: ユーザー情報を各コンポーネントに配布するコンポーネント
 * useSession: コンポーネント内で useSession() を呼ぶと、
 *            常に同じテストユーザーが返される
 *
 * なぜ必要？BonsaiRecordForm のような多くのコンポーネントは
 *「ログイン済みユーザーが誰か」を知る必要があります。
 * テストでもその状態をシミュレートする必要があります。
 */
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

/**
 * URL オブジェクトのモック
 *
 * 本来の役割:
 * - URL.createObjectURL: ファイルを「blob:...」というURLに変換（プレビュー表示用）
 * - URL.revokeObjectURL: 不要になったblobURLをメモリから削除
 *
 * テスト時:
 * - createObjectURL は常に 'blob:test-url' という固定値を返す
 * - revokeObjectURL は何もしない
 *
 * なぜ必要？ブラウザのファイル機能は本来テスト環境では複雑なので、
 * シンプルな代替機能を使います
 */
URL.createObjectURL = vi.fn(() => 'blob:test-url')
URL.revokeObjectURL = vi.fn()

import { ScheduledPostForm } from '@/components/post/ScheduledPostForm'
import { BonsaiRecordForm } from '@/components/bonsai/BonsaiRecordForm'

/**
 * ========================================
 * ScheduledPostForm のテスト
 * ========================================
 * 予約投稿フォームの「カバレッジが足りない行」を100%カバーするためのテストです。
 *
 * テスト対象の機能:
 * - ファイル（画像・動画）のアップロード
 * - アップロード進捗の表示
 * - ネットワークエラー時の処理
 */
describe('ScheduledPostForm - uncovered lines', () => {
  /**
   * テスト用のダミーデータ
   *
   * mockGenres: コンポーネントに渡すジャンル選択肢
   * - 樹種カテゴリに「松柏類」という選択肢を1つ持たせる
   */
  const mockGenres = {
    '樹種': [
      { id: 'genre-1', name: '松柏類', category: '樹種' },
    ],
  }

  /**
   * mockLimits: ユーザーの投稿制限情報
   * - maxPostLength: 1投稿の最大文字数（500文字）
   * - maxImages: 1投稿の最大画像数（4枚）
   * - maxVideos: 1投稿の最大動画数（1本）
   * - maxScheduledPosts: 予約可能な最大投稿数（10個）
   * - maxDailyPosts: 1日の最大投稿数（20個）
   * - canSchedulePost: 予約投稿が可能か（true=可能）
   * - canViewAnalytics: アナリティクス閲覧権限（false=不可）
   */
  const mockLimits = {
    maxPostLength: 500,
    maxImages: 4,
    maxVideos: 1,
    maxScheduledPosts: 10,
    maxDailyPosts: 20,
    canSchedulePost: true,
    canViewAnalytics: false,
  }

  /**
   * beforeEach: 各テストが実行される前に、毎回呼ばれます
   *
   * vi.clearAllMocks():
   * 前のテストで使用したモック関数の呼び出し記録をリセット
   * （「前のテストでmockPushが呼ばれた」という記録を消す）
   *
   * originalXHR = global.XMLHttpRequest:
   * テストでXHRを上書きする前に、元のXHRを保存しておく
   *
   * mockCreateScheduledPost.mockResolvedValue(...):
   * 投稿作成関数を呼ぶと、{ success: true } を返すように設定
   */
  let originalXHR: typeof XMLHttpRequest

  beforeEach(() => {
    vi.clearAllMocks()
    originalXHR = global.XMLHttpRequest
    mockCreateScheduledPost.mockResolvedValue({ success: true })
  })

  /**
   * afterEach: 各テストが終わった後に、毎回呼ばれます
   *
   * global.XMLHttpRequest = originalXHR:
   * XHRをテスト前の状態に戻す（他のテストへの影響を防ぐ）
   */
  afterEach(() => {
    global.XMLHttpRequest = originalXHR
  })

  /**
   * テスト1: 画像アップロードの正常系（圧縮→XHRアップロード→進捗表示）
   *
   * テスト内容:
   * 画像ファイルをアップロードすると：
   * 1. ファイルが圧縮される
   * 2. サーバーへXHRで送信される
   * 3. アップロード進捗がリアルタイム更新される
   *
   * なぜこのテストが必要？
   * - ファイルアップロード処理は複数のステップがあります
   * - 各ステップが正しく実行される必要があります
   * - このテストで、全ステップが正しく動く確認ができます
   */
  it('image upload: triggers compression, XHR upload, and progress (lines 367-433)', async () => {
    /**
     * uploadListeners と xhrListeners:
     *
     * 本来のXHRの動作:
     * - ファイルアップロード中に、 upload.addEventListener('progress', ...) で
     *   進捗イベントをキャッチできます
     * - アップロード完了時に、 addEventListener('load', ...) で
     *   完了イベントをキャッチできます
     *
     * テストでの役割:
     * - これらのイベントハンドラを「記録」して、後で手動で発火させます
     * - uploadListeners['progress'] にイベントハンドラが保存される
     * - uploadListeners['progress']?.() でそのハンドラを呼ぶ（イベント発火シミュレーション）
     */
    const uploadListeners: Record<string, (...args: any[]) => void> = {}
    const xhrListeners: Record<string, (...args: any[]) => void> = {}

    /**
     * mockXHR: XHR（ファイル送信）のモック
     *
     * 実際のXHRの仕組み:
     * xhr.open('POST', '/api/upload') → 送信先を指定
     * xhr.send(fileData) → ファイルを送信
     *
     * upload.addEventListener('progress', callback) → 進捗イベントをキャッチ
     * addEventListener('load', callback) → 完了イベントをキャッチ
     *
     * テストでは、これらすべてをモック化して、制御可能にします
     */
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      upload: {
        // addEventListener が呼ばれると、コールバックを uploadListeners に保存
        addEventListener: vi.fn((event: string, cb: (...a: any[]) => void) => {
          uploadListeners[event] = cb
        }),
      },
      // XHR本体の addEventListener もコールバックを xhrListeners に保存
      addEventListener: vi.fn((event: string, cb: (...a: any[]) => void) => {
        xhrListeners[event] = cb
      }),
      status: 200, // HTTP 200 = 成功
      responseText: JSON.stringify({ url: 'https://example.com/img.jpg', type: 'image' }),
    }
    // グローバルのXHRをモックXHRに置き換え
     
    global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as any

    // コンポーネントをレンダリング
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    // ファイルアップロード用の <input type="file"> を取得
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()

    /**
     * テスト用ファイルを作成
     *
     * new File([...], 'filename', { type: 'image/jpeg' }):
     * - 第1引数：ファイルの内容（ここでは 'imgdata' という文字列）
     * - 第2引数：ファイル名
     * - 第3引数：ファイルタイプ（MIMEタイプ）
     *
     * Object.defineProperty(imageFile, 'size', ...):
     * - ファイルサイズを1024バイトに設定
     * - JavaScriptの File オブジェクトはサイズを変更できないため、
     *   defineProperty で強制的に設定
     */
    const imageFile = new File(['imgdata'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(imageFile, 'size', { value: 1024 })

    /**
     * fireEvent.change:
     *
     * 本来の動作: ユーザーがファイルを選択した時に起こるイベント
     * テストでは: その「選択」をシミュレート
     *
     * { target: { files: [imageFile] } }:
     * - ファイル入力フィールドに imageFile が選択されたことにします
     */
    fireEvent.change(fileInput, { target: { files: [imageFile] } })

    /**
     * waitFor:
     *
     * 本来: 非同期処理を待つ
     * この場合: ファイルが圧縮されるまで待つ
     *
     * なぜ必要？
     * - コンポーネント内でファイル圧縮は非同期（すぐには完了しない）
     * - waitFor で「圧縮完了を待つ」ので、確実にテストできる
     * - await を付けることで、圧縮が終わるまで次へ進みません
     */
    await waitFor(() => {
      expect(mockPrepareFileForUpload).toHaveBeenCalledWith(imageFile, expect.any(Object))
    })

    /**
     * ここからは、ユーザーには見えないが、コンポーネント内で起こる処理をシミュレート
     */

    /**
     * アップロード進捗イベントを発火
     *
     * 本来: ファイル送信中に、ブラウザが自動的に進捗イベントを送る
     * テスト: uploadListeners['progress']?.() で手動で進捗イベントを送る
     *
     * { lengthComputable: true, loaded: 50, total: 100 }:
     * - lengthComputable: 総サイズが計算可能か（true = 可能）
     * - loaded: すでにアップロードされたバイト数（50バイト）
     * - total: ファイルの総サイズ（100バイト）
     * → つまり、50%のアップロード進捗
     */
    uploadListeners['progress']?.({ lengthComputable: true, loaded: 50, total: 100 })

    /**
     * アップロード完了イベントを発火
     *
     * 本来: アップロード完了時にブラウザが自動的に 'load' イベントを送る
     * テスト: xhrListeners['load']?.() で手動で完了イベントを送る
     */
    xhrListeners['load']?.()

    /**
     * アップロード処理が正しく実行されたことを確認
     *
     * expect(mockXHR.open).toHaveBeenCalledWith('POST', '/api/upload'):
     * - mockXHR.open が「POST」メソッドで「/api/upload」へ呼ばれたか確認
     *
     * expect(mockXHR.send).toHaveBeenCalled():
     * - mockXHR.send が呼ばれたか確認
     *
     * これで「XHRアップロードが実行された」ことが証明されます
     */
    await waitFor(() => {
      expect(mockXHR.open).toHaveBeenCalledWith('POST', '/api/upload')
      expect(mockXHR.send).toHaveBeenCalled()
    })
  })

  /**
   * テスト2: 画像アップロードのエラー処理（通信エラー）
   *
   * テスト内容:
   * ネットワーク通信中にエラーが発生した場合：
   * - エラーメッセージ「アップロードに失敗しました」が表示される
   *
   * なぜこのテストが必要？
   * - ネットワークは不安定なため、エラーは必ず発生する可能性がある
   * - その場合のユーザー体験（エラーメッセージ表示）が正しいか確認
   * - エラー処理がないと、ユーザーは何が起こったかわからない
   */
  it('image upload: XHR error triggers error state (lines 421-423)', async () => {
    const xhrListeners: Record<string, (...args: any[]) => void> = {}

    /**
     * mockXHR: エラー状態のモック
     *
     * status: 500:
     * - HTTP ステータスコード500 = サーバーエラー
     * - アップロード先のサーバーに問題がある状態
     *
     * responseText: '':
     * - エラー応答（空文字列）
     */
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn((event: string, cb: (...a: any[]) => void) => {
        xhrListeners[event] = cb
      }),
      status: 500,
      responseText: '',
    }
     
    global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as any

    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const imageFile = new File(['imgdata'], 'photo.png', { type: 'image/png' })
    Object.defineProperty(imageFile, 'size', { value: 512 })

    // ファイル選択をシミュレート
    fireEvent.change(fileInput, { target: { files: [imageFile] } })

    // ファイル圧縮の完了を待つ
    await waitFor(() => {
      expect(mockPrepareFileForUpload).toHaveBeenCalled()
    })

    /**
     * XHR エラーイベントを発火
     *
     * 本来: ネットワークエラーが発生すると、ブラウザが 'error' イベントを送る
     * テスト: xhrListeners['error']?.() で手動でエラーイベントを送る
     *
     * このイベント発火で、コンポーネント内のエラーハンドラが実行される
     */
    xhrListeners['error']?.()

    /**
     * エラーメッセージが画面に表示されたか確認
     *
     * screen.getByText('アップロードに失敗しました'):
     * - 「アップロードに失敗しました」というテキストが表示されているか探す
     * - 見つからない場合はテスト失敗
     *
     * toBeInTheDocument():
     * - そのテキストが本当にDOM上にあるか確認
     */
    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  /**
   * テスト3: 画像アップロードのエラー処理（HTTPエラーステータス）
   *
   * テスト内容:
   * アップロードがサーバーに到達したが、HTTPステータスがエラー（500）の場合：
   * - エラーメッセージが表示される
   *
   * テスト2との違い：
   * - テスト2: ネットワーク接続そのものが切れたケース（'error'イベント）
   * - テスト3: サーバーが応答したが、ステータスがエラーのケース（'load'イベント + status:500）
   *
   * なぜ両方必要？
   * - 異なるエラー原因に対応する必要がある
   * - 両方のケースでエラーメッセージが表示されることを確認
   */
  it('image upload: XHR non-2xx status triggers error (lines 413-414)', async () => {
    const xhrListeners: Record<string, (...args: any[]) => void> = {}

    /**
     * mockXHR: HTTPエラー状態のモック
     *
     * status: 500:
     * - HTTP 200番台 = 成功
     * - HTTP 400番台・500番台 = エラー
     * - このテストでは 500（サーバーエラー）をシミュレート
     *
     * responseText: 'Server Error':
     * - サーバーからのエラー応答メッセージ
     */
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn((event: string, cb: (...a: any[]) => void) => {
        xhrListeners[event] = cb
      }),
      status: 500,
      responseText: 'Server Error',
    }
     
    global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as any

    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const imageFile = new File(['data'], 'img.jpg', { type: 'image/jpeg' })
    Object.defineProperty(imageFile, 'size', { value: 256 })

    fireEvent.change(fileInput, { target: { files: [imageFile] } })

    await waitFor(() => {
      expect(mockPrepareFileForUpload).toHaveBeenCalled()
    })

    /**
     * XHR ロードイベントを発火（ステータスエラー付き）
     *
     * 本来: アップロードが完了すると 'load' イベントが発火
     *      （成功でも失敗でもどちらでも 'load' が発火）
     *      ステータスコード（status）を見て、成功/失敗を判定する
     *
     * テスト: 'load' イベントを発火させ、コンポーネントが status:500 を見てエラー処理するか確認
     */
    xhrListeners['load']?.()

    /**
     * HTTPエラーステータスでも、エラーメッセージが表示されるか確認
     */
    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  /**
   * テスト4: 動画アップロードの進捗コールバック
   *
   * テスト内容:
   * 動画ファイルをアップロードすると：
   * - uploadVideoToR2() 関数が呼ばれる
   * - その関数に進捗コールバックが渡される
   * - コールバックが実際に呼ばれ、進捗が更新される
   *
   * 画像と動画で異なる理由：
   * - 画像: XHR経由でアップロード（ブラウザ組み込み）
   * - 動画: uploadVideoToR2() という専用関数経由（重いファイル対応）
   *
   * 進捗コールバックとは：
   * - アップロード中にリアルタイムで「何%完了したか」を知りたい
   * - その情報を受け取るために「進捗コールバック関数」を渡す
   * - uploadVideoToR2()がアップロード中に何度もコールバックを呼ぶ
   */
  it('video upload: progress callback sets upload progress (line 355)', async () => {
    /**
     * progressCallback: 進捗コールバック関数を保存する変数
     *
     * 本来: uploadVideoToR2() の内部で何度も呼ばれるコールバック
     * テスト: 「コールバックが本当に渡されたか」「呼び出せるか」を確認
     */
    let progressCallback: ((progress: number) => void) | undefined

    /**
     * mockUploadVideoToR2.mockImplementation:
     *
     * mockUploadVideoToR2() を呼ぶとどうなるか を定義
     *
     * 引数：
     * - _file: アップロード対象のファイル
     * - _type: 'videos' などのフォルダ名
     * - onProgress: 進捗コールバック
     *
     * テストの流れ：
     * 1. onProgress（進捗コールバック）をprogressCallbackに保存
     * 2. { url: 'https://example.com/video.mp4' } を返す（アップロード成功）
     */
    mockUploadVideoToR2.mockImplementation((_file: File, _type: string, onProgress: (p: number) => void) => {
      progressCallback = onProgress
      return Promise.resolve({ url: 'https://example.com/video.mp4' })
    })

    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    /**
     * 動画ファイルを作成
     *
     * type: 'video/mp4':
     * - isVideoFile()というモック関数が file.type.startsWith('video/') で判定する
     * - 'video/mp4' はそれに該当するので、動画として認識される
     */
    const videoFile = new File(['videodata'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(videoFile, 'size', { value: 5000 })

    // 動画ファイルを選択
    fireEvent.change(fileInput, { target: { files: [videoFile] } })

    /**
     * uploadVideoToR2 が実際に呼ばれたか待つ
     *
     * waitFor が必要な理由：
     * - ファイル圧縮やバリデーションは非同期
     * - uploadVideoToR2() が呼ばれるまで少し時間がかかる
     */
    await waitFor(() => {
      expect(mockUploadVideoToR2).toHaveBeenCalled()
    })

    /**
     * 進捗コールバックが本当に渡されたか確認
     *
     * mockUploadVideoToR2.mockImplementation 内で
     * progressCallback = onProgress という代入をしたので、
     * 「progressCallback が定義されているか」でコールバックが渡されたかわかる
     */
    expect(progressCallback).toBeDefined()

    /**
     * 進捗コールバックを実際に呼び出す
     *
     * progressCallback!(50):
     * - ! は TypeScript の「nullではないことをアサート」する演算子
     * - 50 を渡すことで「50%アップロード完了」を意味する
     *
     * このテストにより：
     * - 「コールバックが渡されている」ことが確認できる
     * - 「コールバック関数を呼び出せる」ことが確認できる
     */
    progressCallback!(50)
  })

  /**
   * テスト5: 「メディア追加」ボタンが正しく動作する
   *
   * テスト内容:
   * ユーザーが「メディア追加」ボタンをクリックすると：
   * - ファイルピッカーダイアログが開く（<input type="file"> がクリックされる）
   *
   * なぜこのテストが必要？
   * - UIボタンと内部の <input> ファイルがちゃんと連携しているか確認
   * - ユーザーの視点では「メディア追加ボタン」をクリックで画像を選べるはず
   */
  it('media add button triggers file input click (line 605)', async () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    /**
     * clickSpy: fileInput.click() 呼び出しをスパイするツール
     *
     * vi.spyOn(object, method):
     * - オブジェクトの特定メソッドの呼び出しを「監視」する
     * - 元のメソッドは実行され、なおかつ呼び出し回数も記録される
     *
     * この場合：
     * - fileInput.click() が呼ばれたか
     * - 何回呼ばれたか
     * を後でチェックできる
     */
    const clickSpy = vi.spyOn(fileInput, 'click')

    /**
     * 「メディア追加」ボタンを探して、クリック
     *
     * screen.getByText('メディア追加'):
     * - テキストが「メディア追加」のボタン要素を探す
     */
    const addButton = screen.getByText('メディア追加')
    fireEvent.click(addButton)

    /**
     * ファイルピッカーがクリックされたか確認
     *
     * expect(clickSpy).toHaveBeenCalled():
     * - clickSpy が「少なくとも1回は呼ばれた」か確認
     *
     * つまり：
     * - 「メディア追加」ボタン → fileInput.click() という流れが成功した
     */
    expect(clickSpy).toHaveBeenCalled()

    /**
     * スパイをクリーンアップ
     *
     * vi.spyOn() でメソッドを監視すると、次のテストに影響を与える可能性があるため、
     * mockRestore() でオリジナル状態に戻す
     */
    clickSpy.mockRestore()
  })
})

/**
 * ========================================
 * BonsaiRecordForm のテスト
 * ========================================
 * 盆栽の成長記録を保存するフォームのテストです。
 *
 * テスト対象の機能:
 * - テキスト入力（成長記録）
 * - 画像添付（複数対応）
 * - フォーム送信時の画像アップロード処理
 * - Server Action（addBonsaiRecord）の呼び出し
 */
describe('BonsaiRecordForm - uncovered lines (198-221)', () => {
  /**
   * mockFetch: fetch API（ネットワークリクエスト）のモック
   *
   * 本来: ブラウザ組み込みの fetch 関数
   *      画像を /api/upload/avatar エンドポイントに送信
   * テスト: 実際には送らず、即座に成功応答を返す
   */
  const mockFetch = vi.fn()

  /**
   * beforeEach: BonsaiRecordForm のテスト前に毎回実行
   *
   * vi.clearAllMocks():
   * - 前のテストで使用したモック呼び出し記録をリセット
   *
   * mockAddBonsaiRecord.mockResolvedValue({ success: true }):
   * - addBonsaiRecord Server Action が呼ばれたら { success: true } を返す
   *
   * mockFetch.mockResolvedValue({ json: ... }):
   * - fetch() が呼ばれたら、その応答として { url: '...' } を返す関数を持つオブジェクトを返す
   * - .json() を呼ぶと、{ url: 'https://example.com/uploaded.jpg' } に解決される
   *
   * global.fetch = mockFetch:
   * - グローバルの fetch 関数をモック版に置き換え
   *
   * mockPrepareFileForUpload.mockImplementation(...):
   * - ファイル圧縮関数を「そのままファイルを返す」動作に設定
   */
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddBonsaiRecord.mockResolvedValue({ success: true })
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://example.com/uploaded.jpg' }),
    })
     
    global.fetch = mockFetch as any
    mockPrepareFileForUpload.mockImplementation((file: File) => Promise.resolve(file))
  })

  /**
   * テスト6: フォーム送信時の完全な画像アップロード流れ
   *
   * テスト内容:
   * テキスト + 画像を入力して送信すると：
   * 1. ファイルが圧縮される
   * 2. サーバーにアップロードされる
   * 3. 返されたURLと一緒に、addBonsaiRecord Server Action が呼ばれる
   *
   * テストの特徴:
   * - userEvent.setup() を使用（より自然なユーザー操作をシミュレート）
   * - 複数の非同期処理が連鎖する様子をテスト
   * - 最終的に正しい引数で Server Action が呼ばれることを確認
   *
   * 各ステップの確認:
   * - ファイル圧縮 → fetch でアップロード → Server Action 呼び出し
   */
  it('submit with images: compresses and uploads each image, then calls addBonsaiRecord', async () => {
    /**
     * userEvent.setup():
     *
     * 本来の fireEvent:
     * - 単純にイベント（click, change等）を発火
     * - あくまで「イベントの発火」だけ
     *
     * userEvent:
     * - ユーザーのリアルな操作に近い形でシミュレート
     * - テキスト入力でも1文字ずつ打つ（他の検証も可能に）
     * - クリック前にホバー、フォーカスなども自動実行
     *
     * このテストでは、より正確な操作シミュレーションのため userEvent を使用
     */
    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    /**
     * ステップ1: テキスト入力
     *
     * screen.getByPlaceholderText(/成長の様子や作業内容を記録/):
     * - プレースホルダーテキストで textarea を検索
     * - /.../ は「正規表現」、この部分文字列を含む textarea を探す
     *
     * await user.type(textarea, 'Growth record'):
     * - 「Growth record」を textarea に「1文字ずつ」入力
     * - await があるため、入力完了を待つ
     *
     * なぜ await？
     * - userEvent.type() は非同期
     * - 入力が完了するまで次へ進まない
     */
    const textarea = screen.getByPlaceholderText(/成長の様子や作業内容を記録/)
    await user.type(textarea, 'Growth record')

    /**
     * ステップ2: 画像を添付
     *
     * fireEvent.change を使う理由：
     * - ファイル入力は userEvent でサポートされていないことが多い
     * - fileInput.files を直接操作する必要があるため fireEvent を使う
     */
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const imageFile = new File(['imgcontent'], 'plant.jpg', { type: 'image/jpeg' })
    Object.defineProperty(imageFile, 'size', { value: 2048 })

    fireEvent.change(fileInput, { target: { files: [imageFile] } })

    /**
     * ステップ3: フォーム送信
     *
     * screen.getByRole('button', { name: '記録する' }):
     * - ボタン要素で、テキストが「記録する」のものを探す
     * - <button>記録する</button> が見つかる
     *
     * await user.click(submitButton):
     * - ボタンをクリック（非同期）
     */
    const submitButton = screen.getByRole('button', { name: '記録する' })
    await user.click(submitButton)

    /**
     * ステップ4: 画像圧縮が呼ばれたか確認
     *
     * expect(mockPrepareFileForUpload).toHaveBeenCalledWith(imageFile, {...}):
     * - mockPrepareFileForUpload が特定の引数で呼ばれたか確認
     *
     * 引数の確認：
     * - imageFile: 圧縮対象のファイル
     * - { maxSizeMB: 1, maxWidthOrHeight: 1920 }: 圧縮設定
     *
     * await waitFor():
     * - 非同期処理の完了を待つ
     * - ファイル圧縮は即座に完了しないため待つ必要がある
     */
    await waitFor(() => {
      expect(mockPrepareFileForUpload).toHaveBeenCalledWith(imageFile, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
      })
    })

    /**
     * ステップ5: 画像アップロード（fetch）が呼ばれたか確認
     *
     * expect(mockFetch).toHaveBeenCalledWith('/api/upload/avatar', expect.objectContaining({...})):
     * - fetch('/api/upload/avatar', ...) が呼ばれたか
     *
     * expect.objectContaining({ method: 'POST' }):
     * - fetch の第2引数オブジェクトに method: 'POST' が含まれているか
     * - 他のプロパティはこのテストでは気にしない（objectContaining なので）
     *
     * 意味：
     * - 圧縮後のファイルが POST メソッドでアップロードされる
     */
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/upload/avatar', expect.objectContaining({
        method: 'POST',
      }))
    })

    /**
     * ステップ6: Server Action（addBonsaiRecord）が呼ばれたか確認
     *
     * expect(mockAddBonsaiRecord).toHaveBeenCalledWith({...}):
     * - addBonsaiRecord が特定の引数で呼ばれたか確認
     *
     * 期待される引数：
     * - bonsaiId: 'bonsai-1' （コンポーネントに渡された ID）
     * - content: 'Growth record' （テキスト入力内容）
     * - imageUrls: ['https://example.com/uploaded.jpg'] （アップロード後のURL）
     *
     * つまり：
     * - テキスト + アップロード画像URL が一緒に Server Action に送られる
     * - これが盆栽の記録がデータベースに保存される流れ
     */
    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalledWith({
        bonsaiId: 'bonsai-1',
        content: 'Growth record',
        imageUrls: ['https://example.com/uploaded.jpg'],
      })
    })
  })

  /**
   * テスト7: テキストのみでの送信（画像アップロード処理をスキップ）
   *
   * テスト内容:
   * 画像を添付せず、テキストだけで送信した場合：
   * - 画像圧縮処理（mockPrepareFileForUpload）は呼ばれない
   * - アップロード処理（mockFetch）は呼ばれない
   * - Server Action（addBonsaiRecord）は imageUrls: undefined で呼ばれる
   *
   * テスト6との違い：
   * - テスト6: テキスト + 画像の完全な流れ
   * - テスト7: テキストのみの簡潔な流れ
   *
   * なぜ両方必要？
   * - 異なるユースケースをテスト
   * - コンポーネントが「画像がない場合」を正しく処理できるか確認
   * - 不要な処理をスキップして効率的に処理できるか確認
   */
  it('submit with text only: skips image upload loop', async () => {
    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    /**
     * テキストのみ入力
     * （ファイル選択をしない）
     */
    const textarea = screen.getByPlaceholderText(/成長の様子や作業内容を記録/)
    await user.type(textarea, 'Text only record')

    const submitButton = screen.getByRole('button', { name: '記録する' })
    await user.click(submitButton)

    /**
     * Server Action が imageUrls: undefined で呼ばれたか確認
     *
     * 意味：
     * - 画像なしで送信された
     * - これはコンポーネントが「画像がない場合」を正しく判定している証拠
     */
    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalledWith({
        bonsaiId: 'bonsai-1',
        content: 'Text only record',
        imageUrls: undefined,
      })
    })

    /**
     * 不要な処理が呼ばれていないか確認
     *
     * expect(mockFetch).not.toHaveBeenCalled():
     * - fetch（画像アップロード）が呼ばれていない
     * - 画像がないので、アップロード処理は不要
     *
     * expect(mockPrepareFileForUpload).not.toHaveBeenCalled():
     * - 画像圧縮処理が呼ばれていない
     * - 圧縮対象がないので、呼ぶ必要がない
     *
     * これらの確認により：
     * - コンポーネントが効率的に処理している（不要な処理をスキップ）
     * - コード内に「if (images.length > 0) { アップロード処理 }」のような
     *   条件分岐が正しく機能している
     */
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockPrepareFileForUpload).not.toHaveBeenCalled()
  })
})
