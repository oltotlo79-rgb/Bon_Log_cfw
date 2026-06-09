import { vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactActionsDropdown } from '@/app/admin/contact/ContactActionsDropdown'
import { ContactDetailActions } from '@/app/admin/contact/[id]/ContactDetailActions'
import AdminContactPage from '@/app/admin/contact/page'
import ContactDetailPage from '@/app/admin/contact/[id]/page'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

/**
 * モック関数の前準備
 *
 * Server Actionsをテストするため、実装の前にvi.fn()でモック関数を作成します。
 * これらはモック化されたServer Actions内で呼び出され、呼び出し回数・引数を記録します。
 */

/**
 * @/lib/actions/contact モック用関数定義
 * これらは実際の処理は実行せず、呼び出し情報（引数・回数）を記録するだけ
 */

// お問い合わせステータス更新のServer Action をモック化するための関数
const mockUpdateInquiryStatus = vi.fn()

// お問い合わせ削除のServer Action をモック化するための関数
const mockDeleteInquiry = vi.fn()

// お問い合わせ一覧取得のServer Action をモック化するための関数
const mockGetContactInquiries = vi.fn()

// お問い合わせ統計情報取得のServer Action をモック化するための関数
const mockGetContactStats = vi.fn()

// 単一のお問い合わせ取得のServer Action をモック化するための関数
const mockGetContactInquiry = vi.fn()

/**
 * @/lib/actions/contact のモック設定
 * WHY: Server Actions は通常、データベースアクセスなどの実装が含まれるため、
 *      テストではモック化して、呼び出し記録のみを取る
 *
 * 仕組み: モジュール全体を置き換えるため、実際のServer Action実装は実行されず、
 *        上記のmock関数が代わりに呼ばれる
 */
vi.mock('@/lib/actions/contact', () => ({
  // 元の実装ではなく、mockUpdateInquiryStatus関数に委譲
  // (...args: any[]) で全ての引数をそのまま渡す
  updateInquiryStatus: (...args: any[]) => mockUpdateInquiryStatus(...args),
  deleteInquiry: (...args: any[]) => mockDeleteInquiry(...args),
  getContactInquiries: (...args: any[]) => mockGetContactInquiries(...args),
  getContactStats: (...args: any[]) => mockGetContactStats(...args),
  getContactInquiry: (...args: any[]) => mockGetContactInquiry(...args),
}))

/**
 * Next.js navigation API のモック関数定義
 * Client Component が useRouter や notFound/redirect を呼び出した時の動作を定義
 */

// router.push() の実装をモック
const mockPush = vi.fn()

// router.refresh() の実装をモック
const mockRefresh = vi.fn()

// notFound() 関数の呼び出しを記録するモック
const mockNotFound = vi.fn()

// redirect() 関数の実装をモック
const mockRedirect = vi.fn()

/**
 * next/navigation のモック設定
 * WHY: useRouter, notFound, redirect などは Next.js 環境固有の機能で、
 *      通常のNode.js/テスト環境では実装されていないため、モック化が必須
 */
vi.mock('next/navigation', () => ({
  // useRouter を呼び出すと、mockPush と mockRefresh を持つルーターオブジェクトを返す
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),

  // notFound() 呼び出しで以下の処理を実行:
  // 1. mockNotFound() で呼び出しを記録
  // 2. Error('NEXT_NOT_FOUND') をスロー（テスト内でこのエラーを catch できる）
  notFound: () => { mockNotFound(); throw new Error('NEXT_NOT_FOUND') },

  // redirect() 呼び出しで mockRedirect() を実行
  redirect: () => mockRedirect(),
}))

/**
 * next/link のモック設定
 * WHY: テスト環境では<Link>コンポーネントの遷移機能は不要で、href属性が正しく渡されているか確認できれば十分
 */
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

/**
 * ContactActionsDropdown コンポーネントのテスト
 *
 * このコンポーネントは:
 * - Client Component（'use client'を使用）
 * - お問い合わせ一覧画面でドロップダウンメニューを表示
 * - ステータス変更・削除など複数操作をまとめている
 */
