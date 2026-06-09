# ConfirmDialog 共有コンポーネント設計

## 1. 概要 / 目的

アプリケーション全体で `window.confirm()` が 19 箇所使われており、以下の問題を抱えている。

- ブラウザ標準 `confirm()` はデザインカスタマイズ不可であり、和風 UI との統一が崩れる
- ローディング状態・エラー表示・二重押下防止を実装できない
- JSDOM 環境（Vitest）で `window.confirm` のモック差し替えが必要になりテストが煩雑
- アクセシビリティ要件（フォーカストラップ・ARIA ロール）を満たせない

既存の `@radix-ui/react-alert-dialog`（`components/ui/alert-dialog.tsx`）と
`components/user/DeleteAccountButton.tsx` のパターンを基盤とし、
呼び出し側が 1 コンポーネントを使い回せる共有 `ConfirmDialog` を設計する。

---

## 2. 配置先

`components/common/ConfirmDialog.tsx`

**根拠:** `components/common/` は `FormError`・`PageError` など汎用 UI が置かれる既存のパターン。
`components/ui/` は shadcn/ui プリミティブのレイヤーであり、ロジック（loading/error）を持つ
合成コンポーネントは置かない方針に合わせる。

---

## 3. コンポーネント分割と Server / Client 判定

```
ConfirmDialog (Client Component — 'use client')
└── AlertDialog          (ui/alert-dialog — 'use client'、Radix UIプリミティブ)
    ├── AlertDialogTrigger
    ├── AlertDialogContent
    │   ├── AlertDialogHeader
    │   │   ├── AlertDialogTitle
    │   │   └── AlertDialogDescription
    │   ├── FormError          (components/common/FormError — Server OK、エラー表示)
    │   └── AlertDialogFooter
    │       ├── AlertDialogCancel  (キャンセルボタン)
    │       └── AlertDialogAction  (確認ボタン、loading/disabled 制御)
    └── （trigger なし = 外部 open 制御モード）
```

`ConfirmDialog` 自体は `useState`（loading・error）と非同期 `onConfirm` を扱うため Client Component。
呼び出し側の Server Component がデータを取得し、インタラクティブ部分のリーフとして
`ConfirmDialog` を配置する構造（nextjs-components.md の方針に準拠）。

---

## 4. Props API

```
type ConfirmDialogVariant = 'destructive' | 'warning' | 'discard'

type ConfirmDialogProps = {
  // ---- トリガー制御 ----
  // trigger を渡せば AlertDialogTrigger として動作する（controlled 不要なケース用）
  trigger?: React.ReactNode

  // trigger を渡さない場合は open + onOpenChange で外部から制御する
  open?: boolean
  onOpenChange?: (open: boolean) => void

  // ---- 内容 ----
  title: string
  description: string
  variant?: ConfirmDialogVariant  // デフォルト: 'destructive'

  // ---- ボタン文言（省略時は下記コピー案のデフォルト値） ----
  confirmLabel?: string
  cancelLabel?: string

  // ---- コールバック ----
  // Promise を返す async 関数を渡すと、resolve まで loading 状態になる
  onConfirm: () => Promise<void> | void

  // onConfirm が throw / reject した場合に Dialog 内部でエラーを表示する
  // false にすると ConfirmDialog はエラーを握りつぶし、呼び出し元で処理できる
  showInlineError?: boolean  // デフォルト: true
}
```

### variant ごとの視覚仕様

| variant | 確認ボタンスタイル | 用途 |
|---------|-----------------|------|
| `destructive` | `buttonVariants({ variant: 'destructive' })` — `bg-destructive text-white` | 元に戻せない削除系 |
| `warning` | 琥珀・茶系 — `bg-amber-700 text-white hover:bg-amber-800`（和風トーンで危険を表現） | 不可逆ではないが注意喚起が必要な操作（停止・除外） |
| `discard` | `buttonVariants({ variant: 'outline' })` | 入力破棄・クローズ確認など「戻れる可能性があるが入力を失う」ケース |

`destructive` は既存の `DeleteAccountButton` のスタイルを踏襲する。
`warning` は和風カラーパレット（茶・琥珀）を使い、赤より柔らかく危険を伝える。

---

## 5. 状態とインタラクション

### 5-1. 基本フロー（trigger 付き）

