/**
 * PWAアイコンを logo.png から生成するスクリプト
 *
 * ホームに追加時のスプラッシュで「黒丸」ではなくアプリロゴが表示されるように、
 * icon-192.png / icon-512.png / icon-512-maskable.png を logo.png ベースで作成する。
 *
 * 実行: node scripts/generate-pwa-icons.mjs
 * または: npm run icons:pwa
 *
 * 出力: public/icon-192.png, public/icon-512.png, public/icon-512-maskable.png
 */

import sharp from 'sharp'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const logoPath = path.join(publicDir, 'logo.png')

const SIZES = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

// maskable: 端が円形にクロップされてもロゴが切れないよう、中央80%に収める
const MASKABLE_SIZE = 512
const MASKABLE_SAFE_RATIO = 0.8 // 中央80%が安全域
const MASKABLE_OUTPUT = 'icon-512-maskable.png'

async function main() {
  if (!existsSync(logoPath)) {
    console.error('public/logo.png が見つかりません。')
    process.exit(1)
  }

  const logo = sharp(logoPath)
  const meta = await logo.metadata()
  const width = meta.width || 1
  const height = meta.height || 1

  console.log('logo.png から PWA アイコンを生成します...')

  for (const { name, size } of SIZES) {
    await logo
      .clone()
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, name))
    console.log('  - %s', name)
  }

  // maskable: 512x512 のキャンバスに、ロゴを中央80%（410px）で配置
  const safeSize = Math.floor(MASKABLE_SIZE * MASKABLE_SAFE_RATIO)
  const padded = await logo
    .clone()
    .resize(safeSize, safeSize)
    .png()
    .toBuffer()

  const left = Math.floor((MASKABLE_SIZE - safeSize) / 2)
  await sharp({
    create: {
      width: MASKABLE_SIZE,
      height: MASKABLE_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: padded, left, top: left }])
    .png()
    .toFile(path.join(publicDir, MASKABLE_OUTPUT))

  console.log('  - %s (maskable)', MASKABLE_OUTPUT)
  console.log('完了。site.webmanifest の maskable は %s を参照してください。', MASKABLE_OUTPUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