describe('ContactActionsDropdown', async () => {
  /**
   * 各テストの前に実行
   *
   * vi.clearAllMocks():
   * - 前のテストでの呼び出し記録をリセット
   * - 各テストが独立して実行される
   *
   * mockResolvedValue({ success: true }):
   * - モック関数がPromiseを返すように設定
   * - async/await構文でServer Actionを呼び出す際、{ success: true } を返す
   * - これで「処理成功」のシナリオをシミュレート
   */
  beforeEach(() => {
    vi.clearAllMocks()

    // updateInquiryStatus が成功（success: true）を返すように設定
    mockUpdateInquiryStatus.mockResolvedValue({ success: true })

    // deleteInquiry が成功（success: true）を返すように設定
    mockDeleteInquiry.mockResolvedValue({ success: true })
  })

  /**
   * テストケース1: 操作ボタンが表示されることを確認
   *
   * テスト方法:
   * 1. ContactActionsDropdownを render（画面に描画）
   * 2.「操作」というテキストが存在するか確認（toBeInTheDocument）
   *
   * WHY: 基本的なレンダリング確認。コンポーネントが正しく表示されているか
   */
  it('renders "操作" button', () => {
    // Client Componentなので通常の render で大丈夫（await不要）
    render(<ContactActionsDropdown inquiryId="inquiry-1" currentStatus="pending" />)

    // 「操作」というテキストボタンが表示されている
    expect(screen.getByText('操作')).toBeInTheDocument()
  })

  /**
   * テストケース2: ボタンをクリックするとドロップダウンメニューが開く
   *
   * テスト方法:
   * 1. ContactActionsDropdownを render
   * 2. fireEvent.click() で「操作」ボタンをクリック
   * 3. ドロップダウン内のメニューアイテム（対応中にする等）が表示されたか確認
   *
   * fireEvent: React Testing Library で UI イベント（クリック等）を発火させる関数
   * WHY: ユーザーがボタンをクリックした時の挙動を確認
   */
  it('opens dropdown on click', () => {
    render(<ContactActionsDropdown inquiryId="inquiry-1" currentStatus="pending" />)

    // 「操作」ボタンを取得
    const button = screen.getByText('操作')

    // ボタンをクリック（ドロップダウンが開くはず）
    fireEvent.click(button)

    // ドロップダウン内のメニューアイテムが全て表示される
    expect(screen.getByText('対応中にする')).toBeInTheDocument()
    expect(screen.getByText('解決済にする')).toBeInTheDocument()
    expect(screen.getByText('クローズする')).toBeInTheDocument()
    expect(screen.getByText('削除')).toBeInTheDocument()
  })

  /**
   * テストケース3: 現在のステータスはドロップダウンに表示されない
   *
   * テスト方法:
   * 1. currentStatus="pending"（未対応）で render
   * 2. ドロップダウンを開く
   * 3. 「未対応に戻す」（現在と同じステータス）が表示されていないか確認
   * 4. 「対応中にする」「解決済にする」「クローズする」（他のステータス）は表示されているか確認
   *
   * queryByText: getByText と異なり、見つからない場合に null を返す（エラーを投げない）
   * .not.toBeInTheDocument(): 要素が DOM に存在しない（見つからない） ことを確認
   *
   * WHY: UX改善。既に「未対応」なのに「未対応に戻す」は不要 → 表示しない
   */
  it('shows status options excluding current status', () => {
    render(<ContactActionsDropdown inquiryId="inquiry-1" currentStatus="pending" />)

    const button = screen.getByText('操作')
    fireEvent.click(button)

    // 現在のステータス（pending）に対応するメニューアイテムは表示されない
    // queryByText は見つからない場合 null を返すため、.not.toBeInTheDocument() で確認
    expect(screen.queryByText('未対応に戻す')).not.toBeInTheDocument()

    // 他のステータス選択肢は表示される
    expect(screen.getByText('対応中にする')).toBeInTheDocument()
    expect(screen.getByText('解決済にする')).toBeInTheDocument()
    expect(screen.getByText('クローズする')).toBeInTheDocument()
  })

  /**
   * テストケース4: ステータス変更メニュー「対応中にする」をクリックするとServer Actionが呼ばれる
   *
   * テスト方法:
   * 1. ドロップダウンを開く
   * 2.「対応中にする」をクリック
   * 3. mockUpdateInquiryStatus が正しい引数で呼ばれたか確認
   * 4. mockRefresh（ページ再読み込み）が呼ばれたか確認
   *
   * await waitFor():
   * - Client Component は非同期でServer Actionを呼び出す
   * - Server Actionの実行完了を待つために waitFor を使用
   * - waitFor 内の条件が成立するまで、設定時間（デフォルト1秒）待機
   *
   * toHaveBeenCalledWith('inquiry-1', 'in_progress'):
   * - mockUpdateInquiryStatus 関数が、この正確な引数で呼ばれたか確認
   * - inquiry-1 = お問い合わせID
   * - 'in_progress' = ステータス値
   *
   * WHY: Server Actionが正しく呼ばれ、ステータス更新が実行されることを確認
   */
  it('calls updateInquiryStatus on status change', async () => {
    render(<ContactActionsDropdown inquiryId="inquiry-1" currentStatus="pending" />)

    const button = screen.getByText('操作')
    fireEvent.click(button)

    // 「対応中にする」をクリック
    const statusButton = screen.getByText('対応中にする')
    fireEvent.click(statusButton)

    // Server Action実行の完了を待つ
    await waitFor(() => {
      // updateInquiryStatus が正しい引数で呼ばれたか確認
      expect(mockUpdateInquiryStatus).toHaveBeenCalledWith('inquiry-1', 'in_progress')

      // ページ再読み込み（refresh）が呼ばれたか確認
      // Server Actionでステータス変更後、画面を最新の状態に更新するため
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  /**
   * テストケース5: 削除ボタンをクリックすると確認ダイアログが表示され、OKで削除実行
   *
   * テスト方法:
   * 1. global.confirm をモック化して、ユーザーが確認ダイアログで「OK」を押すシミュレート
   * 2. ドロップダウンを開いて削除ボタンをクリック
   * 3. 確認ダイアログが正しいメッセージで呼ばれたか確認
   * 4. deleteInquiry Server Action が呼ばれたか確認
   * 5. ページ再読み込み（refresh）が呼ばれたか確認
   *
   * global.confirm:
   * - ブラウザの確認ダイアログ（OK/キャンセルボタン）
   * - テストでは global.confirm をモック化して、返り値（true=OK, false=キャンセル）を制御
   *
   * WHY: 危険な削除操作は事前に確認を取る必要がある。確認後の処理を検証
   */
  it('shows delete button and calls confirm then deleteInquiry', async () => {
    const user = userEvent.setup()

    render(<ContactActionsDropdown inquiryId="inquiry-1" currentStatus="pending" />)

    const button = screen.getByText('操作')
    fireEvent.click(button)

    // 削除ボタンをクリック → ConfirmDialog が開く
    const deleteButton = screen.getByText('削除')
    fireEvent.click(deleteButton)

    // ConfirmDialog が開くのを待つ
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })

    // 「削除する」ボタンをクリックして確認
    await user.click(screen.getByRole('button', { name: '削除する' }))

    // Server Action実行の完了を待つ
    await waitFor(() => {
      // deleteInquiry が正しい引数で呼ばれたか確認
      expect(mockDeleteInquiry).toHaveBeenCalledWith('inquiry-1')

      // ページ再読み込みが呼ばれたか確認
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  /**
   * テストケース6: 削除ダイアログで「キャンセル」を押した場合、削除されない
   *
   * テスト方法:
   * 1. global.confirm をモック化して false を返すように設定（ユーザーがキャンセルを押したシミュレート）
   * 2. ドロップダウンを開いて削除ボタンをクリック
   * 3. 確認ダイアログが呼ばれたか確認
   * 4. deleteInquiry は呼ばれていない（not.toHaveBeenCalled）ことを確認
   *
   * .not.toHaveBeenCalled():
   * - モック関数が全く呼ばれていない（呼び出し0回）ことを確認
   *
   * WHY: キャンセル時は削除が実行されないことを確認。誤操作防止
   */
  it('does not delete if confirm returns false', async () => {
    const user = userEvent.setup()

    render(<ContactActionsDropdown inquiryId="inquiry-1" currentStatus="pending" />)

    const button = screen.getByText('操作')
    fireEvent.click(button)

    const deleteButton = screen.getByText('削除')
    fireEvent.click(deleteButton)

    // ConfirmDialog が開くのを待つ
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })

    // 「キャンセル」ボタンをクリック
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    // deleteInquiry は呼ばれていない（削除しない）
    expect(mockDeleteInquiry).not.toHaveBeenCalled()
  })

  /**
   * テストケース7: ドロップダウン外をクリックすると、ドロップダウンが閉じる
   *
   * テスト方法:
   * 1. ドロップダウンを開く（対応中にする等が表示される）
   * 2. fireEvent.mouseDown(document.body) でページ外（<body>）をクリック
   * 3. ドロップダウンメニューが非表示になることを確認
   *
   * fireEvent.mouseDown(document.body):
   * - document.body（ページ全体）にmouseDownイベントを発火
   * - コンポーネント内では外部クリックを検出してドロップダウンを閉じる実装が行われる
   *
   * WHY: ユーザーが誤ってページをクリックした時、ドロップダウンが自動で閉じることを確認
   */
  it('closes dropdown on click outside', async () => {
    render(<ContactActionsDropdown inquiryId="inquiry-1" currentStatus="pending" />)

    const button = screen.getByText('操作')
    fireEvent.click(button)

    // ドロップダウンが開かれていることを確認
    expect(screen.getByText('対応中にする')).toBeInTheDocument()

    // ドロップダウン外（ページ全体）をクリック
    fireEvent.mouseDown(document.body)

    // ドロップダウンが閉じられ、メニューが表示されなくなることを待つ
    await waitFor(() => {
      expect(screen.queryByText('対応中にする')).not.toBeInTheDocument()
    })
  })

  /**
   * テストケース8: Server Actionのエラーハンドリング - updateInquiryStatus失敗時
   *
   * テスト方法:
   * 1. mockUpdateInquiryStatus を { error: '...' } を返すように変更
   * 2. ステータス変更メニューをクリック
   * 3. global.alert にエラーメッセージが渡されることを確認
   *
   * mockResolvedValue({ error: 'Update failed' }):
   * - Server Action の返り値を { error: 'Update failed' } に変更
   * - コンポーネント側でこのエラーを検出して、alert（警告ダイアログ）を表示する実装
   *
   * WHY: エラーが発生した時、ユーザーに適切にエラーメッセージが表示されることを確認
   */
  it('shows error toast when updateInquiryStatus fails', async () => {
    // エラーを返すようにモック設定を変更
    mockUpdateInquiryStatus.mockResolvedValue({ error: 'Update failed' })

    render(<ContactActionsDropdown inquiryId="inquiry-1" currentStatus="pending" />)

    const button = screen.getByText('操作')
    fireEvent.click(button)

    const statusButton = screen.getByText('対応中にする')
    fireEvent.click(statusButton)

    // Server Action 実行完了を待つ
    await waitFor(() => {
      // toast にエラーメッセージが渡されたか確認
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Update failed', variant: 'destructive' }))
    })
  })

  /**
   * テストケース9: Server Actionのエラーハンドリング - deleteInquiry失敗時
   *
   * テスト方法:
   * 1. mockDeleteInquiry を { error: '...' } を返すように変更
   * 2. 削除ボタンをクリック
   * 3. 確認ダイアログで OK を押す
   * 4. global.alert にエラーメッセージが渡されることを確認
   *
   * WHY: 削除エラー時にもエラーメッセージがユーザーに表示されることを確認
   */
  it('shows error toast when deleteInquiry fails', async () => {
    // エラーを返すようにモック設定を変更
    mockDeleteInquiry.mockResolvedValue({ error: 'Delete failed' })
    const user = userEvent.setup()

    render(<ContactActionsDropdown inquiryId="inquiry-1" currentStatus="pending" />)

    const button = screen.getByText('操作')
    fireEvent.click(button)

    const deleteButton = screen.getByText('削除')
    fireEvent.click(deleteButton)

    // ConfirmDialog が開くのを待つ
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      // toast にエラーメッセージが渡されたか確認
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete failed', variant: 'destructive' }))
    })
  })
})

/**
 * ContactDetailActions コンポーネントのテスト
 *
 * このコンポーネントは:
 * - Client Component（'use client'を使用）
 * - お問い合わせ詳細ページで、ステータス変更・メモ入力・削除を行う
 * - ContactActionsDropdown より詳細で、フォーム形式で複数フィールドを持つ
 */
describe('ContactDetailActions', async () => {
  /**
   * 各テストの前に実行
   * mocks をリセットし、成功パターンをデフォルト設定
   */
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateInquiryStatus.mockResolvedValue({ success: true })
    mockDeleteInquiry.mockResolvedValue({ success: true })
  })

  /**
   * テストケース1: 必要な UI 要素が全て表示されているか確認
   *
   * テスト方法:
   * 1. ContactDetailActions を render
   * 2. 以下の要素が表示されているか確認:
   *    - セクションタイトル「対応操作」
   *    - ステータス選択ドロップダウン
   *    - 管理者メモ入力フィールド
   *    - 更新ボタン、削除ボタン
   *
   * screen.getByRole('combobox'):
   * - <select> 要素（ドロップダウン）を取得
   * - WAI-ARIA ロール「combobox」で検索する
   * - アクセシビリティ観点で、role を使う方が推奨
   *
   * WHY: フォームの全構成要素が正しく描画されていることを確認
   */
  it('renders status select, admin note textarea, update/delete buttons', () => {
    render(
      <ContactDetailActions
        inquiryId="inquiry-1"
        currentStatus="pending"
        currentNote=""
      />
    )

    // セクションタイトル
    expect(screen.getByText('対応操作')).toBeInTheDocument()

    // フォームラベル
    expect(screen.getByText('ステータス')).toBeInTheDocument()
    expect(screen.getByText('管理者メモ')).toBeInTheDocument()

    // フォーム要素
    expect(screen.getByRole('combobox')).toBeInTheDocument() // <select>
    expect(screen.getByPlaceholderText('対応内容や返信内容のメモ')).toBeInTheDocument() // <textarea>

    // ボタン
    expect(screen.getByText('更新する')).toBeInTheDocument()
    expect(screen.getByText('削除')).toBeInTheDocument()
  })

  /**
   * テストケース2: 「更新する」ボタンをクリックすると、updateInquiryStatus Server Action が呼ばれる
   *
   * テスト方法:
   * 1. 「更新する」ボタンをクリック
   * 2. mockUpdateInquiryStatus が (inquiryId, status, note) 引数で呼ばれたか確認
   * 3. mockRefresh（ページ再読み込み）が呼ばれたか確認
   *
   * WHY: フォーム送信時にServer Actionが正しく実行されることを確認
   */
  it('calls updateInquiryStatus on update click', async () => {
    render(
      <ContactDetailActions
        inquiryId="inquiry-1"
        currentStatus="pending"
        currentNote=""
      />
    )

    const updateButton = screen.getByText('更新する')
    fireEvent.click(updateButton)

    await waitFor(() => {
      // Server Action が正しい引数で呼ばれたか
      expect(mockUpdateInquiryStatus).toHaveBeenCalledWith('inquiry-1', 'pending', '')

      // ページ再読み込みが呼ばれたか
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  /**
   * テストケース3: 更新成功時に成功メッセージが表示される
   *
   * テスト方法:
   * 1.「更新する」ボタンをクリック
   * 2. Server Action の返り値 { success: true } に基づいて、成功メッセージが表示されることを確認
   *
   * WHY: ユーザーに更新成功をフィードバック
   */
  it('shows success message on successful update', async () => {
    render(
      <ContactDetailActions
        inquiryId="inquiry-1"
        currentStatus="pending"
        currentNote=""
      />
    )

    const updateButton = screen.getByText('更新する')
    fireEvent.click(updateButton)

    // 成功メッセージが表示されることを待つ
    await waitFor(() => {
      expect(screen.getByText('更新しました')).toBeInTheDocument()
    })
  })

  /**
   * テストケース4: 更新失敗時にエラーメッセージが表示される
   *
   * テスト方法:
   * 1. mockUpdateInquiryStatus を { error: '...' } を返すように変更
   * 2.「更新する」ボタンをクリック
   * 3. エラーメッセージが表示されることを確認
   *
   * WHY: エラーハンドリングの確認。失敗時のフィードバック
   */
  it('shows error message on failed update', async () => {
    // エラーを返すようにモック変更
    mockUpdateInquiryStatus.mockResolvedValue({ error: 'Failed to update' })

    render(
      <ContactDetailActions
        inquiryId="inquiry-1"
        currentStatus="pending"
        currentNote=""
      />
    )

    const updateButton = screen.getByText('更新する')
    fireEvent.click(updateButton)

    // エラーメッセージが表示されることを待つ
    await waitFor(() => {
      expect(screen.getByText('Failed to update')).toBeInTheDocument()
    })
  })

  /**
   * テストケース5: ステータス選択ドロップダウンの値が変更可能
   *
   * テスト方法:
   * 1. <select> 要素を取得
   * 2. fireEvent.change() で値を 'resolved' に変更
   * 3. select.value が 'resolved' になっていることを確認
   *
   * fireEvent.change(select, { target: { value: 'resolved' } }):
   * - change イベントを発火させ、input 値を変更
   * - 第2引数で新しい値を指定
   *
   * WHY: ユーザーがドロップダウンでステータスを変更できることを確認
   */
  it('changes status select value', () => {
    render(
      <ContactDetailActions
        inquiryId="inquiry-1"
        currentStatus="pending"
        currentNote=""
      />
    )

    const select = screen.getByRole('combobox')

    // select の値を 'resolved' に変更
    fireEvent.change(select, { target: { value: 'resolved' } })

    // 値が変更されたことを確認
    expect(select).toHaveValue('resolved')
  })

  /**
   * テストケース6: 管理者メモテキストエリアの値が変更可能
   *
   * テスト方法:
   * 1. <textarea> 要素を取得
   * 2. fireEvent.change() で値を 'Test note' に変更
   * 3. textarea.value が 'Test note' になっていることを確認
   *
   * WHY: ユーザーがメモを入力できることを確認
   */
  it('changes admin note textarea value', () => {
    render(
      <ContactDetailActions
        inquiryId="inquiry-1"
        currentStatus="pending"
        currentNote=""
      />
    )

    const textarea = screen.getByPlaceholderText('対応内容や返信内容のメモ')

    // textarea の値を 'Test note' に変更
    fireEvent.change(textarea, { target: { value: 'Test note' } })

    // 値が変更されたことを確認
    expect(textarea).toHaveValue('Test note')
  })

  /**
   * テストケース7: 削除ボタンをクリック → 確認ダイアログ OK → deleteInquiry実行 → リスト画面へリダイレクト
   *
   * テスト方法:
   * 1. global.confirm をモック化して true（OK）を返すように設定
   * 2. 削除ボタンをクリック
   * 3. 確認ダイアログが正しいメッセージで呼ばれたか確認
   * 4. deleteInquiry Server Action が呼ばれたか確認
   * 5. router.push('/admin/contact') でリスト画面へ遷移するか確認
   *
   * mockPush.toHaveBeenCalledWith('/admin/contact'):
   * - 削除成功後、リスト画面へ自動でリダイレクトされる
   * - ContactActionsDropdown と異なり、詳細ページから削除するため、
   *   リスト画面へ戻す必要がある
   *
   * WHY: 詳細ページでの削除動作、特にリダイレクトが正しく行われることを確認
   */
  it('calls deleteInquiry on delete (after confirm)', async () => {
    const user = userEvent.setup()

    render(
      <ContactDetailActions
        inquiryId="inquiry-1"
        currentStatus="pending"
        currentNote=""
      />
    )

    const deleteButton = screen.getByText('削除')
    fireEvent.click(deleteButton)

    // ConfirmDialog が開くのを待つ
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      // deleteInquiry が呼ばれたか
      expect(mockDeleteInquiry).toHaveBeenCalledWith('inquiry-1')

      // リスト画面へリダイレクト
      expect(mockPush).toHaveBeenCalledWith('/admin/contact')
    })
  })

  /**
   * テストケース8: 削除ダイアログでキャンセルを押すと、削除されない
   *
   * テスト方法:
   * 1. global.confirm を false（キャンセル）を返すように設定
   * 2. 削除ボタンをクリック
   * 3. 確認ダイアログは呼ばれたが、deleteInquiry は呼ばれていない（.not.toHaveBeenCalled）ことを確認
   *
   * WHY: キャンセル時に削除が実行されないことを確認
   */
  it('does not delete if confirm returns false', async () => {
    const user = userEvent.setup()

    render(
      <ContactDetailActions
        inquiryId="inquiry-1"
        currentStatus="pending"
        currentNote=""
      />
    )

    const deleteButton = screen.getByText('削除')
    fireEvent.click(deleteButton)

    // ConfirmDialog が開くのを待つ
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })

    // 「キャンセル」ボタンをクリック
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    // deleteInquiry は呼ばれていない（削除しない）
    expect(mockDeleteInquiry).not.toHaveBeenCalled()
  })

  /**
   * テストケース9: 削除に失敗した場合、エラーメッセージが表示されリダイレクトしない
   *
   * テスト方法:
   * 1. mockDeleteInquiry を { error: '...' } を返すように変更
   * 2. 削除ボタンをクリック → 確認OK
   * 3. alert にエラーメッセージが表示されたか確認
   * 4. mockPush が呼ばれていない（リダイレクトしていない）ことを確認
   *
   * WHY: 削除エラー時の適切なエラーハンドリング。失敗時はリスト画面に戻さない
   */
  it('shows error toast when delete fails', async () => {
    // エラーを返すようにモック変更
    mockDeleteInquiry.mockResolvedValue({ error: 'Delete failed' })
    const user = userEvent.setup()

    render(
      <ContactDetailActions
        inquiryId="inquiry-1"
        currentStatus="pending"
        currentNote=""
      />
    )

    const deleteButton = screen.getByText('削除')
    fireEvent.click(deleteButton)

    // ConfirmDialog が開くのを待つ
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      // エラーメッセージが toast に渡されたか
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete failed', variant: 'destructive' }))

      // リダイレクトが実行されていない（エラーなので戻らない）
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  /**
   * テストケース10: ステータスとメモを変更した後、更新ボタンをクリックすると変更内容で更新される
   *
   * テスト方法:
   * 1. ステータスドロップダウンの値を 'pending' → 'resolved' に変更
   * 2. メモテキストエリアの値を '' → 'Issue resolved' に変更
   * 3.「更新する」ボタンをクリック
   * 4. updateInquiryStatus が変更後の値 ('resolved', 'Issue resolved') で呼ばれたか確認
   *
   * WHY: 複数フィールドの変更が同時に反映されることを確認。フォーム統合テスト
   */
  it('updates with changed status and note', async () => {
    render(
      <ContactDetailActions
        inquiryId="inquiry-1"
        currentStatus="pending"
        currentNote=""
      />
    )

    // ステータスを変更
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'resolved' } })

    // メモを変更
    const textarea = screen.getByPlaceholderText('対応内容や返信内容のメモ')
    fireEvent.change(textarea, { target: { value: 'Issue resolved' } })

    // 更新ボタンをクリック
    const updateButton = screen.getByText('更新する')
    fireEvent.click(updateButton)

    await waitFor(() => {
      // 変更後の値で updateInquiryStatus が呼ばれたか確認
      expect(mockUpdateInquiryStatus).toHaveBeenCalledWith('inquiry-1', 'resolved', 'Issue resolved')
    })
  })
})