```
[trigger ボタン押下]
  → Dialog オープン（AlertDialog open=true）
  → [キャンセル] → Dialog クローズ（何もしない）
  → [確認ボタン押下]
      → loading=true、確認ボタン disabled、キャンセルボタン disabled
      → onConfirm() を await
      → 成功: Dialog クローズ（open=false）、loading=false
      → 失敗: showInlineError=true なら FormError にエラー文言表示、loading=false
              ダイアログは閉じない（ユーザーが内容を確認してリトライまたはキャンセルできる）
```

### 5-2. 外部 open 制御フロー

呼び出し側が `open` / `onOpenChange` を管理する場合。
`DraftCard` などリスト内の複数アイテムで 1 つのダイアログを再利用するケースに使う。

```
[呼び出し側が open=true をセット]
  → Dialog レンダリング
  → 以降は 5-1 と同様
  → 成功時: ConfirmDialog は onOpenChange(false) を呼ぶ（呼び出し側が状態を閉じる）
```

### 5-3. キーボード操作

- `Escape` → キャンセルと同等（Dialog クローズ）。loading 中は Escape を無効化する（二重操作防止）
- `Tab` → Dialog 内でのみフォーカス循環（Radix UI が保証）
- フォーカス初期位置: Dialog オープン時はキャンセルボタンにフォーカス（`destructive` / `warning`）、`discard` は確認ボタン

**根拠:** `destructive` / `warning` はキャンセル優先（誤操作を防ぐ）。`discard` は入力を「捨ててよい」ことへの確認なので確認ボタン優先でもよい。

### 5-4. 二重押下防止

`loading=true` の間は確認ボタン・キャンセルボタン双方に `disabled` を付与する。
`AlertDialogAction` の `onClick` が呼ばれた後、`ConfirmDialog` 内部で `loading` を管理し、
Radix の `onPointerDownOutside` も無効化（`e.preventDefault()`）することで
ダイアログ外クリックによる意図しないクローズを防ぐ。

### 5-5. エラー表示

`onConfirm` が reject / throw した場合、`FormError` コンポーネント（`components/common/FormError`）を
`AlertDialogFooter` の上（ボタン群の直前）に表示する。
既存の `DeleteAccountButton` と同様の配置パターン（ダイアログ外のエラー表示ではなくインライン）。

---

## 6. 画面構成（ワイヤーフレーム）

```
+--------------------------------------------------+
|  オーバーレイ (bg-black/50)                        |
|                                                  |
|   +----------------------------------------+    |
|   | AlertDialogHeader                      |    |
|   |   AlertDialogTitle                     |    |
|   |   「この下書きを削除しますか？」           |    |
|   |                                        |    |
|   |   AlertDialogDescription               |    |
|   |   「削除した下書きは復元できません。」    |    |
|   +----------------------------------------+    |
|   | FormError (エラー時のみ表示)              |    |
|   |   「削除に失敗しました。再度お試し…」     |    |
|   +----------------------------------------+    |
|   | AlertDialogFooter                      |    |
|   |   [キャンセル]  [削除する ▶]            |    |
|   |   ← outline    ← variant に応じた色    |    |
|   +----------------------------------------+    |
|                                                  |
+--------------------------------------------------+
```

- モバイル: `max-w-[calc(100%-2rem)]`（既存 AlertDialogContent の設定を継承）
- デスクトップ: `sm:max-w-lg`（同上）
- ボタン配置: モバイルは縦並び（col-reverse）、デスクトップは横並び（既存 AlertDialogFooter）

---

## 7. エッジケース

| ケース | 挙動 |
|--------|------|
| onConfirm が void（同期関数）を返す | loading 状態をスキップし即時 close |
| onConfirm が非常に長時間かかる | loading=true のまま維持（タイムアウト設計は呼び出し元の責務） |
| ネットワークエラーで文言が不明 | `MSG_ERROR_FALLBACK` を表示 |
| description に改行が必要 | `whitespace-pre-wrap` を `AlertDialogDescription` に付与（className で対応） |
| trigger なし・open なし の不正 props | variant を問わず static に閉じた状態でレンダリング（open=false） |

---

## 8. 文言定数（lib/constants/messages.ts に追加すべき定数）

### 追加が必要な定数

