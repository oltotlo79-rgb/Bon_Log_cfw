/**
 * 複数の Action / Service / Server Component で繰り返し使う Prisma
 * `include` / `select` 断片を集約する。
 *
 * 配置先について:
 *   元々 `lib/actions/shared-includes.ts` にあったが、純粋な Prisma 形状定数で
 *   実体は Action と無関係。`lib/services/` から参照すると依存方向の規約
 *   (services → actions の逆 import 禁止) に抵触するため、レイヤ中立な
 *   `lib/prisma/` 配下へ移動した。旧パスへの re-export ファイルは残していない
 *   (29 箇所の import を全て新パスに揃えたため)。
 *
 * - `as const` で型推論を維持（Prisma の型チェックが効く）
 * - 値は定数のためクライアント/Edge からの import も安全
 * - 微妙に形が違うケース（where や orderBy 付き）は無理に共通化せず、
 *   各ファイル側で個別定義する
 *
 * @module lib/prisma/shared-includes
 */

/**
 * `User` 関連のリレーションで表示に必要な最小フィールド。
 *
 * コメント・投稿・メッセージ送信者など、プロフィール情報を一行で出す
 * ほぼすべての箇所に使える。機密情報（email / password / isSuspended 等）は含めない。
 */
export const USER_MINIMAL_SELECT = {
  id: true,
  nickname: true,
  avatarUrl: true,
} as const

/**
 * {@link USER_MINIMAL_SELECT} を `{ select: {...} }` でラップした形。
 * `include: { user: USER_MINIMAL_RELATION }` として Prisma include に直接渡せる。
 */
export const USER_MINIMAL_RELATION = {
  select: USER_MINIMAL_SELECT,
} as const

/**
 * プロフィール表示で bio を含めたい箇所向けの select。
 * フォロー一覧・メンション候補・通知のサブ情報など、ユーザー一覧で「自己紹介の先頭数文字」を
 * 添えたいケースで使う。{@link USER_MINIMAL_SELECT} を spread して bio を追加。
 */
export const USER_MINIMAL_WITH_BIO_SELECT = {
  ...USER_MINIMAL_SELECT,
  bio: true,
} as const

/** `Genre` 関連でカード表示などに必要な最小フィールド。 */
export const GENRE_MINIMAL_SELECT = {
  id: true,
  name: true,
  category: true,
} as const

/**
 * 中間テーブル `PostGenre` 越しにジャンルを取得する際の select 形状。
 *   `genres: POST_GENRE_RELATION`
 * のように使うと `post.genres[i].genre = {id, name, category}` になる。
 */
export const POST_GENRE_RELATION = {
  select: {
    genre: { select: GENRE_MINIMAL_SELECT },
  },
} as const