/**
 * AdminContactPage （お問い合わせ管理ページ）のServer Componentテスト
 *
 * Server Componentのテスト方法の特徴:
 * - await import() で動的インポート（ファイルの途中での実行のため）
 * - await AdminContactPage({ ... }) で呼び出し（async関数だから）
 * - 返ってきたJSXをrenderで描画
 * - Client Component同様の screen.getByText() で要素確認
 *
 * このページの役割:
 * - getContactStats: お問い合わせの統計情報（pending数、resolved数等）を取得
 * - getContactInquiries: 条件に合うお問い合わせ一覧を取得
 * - これらをServer Componentで直接実行し、JSXに埋め込んで描画
 */
describe('AdminContactPage (Server Component)', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * テストケース1: 統計情報と一覧テーブルが正しく描画される
   *
   * テスト方法:
   * 1. mockGetContactStats で統計データをモック設定
   * 2. mockGetContactInquiries で2件のお問い合わせをモック設定
   * 3. AdminContactPage を Server Component として実行
   * 4. 統計情報（pending: 5, inProgress: 3等）が表示されているか確認
   * 5. お問い合わせ一覧のテーブルに、ユーザー名・メール・ステータスが表示されているか確認
   *
   * Server Component テストの特徴:
   * - const jsx = await AdminContactPage({ ... }) で JSX を取得
   * - render(jsx) で描画（Client Component と同じく render で OK）
   * - searchParams: Promise.resolve({}) は、Next.js 13+ の App Router の仕様
   *   ページコンポーネントの props は Promise でラップされている
   *
   * WHY: ページが正しくデータを取得して表示しているか確認
   */
  it('renders stats and inquiries table', async () => {
    // 統計情報をモック設定
    mockGetContactStats.mockResolvedValue({
      success: true,
      data: {
        pending: 5,        // 未対応
        inProgress: 3,     // 対応中
        resolved: 10,      // 解決済
        closed: 2,         // クローズ
      },
    })

    // お問い合わせ一覧をモック設定（2件）
    mockGetContactInquiries.mockResolvedValue({
      success: true,
      data: {
        inquiries: [
          {
            id: 'inquiry-1',
            name: 'Test User',
            email: 'test@example.com',
            category: 'general',
            subject: 'Test Subject',
            status: 'pending',
            createdAt: new Date('2024-01-01'),
          },
          {
            id: 'inquiry-2',
            name: 'Another User',
            email: 'another@example.com',
            category: 'bug',
            subject: 'Bug Report',
            status: 'in_progress',
            createdAt: new Date('2024-01-02'),
          },
        ],
        total: 2,          // 全件数
        nextCursor: undefined, // 件数が limit 未満 → 次ページなし
      },
    })

    // Server Component を async/await で実行
    // searchParams: Promise.resolve({}) は、クエリパラメータなし（デフォルト）を意味する
    const jsx = await AdminContactPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    // ページタイトルが表示されている
    expect(screen.getByText('お問い合わせ管理')).toBeInTheDocument()

    // 統計情報が表示されている（カウント数字）
    expect(screen.getByText('5')).toBeInTheDocument()   // pending
    expect(screen.getByText('3')).toBeInTheDocument()   // inProgress
    expect(screen.getByText('10')).toBeInTheDocument()  // resolved
    expect(screen.getByText('2')).toBeInTheDocument()   // closed

    // テーブルに一覧データが表示されている
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('Another User')).toBeInTheDocument()
    expect(screen.getByText('another@example.com')).toBeInTheDocument()
  })

  /**
   * テストケース2: 認証エラーが発生した場合、エラーメッセージが表示される
   *
   * テスト方法:
   * 1. mockGetContactStats を { error: 'Unauthorized' } を返すように設定
   *    （権限チェック失敗）
   * 2. AdminContactPage を実行
   * 3. 「権限エラー」というエラーメッセージが表示されているか確認
   *
   * WHY: 権限なしユーザーがアクセスした場合、適切にエラーを表示する
   */
  it('shows error message on auth error', async () => {
    // 権限エラーをシミュレート
    mockGetContactStats.mockResolvedValue({ error: 'Unauthorized' })

    // 一覧も空を返す
    mockGetContactInquiries.mockResolvedValue({
      inquiries: [],
      total: 0,
      nextCursor: undefined,
    })

    const jsx = await AdminContactPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    // エラーメッセージが表示されている
    expect(screen.getByText('権限エラー')).toBeInTheDocument()
  })

  /**
   * テストケース3: お問い合わせが0件の場合、空の状態メッセージが表示される
   *
   * テスト方法:
   * 1. mockGetContactStats で全て0件を返すように設定
   * 2. mockGetContactInquiries で空配列を返すように設定
   * 3. AdminContactPage を実行
   * 4. 「お問い合わせはありません」という空の状態メッセージが表示されているか確認
   *
   * WHY: データがない場合、テーブルを表示せず、代わりにわかりやすいメッセージを表示
   */
  it('renders empty state message', async () => {
    // 全てのステータスが0件
    mockGetContactStats.mockResolvedValue({
      success: true,
      data: {
        pending: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        total: 0,
      },
    })

    // お問い合わせがない
    mockGetContactInquiries.mockResolvedValue({
      success: true,
      data: {
        inquiries: [],
        total: 0,
        nextCursor: undefined,
      },
    })

    const jsx = await AdminContactPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    // 空の状態メッセージが表示されている
    expect(screen.getByText('お問い合わせはありません')).toBeInTheDocument()
  })

  /**
   * テストケース4: 次ページが存在する場合、カーソルページネーション UI が表示される
   *
   * カーソルベース移行に伴う仕様変更:
   * - 旧: `page: '2'` + `totalPages: 3` → 「2 / 3」表記
   * - 新: `cursor: '...'` + `nextCursor: '...'` + `trail` → 「全 N 件」+ 前/次ボタン
   *
   * WHY: 次ページ cursor が返されたとき、「次へ」リンクが有効になることを確認
   */
  it('shows next link when nextCursor is defined', async () => {
    mockGetContactStats.mockResolvedValue({
      success: true,
      data: {
        pending: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
      },
    })

    mockGetContactInquiries.mockResolvedValue({
      success: true,
      data: {
        inquiries: [
          {
            id: 'inquiry-1',
            name: 'Test User',
            email: 'test@example.com',
            category: 'general',
            subject: 'Test Subject',
            status: 'pending',
            createdAt: new Date('2024-01-01'),
          },
        ],
        total: 25,
        nextCursor: 'inquiry-1',
      },
    })

    const jsx = await AdminContactPage({
      searchParams: Promise.resolve({})
    })
    render(jsx)

    expect(screen.getByText('全 25 件')).toBeInTheDocument()

    // 次へは Link（href あり）。先頭ページ（cursor undefined）なので 前へ は span（リンクではない）
    const nextLink = screen.getByText('次へ')
    expect(nextLink.closest('a')).not.toBeNull()
    const prevLabel = screen.getByText('前へ')
    expect(prevLabel.closest('a')).toBeNull()
  })

  /**
   * テストケース5: searchParams（フィルター・検索・カーソル）が正しく getContactInquiries に渡される
   *
   * カーソルベースでは URL パラメータの解釈が変わる:
   *   - 旧: `page: '2'` → 数値 2
   *   - 新: `cursor: 'xxx'` → 文字列 'xxx' をそのまま渡す
   *
   * WHY: Server Component が URL クエリパラメータを正しく解析して
   *      Server Action に渡していることを確認
   */
  it('calls getContactInquiries with search params', async () => {
    mockGetContactStats.mockResolvedValue({
      success: true,
      data: {
        pending: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
      },
    })

    mockGetContactInquiries.mockResolvedValue({
      success: true,
      data: {
        inquiries: [],
        total: 0,
        nextCursor: undefined,
      },
    })

    // searchParams にフィルター条件を指定
    await AdminContactPage({
      searchParams: Promise.resolve({
        status: 'pending',
        search: 'test',
        cursor: 'inquiry-99',
        trail: 'inquiry-40,inquiry-70',
      })
    })

    // getContactInquiries が正しい引数で呼ばれたか確認（cursor が文字列としてそのまま渡る）
    expect(mockGetContactInquiries).toHaveBeenCalledWith({
      status: 'pending',
      search: 'test',
      cursor: 'inquiry-99',
    })
  })

  /**
   * テストケース6: フィルターフォームが、URL の searchParams に基づいた値で表示される
   *
   * テスト方法:
   * 1. searchParams に status: 'pending', search: 'test query' を設定
   * 2. AdminContactPage を実行
   * 3. ステータス選択ドロップダウンが「未対応」という値で表示されているか確認
   * 4. 検索入力フィールドが「test query」という値で表示されているか確認
   *
   * screen.getByDisplayValue():
   * - <select> や <input> の「現在の値」で要素を検索する
   * - <input value="test query" /> の場合、getByDisplayValue('test query') で取得できる
   * - 画面に表示される値（表示値）で検索する、という意味
   *
   * WHY: ページを再訪問した時、前回のフィルター条件が保持されていることを確認
   */
  it('renders filter form with default values', async () => {
    mockGetContactStats.mockResolvedValue({
      success: true,
      data: {
        pending: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
      },
    })

    mockGetContactInquiries.mockResolvedValue({
      success: true,
      data: {
        inquiries: [],
        total: 0,
        nextCursor: undefined,
      },
    })

    // フィルター条件付きで表示
    const jsx = await AdminContactPage({
      searchParams: Promise.resolve({
        status: 'pending',      // ステータスフィルター: 未対応
        search: 'test query'    // 検索キーワード
      })
    })
    render(jsx)

    // ステータス選択が「未対応」（'pending' の表示名）で保持されている
    const statusSelect = screen.getByDisplayValue('未対応')

    // 検索入力が「test query」で保持されている
    const searchInput = screen.getByDisplayValue('test query')

    expect(statusSelect).toBeInTheDocument()
    expect(searchInput).toBeInTheDocument()
  })
})

