/**
 * @module lib/storage/image-sanitize
 *
 * 画像 buffer の EXIF / IPTC / XMP メタデータを剥離する。
 *
 * Why: ユーザーがスマホで撮影した画像には GPS 座標・撮影機材・撮影時刻が含まれる
 * ことがある。これを R2 / Supabase の公開 URL からそのまま配信すると、ストーカー
 * 行為や個人特定リスクに直結するため、サーバー側で必ず剥離する。
 *
 * クライアント側 (`lib/client-image-compression.ts`) も Canvas 再エンコードで
 * 一定のメタデータを落とすが、SKIP_COMPRESSION_THRESHOLD 以下の小サイズ画像や
 * presigned PUT 経路はバイパスされる。サーバー側でこの helper を通すのが最終防壁。
 */

import 'server-only'

import sharp from 'sharp'
import logger from '@/lib/logger'

const IMAGE_MIME_PREFIX = 'image/'
// SVG は sharp の rasterize 対象になるが、ベクター画像はメタデータ剥離より
// `lib/sanitize.ts` 側の XSS sanitize が責務分離として正しいためここでは触らない。
const SKIP_MIME_TYPES = new Set(['image/svg+xml'])

/**
 * 画像 buffer から EXIF / GPS / IPTC / XMP を剥離して新しい buffer を返す。
 * 画像でない MIME や SVG はそのまま返す。失敗時も原本を返し upload を止めない
 * （ベストエフォート方針）。
 *
 * Why rotate(): EXIF orientation を見て自動回転した上でメタデータを剥離する。
 * EXIF を消すと回転情報が失われるため、剥離前に物理的な画素データへ焼き込む必要がある。
 */
export async function stripImageMetadata(buffer: Buffer, contentType: string): Promise<Buffer> {
  if (!contentType.startsWith(IMAGE_MIME_PREFIX)) return buffer
  if (SKIP_MIME_TYPES.has(contentType)) return buffer

  try {
    // `withMetadata({})` を渡さないことで EXIF / IPTC / XMP / ICC profile を含めず再エンコード。
    // rotate() で EXIF orientation を物理画素に焼き込んでから出力する。
    return await sharp(buffer).rotate().toBuffer()
  } catch (error) {
    logger.error('stripImageMetadata failed', {
      error: error instanceof Error ? error.message : String(error),
      contentType,
    })
    return buffer
  }
}