既存の `MSG_POST_CONFIRM_DISCARD`・`MSG_DRAFT_PUBLISH_CONFIRM` は存在するが、
以下のインライン文字列が定数化されていない。追加を提案する。

```typescript
// ---- 下書き ----
export const MSG_DRAFT_DELETE_CONFIRM_TITLE = 'この下書きを削除しますか？'
export const MSG_DRAFT_DELETE_CONFIRM_DESC  = '削除した下書きは復元できません。'
export const MSG_DRAFT_PUBLISH_CONFIRM_TITLE = 'この下書きを投稿しますか？'
export const MSG_DRAFT_PUBLISH_CONFIRM_DESC  = '下書きが投稿として公開されます。'

// ---- 盆栽 ----
export const MSG_BONSAI_RECORD_DELETE_CONFIRM_TITLE = 'この記録を削除しますか？'
export const MSG_BONSAI_RECORD_DELETE_CONFIRM_DESC  = '削除した記録は復元できません。'
export const MSG_BONSAI_DELETE_CONFIRM_TITLE = (name: string) => `「${name}」を削除しますか？`
export const MSG_BONSAI_DELETE_CONFIRM_DESC  = '盆栽に紐づく成長記録もすべて削除されます。この操作は取り消せません。'

// ---- 投稿フォーム（既存 MSG_POST_CONFIRM_DISCARD を title/desc に分割） ----
export const MSG_POST_CONFIRM_DISCARD_TITLE = '入力内容を破棄しますか？'
// MSG_POST_CONFIRM_DISCARD は description として流用可（既存定数維持）
export const MSG_POST_UPLOAD_CANCEL_TITLE   = 'アップロードをキャンセルしますか？'
export const MSG_POST_UPLOAD_CANCEL_DESC    = 'アップロード中のメディアはすべて破棄されます。'

// ---- admin ----
export const MSG_ADMIN_USER_ACTIVATE_CONFIRM_TITLE = 'このユーザーのアカウントを復帰させますか？'
export const MSG_ADMIN_USER_ACTIVATE_CONFIRM_DESC  = 'ユーザーは再度ログイン・投稿できるようになります。'
export const MSG_ADMIN_BLACKLIST_EMAIL_REMOVE_TITLE = 'ブラックリストから削除しますか？'
export const MSG_ADMIN_BLACKLIST_EMAIL_REMOVE_DESC  = (email: string) => `${email} をブラックリストから削除します。`
export const MSG_ADMIN_BLACKLIST_DEVICE_REMOVE_TITLE = 'デバイスをブラックリストから削除しますか？'
export const MSG_ADMIN_BLACKLIST_DEVICE_REMOVE_DESC  = 'このデバイスの制限が解除されます。'
export const MSG_ADMIN_SEGMENT_DELETE_CONFIRM_TITLE = 'このセグメントを削除しますか？'
export const MSG_ADMIN_SEGMENT_DELETE_CONFIRM_DESC  = 'セグメントに紐づく配信設定に影響が出る場合があります。'
export const MSG_ADMIN_ROLE_REMOVE_CONFIRM_TITLE = 'この管理者の権限を削除しますか？'
export const MSG_ADMIN_ROLE_REMOVE_CONFIRM_DESC  = '権限を削除すると、管理機能へのアクセスが失われます。'
export const MSG_ADMIN_HIDDEN_RESTORE_TITLE  = 'コンテンツを再表示しますか？'
export const MSG_ADMIN_HIDDEN_RESTORE_DESC   = 'ユーザーに再びコンテンツが表示されるようになります。'
export const MSG_ADMIN_HIDDEN_DELETE_TITLE   = 'コンテンツを完全に削除しますか？'
export const MSG_ADMIN_HIDDEN_DELETE_DESC    = 'この操作は取り消せません。'
export const MSG_ADMIN_CMS_DELETE_TITLE      = 'このページを削除しますか？'
export const MSG_ADMIN_CMS_DELETE_DESC       = '削除したページは復元できません。'
export const MSG_ADMIN_CONTACT_DELETE_TITLE  = 'このお問い合わせを削除しますか？'
export const MSG_ADMIN_CONTACT_DELETE_DESC   = 'この操作は元に戻せません。'
export const MSG_ADMIN_ANNOUNCEMENT_DELETE_TITLE = 'このお知らせを削除しますか？'
export const MSG_ADMIN_ANNOUNCEMENT_DELETE_DESC  = '削除したお知らせは復元できません。'
```