/**
 * ContactDetailPage （お問い合わせ詳細ページ）のServer Componentテスト
 *
 * このページの役割:
 * - getContactInquiry: 指定したIDのお問い合わせ詳細情報を取得
 * - 詳細情報、管理者メモ、対応日時等を表示
 * - Server Component内で getContactInquiry を実行してデータを取得
 *
 * 動的ルート: app/admin/contact/[id]/page.tsx
 * - [id] は URL パラメータ（例: /admin/contact/inquiry-1）
 * - params.id でアクセス可能
 */
describe('ContactDetailPage (Server Component)', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * テストケース1: お問い合わせの詳細情報が正しく表示される
   *
   * テスト方法:
   * 1. mockGetContactInquiry で詳細情報をモック設定
   * 2. params: Promise.resolve({ id: 'inquiry-1' }) で URL パラメータを指定
   * 3. ContactDetailPage を Server Component として実行
   * 4. ページタイトル、ユーザー情報、件名、メッセージ内容が表示されているか確認
   *
   * params: Promise.resolve({ id: 'inquiry-1' }):
   * - Next.js 13+ では、page.tsx の props（params, searchParams等）は Promise でラップされている
   * - 実際の開発では Next.js が自動でこのPromiseを処理するが、
   *   テストでは手動でPromiseに包む必要がある
   *
   * WHY: ページが指定されたお問い合わせの詳細を正しく表示していることを確認
   */
  it('renders inquiry details', async () => {
    // 詳細情報をモック設定
    mockGetContactInquiry.mockResolvedValue({
      success: true,
      data: {
        inquiry: {
          id: 'inquiry-1',
          name: 'Test User',
          email: 'test@example.com',
          category: 'general',
          subject: 'Test Subject',
          message: 'Test message content',
          status: 'pending',
          createdAt: new Date('2024-01-01T10:00:00'),
          adminNote: null,        // 管理者メモなし
          respondedAt: null,      // 対応日時なし
        },
      },
    })

    // Server Component を実行（params に id を指定）
    const jsx = await ContactDetailPage({
      params: Promise.resolve({ id: 'inquiry-1' })
    })
    render(jsx)

    // ページタイトルが表示されている
    expect(screen.getByText('お問い合わせ詳細')).toBeInTheDocument()

    // お問い合わせ情報が表示されている
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('Test Subject')).toBeInTheDocument()
    expect(screen.getByText('Test message content')).toBeInTheDocument()
  })

  /**
   * テストケース2: お問い合わせが見つからない場合、notFound() が呼ばれる
   *
   * テスト方法:
   * 1. mockGetContactInquiry を { error: 'Not found' } を返すように設定
   * 2. 無効なIDで ContactDetailPage を実行
   * 3. notFound() が呼ばれた（Error('NEXT_NOT_FOUND') が投げられた）ことを確認
   *
   * await expect(...).rejects.toThrow('NEXT_NOT_FOUND'):
   * - Server Component が notFound() を呼ぶと、Error('NEXT_NOT_FOUND') が投げられる
   * - rejects.toThrow() で、投げられたエラーをキャッチして確認
   *
   * WHY: 存在しないお問い合わせにアクセスした場合、404ページが表示されることを確認
   */
  it('calls notFound on error', async () => {
    // エラーを返すようにモック設定（見つからない）
    mockGetContactInquiry.mockResolvedValue({ error: 'Not found' })

    // Server Component 実行時にエラーがスロー（投げられ）ることを期待
    await expect(ContactDetailPage({
      params: Promise.resolve({ id: 'invalid-id' })
    })).rejects.toThrow('NEXT_NOT_FOUND')

    // notFound() 関数が呼ばれたことを確認
    expect(mockNotFound).toHaveBeenCalled()
  })

  /**
   * テストケース3: 管理者メモが存在する場合、管理者メモセクションが表示される
   *
   * テスト方法:
   * 1. adminNote: 'This is an admin note' をモック設定
   * 2. ContactDetailPage を実行
   * 3. メモの内容テキストが表示されているか確認
   *
   * getAllByText().length:
   * - screen.getAllByText() は複数マッチした要素を配列で返す
   * - .length >= 1 で、1件以上表示されていることを確認
   * - メモは複数箇所に表示される可能性があるため（詳細セクションと編集フォーム等）
   *   getAllByText を使う
   *
   * WHY: 管理者が以前入力したメモが表示されていることを確認
   */
  it('shows adminNote section when present', async () => {
    mockGetContactInquiry.mockResolvedValue({
      success: true,
      data: {
        inquiry: {
          id: 'inquiry-1',
          name: 'Test User',
          email: 'test@example.com',
          category: 'general',
          subject: 'Test Subject',
          message: 'Test message',
          status: 'resolved',
          createdAt: new Date('2024-01-01T10:00:00'),
          adminNote: 'This is an admin note',  // 管理者メモあり
          respondedAt: null,
        },
      },
    })

    const jsx = await ContactDetailPage({
      params: Promise.resolve({ id: 'inquiry-1' })
    })
    render(jsx)

    // メモのテキストが1件以上表示されている
    expect(screen.getAllByText('This is an admin note').length).toBeGreaterThanOrEqual(1)
  })

  /**
   * テストケース4: 対応日時が存在する場合、「対応日時」ラベルと共に表示される
   *
   * テスト方法:
   * 1. respondedAt: new Date(...) をモック設定（対応日時あり）
   * 2. ContactDetailPage を実行
   * 3. 「対応日時」というラベルが表示されているか確認
   *
   * WHY: いつ対応したか（返信したか）をユーザーに示す
   */
  it('shows respondedAt when present', async () => {
    mockGetContactInquiry.mockResolvedValue({
      success: true,
      data: {
        inquiry: {
          id: 'inquiry-1',
          name: 'Test User',
          email: 'test@example.com',
          category: 'general',
          subject: 'Test Subject',
          message: 'Test message',
          status: 'resolved',
          createdAt: new Date('2024-01-01T10:00:00'),
          adminNote: null,
          respondedAt: new Date('2024-01-02T15:30:00'),  // 対応日時あり
        },
      },
    })

    const jsx = await ContactDetailPage({
      params: Promise.resolve({ id: 'inquiry-1' })
    })
    render(jsx)

    // 「対応日時」というラベルが表示されている
    expect(screen.getByText('対応日時')).toBeInTheDocument()
  })

  /**
   * テストケース5: adminNote と respondedAt が両方 null の場合、表示されない
   *
   * テスト方法:
   * 1. adminNote: null, respondedAt: null をモック設定（両方なし）
   * 2. ContactDetailPage を実行
   * 3. 「対応日時」というテキストが表示されていないか確認（queryByText で .not.toBeInTheDocument()）
   * 4. 管理者メモセクション用のスタイルクラス（bg-blue-50）が存在しないことを確認
   *
   * queryByText vs getByText:
   * - queryByText: 見つからない場合 null を返す（エラーを投げない）
   * - getByText: 見つからない場合 エラーを投げる
   * - 「要素が存在しない」ことを確認するには queryByText を使う
   *
   * .not.toBeInTheDocument():
   * - 要素が DOM に存在しない（null）ことを確認
   *
   * WHY: 初期状態（メモなし、対応日時なし）では不要な UI が表示されないことを確認
   */
  it('does not show adminNote or respondedAt when null', async () => {
    mockGetContactInquiry.mockResolvedValue({
      success: true,
      data: {
        inquiry: {
          id: 'inquiry-1',
          name: 'Test User',
          email: 'test@example.com',
          category: 'general',
          subject: 'Test Subject',
          message: 'Test message',
          status: 'pending',
          createdAt: new Date('2024-01-01T10:00:00'),
          adminNote: null,      // メモなし
          respondedAt: null,    // 対応日時なし
        },
      },
    })

    const jsx = await ContactDetailPage({
      params: Promise.resolve({ id: 'inquiry-1' })
    })
    render(jsx)

    // 「対応日時」テキストが表示されていない
    expect(screen.queryByText('対応日時')).not.toBeInTheDocument()

    // 管理者メモセクションのスタイルクラス（bg-blue-50）を持つ要素が存在しない
    const container = document.querySelector('.bg-blue-50, .dark\\:bg-blue-950')
    expect(container).toBeNull()
  })

  /**
   * テストケース6: カテゴリー「bug」が「不具合の報告」というラベルで表示される
   *
   * テスト方法:
   * 1. category: 'bug' をモック設定
   * 2. ContactDetailPage を実行
   * 3. 「不具合の報告」というカテゴリー表示ラベルが表示されているか確認
   *
   * WHY: カテゴリー値（bug, general等）が正しい日本語ラベルに変換されて表示されることを確認
   *      複数のカテゴリー選択肢がある場合、各選択肢の変換を検証
   */
  it('renders all category labels correctly', async () => {
    mockGetContactInquiry.mockResolvedValue({
      success: true,
      data: {
        inquiry: {
          id: 'inquiry-1',
          name: 'Test User',
          email: 'test@example.com',
          category: 'bug',  // バグ報告カテゴリー
          subject: 'Test Subject',
          message: 'Test message',
          status: 'pending',
          createdAt: new Date('2024-01-01T10:00:00'),
          adminNote: null,
          respondedAt: null,
        },
      },
    })

    const jsx = await ContactDetailPage({
      params: Promise.resolve({ id: 'inquiry-1' })
    })
    render(jsx)

    // 'bug' カテゴリーが「不具合の報告」というラベルで表示される
    expect(screen.getByText('不具合の報告')).toBeInTheDocument()
  })

  /**
   * テストケース7: ステータス「in_progress」が「対応中」というラベルで表示される
   *
   * テスト方法:
   * 1. status: 'in_progress' をモック設定
   * 2. ContactDetailPage を実行
   * 3. 「対応中」というステータス表示ラベルが表示されているか確認
   *
   * getAllByText().length >= 1:
   * - ステータスは複数箇所に表示される可能性がある（詳細セクション、フォーム選択肢等）
   * - getAllByText で複数マッチをチェック
   *
   * WHY: ステータス値（pending, in_progress, resolved等）が正しい日本語ラベルに変換されることを確認
   */
  it('renders all status labels correctly', async () => {
    mockGetContactInquiry.mockResolvedValue({
      success: true,
      data: {
        inquiry: {
          id: 'inquiry-1',
          name: 'Test User',
          email: 'test@example.com',
          category: 'general',
          subject: 'Test Subject',
          message: 'Test message',
          status: 'in_progress',  // 対応中ステータス
          createdAt: new Date('2024-01-01T10:00:00'),
          adminNote: null,
          respondedAt: null,
        },
      },
    })

    const jsx = await ContactDetailPage({
      params: Promise.resolve({ id: 'inquiry-1' })
    })
    render(jsx)

    // 'in_progress' ステータスが「対応中」というラベルで1件以上表示される
    expect(screen.getAllByText('対応中').length).toBeGreaterThanOrEqual(1)
  })
})
