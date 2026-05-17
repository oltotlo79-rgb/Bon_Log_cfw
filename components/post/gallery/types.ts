/**
 * 画像・動画ギャラリー共通型定義
 *
 * @module components/post/gallery/types
 */

/**
 * メディア型
 *
 * 投稿に添付された画像・動画の情報
 *
 * @property id - メディアの一意識別子
 * @property url - メディアのURL
 * @property type - メディアタイプ（'image' または 'video'）
 * @property sortOrder - 表示順序（0から開始）
 */
export type Media = {
  id: string
  url: string
  type: string
  sortOrder: number
}

/**
 * ImageGalleryコンポーネントのProps型
 *
 * @property images - 表示するメディアの配列
 * @property onMediaClick - メディアクリック時のカスタムハンドラ（省略時はモーダル表示）
 */
export type ImageGalleryProps = {
  images: Media[]
  onMediaClick?: (media: Media) => void
}