### ボタンデフォルト文言

| variant | confirmLabel デフォルト | cancelLabel デフォルト |
|---------|----------------------|----------------------|
| destructive | 削除する | キャンセル |
| warning | 実行する | キャンセル |
| discard | 破棄する | 続けて編集 |

---

## 9. 既存 confirm() 全置換マッピング表

| # | ファイル | 現在の文言 | variant | title 定数 | description 定数 | confirmLabel |
|---|---------|-----------|---------|-----------|-----------------|-------------|
| 1 | `components/draft/DraftEditForm.tsx:148` | `MSG_DRAFT_PUBLISH_CONFIRM` | `warning` | `MSG_DRAFT_PUBLISH_CONFIRM_TITLE` | `MSG_DRAFT_PUBLISH_CONFIRM_DESC` | 投稿する |
| 2 | `components/draft/DraftEditForm.tsx:185` | `この下書きを削除しますか？` | `destructive` | `MSG_DRAFT_DELETE_CONFIRM_TITLE` | `MSG_DRAFT_DELETE_CONFIRM_DESC` | 削除する |
| 3 | `components/draft/DraftCard.tsx:57` | `この下書きを削除しますか？` | `destructive` | `MSG_DRAFT_DELETE_CONFIRM_TITLE` | `MSG_DRAFT_DELETE_CONFIRM_DESC` | 削除する |
| 4 | `components/draft/DraftCard.tsx:75` | `この下書きを投稿しますか？` | `warning` | `MSG_DRAFT_PUBLISH_CONFIRM_TITLE` | `MSG_DRAFT_PUBLISH_CONFIRM_DESC` | 投稿する |
| 5 | `components/bonsai/BonsaiTimeline.tsx:91` | `この記録を削除しますか？` | `destructive` | `MSG_BONSAI_RECORD_DELETE_CONFIRM_TITLE` | `MSG_BONSAI_RECORD_DELETE_CONFIRM_DESC` | 削除する |
| 6 | `components/bonsai/BonsaiActions.tsx:58` | `「${bonsaiName}」を削除しますか？\n成長記録も…` | `destructive` | `MSG_BONSAI_DELETE_CONFIRM_TITLE(bonsaiName)` | `MSG_BONSAI_DELETE_CONFIRM_DESC` | 削除する |
| 7 | `components/post/PostFormModal.tsx:134` | `アップロード中です。キャンセルしてもよろしいですか？` | `warning` | `MSG_POST_UPLOAD_CANCEL_TITLE` | `MSG_POST_UPLOAD_CANCEL_DESC` | キャンセルする |
| 8 | `components/post/PostFormModal.tsx:139` | `MSG_POST_CONFIRM_DISCARD` | `discard` | `MSG_POST_CONFIRM_DISCARD_TITLE` | `MSG_POST_CONFIRM_DISCARD` | 破棄する |
| 9 | `app/admin/users/UserActionsDropdown.tsx:69` | `このユーザーのアカウントを復帰させますか？` | `warning` | `MSG_ADMIN_USER_ACTIVATE_CONFIRM_TITLE` | `MSG_ADMIN_USER_ACTIVATE_CONFIRM_DESC` | 復帰させる |
| 10 | `app/admin/segments/SegmentBuilder.tsx:49` | `このセグメントを削除しますか?` | `destructive` | `MSG_ADMIN_SEGMENT_DELETE_CONFIRM_TITLE` | `MSG_ADMIN_SEGMENT_DELETE_CONFIRM_DESC` | 削除する |
| 11 | `app/admin/roles/RolesTable.tsx:75` | `この管理者の権限を削除しますか?` | `destructive` | `MSG_ADMIN_ROLE_REMOVE_CONFIRM_TITLE` | `MSG_ADMIN_ROLE_REMOVE_CONFIRM_DESC` | 削除する |
| 12 | `app/admin/hidden/HiddenContentList.tsx:32` | `このコンテンツを再表示しますか？` | `warning` | `MSG_ADMIN_HIDDEN_RESTORE_TITLE` | `MSG_ADMIN_HIDDEN_RESTORE_DESC` | 再表示する |
| 13 | `app/admin/hidden/HiddenContentList.tsx:46` | `このコンテンツを完全に削除しますか？この操作は取り消せません。` | `destructive` | `MSG_ADMIN_HIDDEN_DELETE_TITLE` | `MSG_ADMIN_HIDDEN_DELETE_DESC` | 削除する |
| 14 | `app/admin/content-management/CmsPageList.tsx:110` | `このページを削除しますか?` | `destructive` | `MSG_ADMIN_CMS_DELETE_TITLE` | `MSG_ADMIN_CMS_DELETE_DESC` | 削除する |
| 15 | `app/admin/contact/[id]/ContactDetailActions.tsx:58` | `このお問い合わせを削除しますか？この操作は元に戻せません。` | `destructive` | `MSG_ADMIN_CONTACT_DELETE_TITLE` | `MSG_ADMIN_CONTACT_DELETE_DESC` | 削除する |
| 16 | `app/admin/contact/ContactActionsDropdown.tsx:120` | 同上 | `destructive` | `MSG_ADMIN_CONTACT_DELETE_TITLE` | `MSG_ADMIN_CONTACT_DELETE_DESC` | 削除する |
| 17 | `app/admin/blacklist/BlacklistTabs.tsx:184` | `このメールアドレスをブラックリストから削除しますか？` | `warning` | `MSG_ADMIN_BLACKLIST_EMAIL_REMOVE_TITLE` | `MSG_ADMIN_BLACKLIST_EMAIL_REMOVE_DESC(email)` | 削除する |
| 18 | `app/admin/blacklist/BlacklistTabs.tsx:199` | `このデバイスをブラックリストから削除しますか？` | `warning` | `MSG_ADMIN_BLACKLIST_DEVICE_REMOVE_TITLE` | `MSG_ADMIN_BLACKLIST_DEVICE_REMOVE_DESC` | 削除する |
| 19 | `app/admin/announcements/AnnouncementList.tsx:106` | `このお知らせを削除しますか?` | `destructive` | `MSG_ADMIN_ANNOUNCEMENT_DELETE_TITLE` | `MSG_ADMIN_ANNOUNCEMENT_DELETE_DESC` | 削除する |

---

## 10. 呼び出しパターン（実装担当向け）

### パターン A: trigger を内包する（コンパクトな使い方）

`DraftCard`・`BonsaiActions` のように「ボタン → ダイアログ」が 1 コンポーネント内で完結するケース。

```
<ConfirmDialog
  trigger={<button>削除</button>}
  variant="destructive"
  title={MSG_DRAFT_DELETE_CONFIRM_TITLE}
  description={MSG_DRAFT_DELETE_CONFIRM_DESC}
  confirmLabel="削除する"
  onConfirm={handleDelete}
/>
```

ポイント: `handleDelete` の戻り値を `async` にして `Promise<void>` を返すと loading 状態が自動管理される。
`onConfirm` 内で `toast` 成功通知を出した後、Dialog は自動でクローズされる。
エラー時は `throw new Error(result.error)` すると `FormError` に表示される。

### パターン B: 外部 open 制御（同じダイアログを複数アイテムで共有）

リスト表示で各行に削除ボタンがある場合、毎行に `ConfirmDialog` をレンダリングするとDOM が肥大する。
親コンポーネントで `targetId` と `open` を state 管理し、ダイアログは 1 つだけ配置する。

```
// 親コンポーネント側のイメージ
const [confirmTarget, setConfirmTarget] = useState<string | null>(null)

<ConfirmDialog
  open={confirmTarget !== null}
  onOpenChange={(v) => { if (!v) setConfirmTarget(null) }}
  variant="destructive"
  title={MSG_DRAFT_DELETE_CONFIRM_TITLE}
  description={MSG_DRAFT_DELETE_CONFIRM_DESC}
  onConfirm={async () => {
    if (!confirmTarget) return
    const result = await deleteDraft(confirmTarget)
    if (!result.success) throw new Error(result.error)
    router.refresh()
  }}
/>
```

### パターン C: DraftEditForm 内（既存ロジックを確認→Action の順で書き換え）

`DraftEditForm` の `handlePublish` / `handleDelete` は現在

```
if (!confirm('...')) return
setPublishing(true)
...
```

という構造。ConfirmDialog 置換後は「確認ダイアログが onConfirm を呼ぶ」モデルに変わるため、
`setPublishing` のような中間 state は `onConfirm` の async 中に移動させる。

---

## 11. アクセシビリティ仕様

- `AlertDialog`（Radix UI）はデフォルトで `role="alertdialog"` と `aria-modal="true"` を付与する。
  追加の ARIA 属性は不要。
- `AlertDialogTitle` が `aria-labelledby` の対象として自動紐付けされる（Radix）。
- `AlertDialogDescription` が `aria-describedby` の対象として自動紐付けされる（Radix）。
- loading 中の確認ボタンに `aria-disabled="true"` と `aria-label="処理中"` を付与する。
- `variant="destructive"` のボタンは `bg-destructive text-white` で WCAG AA のコントラスト比（4.5:1 以上）を満たす。
  `variant="warning"` は `bg-amber-700 text-white` とし、4.5:1 を満たすことを実装時に確認すること。

---

## 12. 既存との一貫性メモ

| 要素 | 流用元 |
|------|--------|
| AlertDialog プリミティブ | `components/ui/alert-dialog.tsx` |
| loading / error パターン | `components/user/DeleteAccountButton.tsx` |
| エラー表示コンポーネント | `components/common/FormError.tsx` |
| destructive ボタンスタイル | `DeleteAccountButton` の `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| confirm ボタンの disabled スタイル | shadcn Button の `disabled:opacity-50` |
| メッセージ定数の命名規則 | `lib/constants/messages.ts` の `MSG_XXX_CONFIRM` 系 |

---

## 13. 実装上の注意点

1. **`onConfirm` が同期 void を返す場合の分岐:** `onConfirm()` の戻り値が `Promise` かどうかを
   `instanceof Promise` ではなく `then` の有無（`Thenable` チェック）で判定する。
   これにより `async` でない通常関数も安全に扱える。

2. **`PostFormModal` の 2 段確認:** `PostFormModal` には「アップロード中」と「入力あり」の 2 パターンの
   確認が同じ `handleClose` 関数に存在する。それぞれ別の `ConfirmDialog` インスタンス（または
   `open` 制御の切り替え）として実装する。state で `confirmType: 'upload' | 'discard' | null` を
   管理し、`confirmType` に応じて title/description を切り替えるのが最小差分での実装方法。

3. **admin ページの `confirm()` は UI 改善優先度がやや低い:** admin は内部ツールであり
   `DeleteAccountButton` のような精緻なエラー表示は必須ではないが、a11y・テスト容易性の観点で
   全置換を推奨する。`UserActionsDropdown` はすでに独自のモーダル（`showSuspendModal`）を持つため、
   `handleActivate` の `confirm()` 置換のみ対応すればよい。

4. **Radix の `onPointerDownOutside` 制御:** loading 中はオーバーレイクリックによるクローズを
   防ぐために `event.preventDefault()` を `AlertDialogContent` の `onPointerDownOutside` に渡す。
   これは `DeleteAccountButton` では実装されていないが、async 操作中のダイアログでは必要。

---

## 14. コピー案（デフォルト文言）

| 用途 | title | description |
|------|-------|-------------|
| 下書き削除 | この下書きを削除しますか？ | 削除した下書きは復元できません。 |
| 下書き投稿 | この下書きを投稿しますか？ | 下書きが投稿として公開されます。 |
| 盆栽記録削除 | この記録を削除しますか？ | 削除した記録は復元できません。 |
| 盆栽削除 | 「○○」を削除しますか？ | 盆栽に紐づく成長記録もすべて削除されます。この操作は取り消せません。 |
| 投稿入力破棄 | 入力内容を破棄しますか？ | 入力したテキストやメディアはすべて失われます。 |
| アップロードキャンセル | アップロードをキャンセルしますか？ | アップロード中のメディアはすべて破棄されます。 |
| ユーザー復帰（admin） | このユーザーのアカウントを復帰させますか？ | ユーザーは再度ログイン・投稿できるようになります。 |
| ブラックリスト削除（admin） | ブラックリストから削除しますか？ | （対象メールアドレス/デバイス） の制限が解除されます。 |
