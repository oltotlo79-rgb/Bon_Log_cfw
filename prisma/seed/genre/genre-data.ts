/**
 * 投稿用・盆栽園用ジャンルのシードデータ。
 */

import type { GenreData } from '../shared/types'

// 投稿用ジャンル
export const POST_GENRES: GenreData[] = [
  // 松柏類
  { name: '黒松', category: '松柏類', type: 'post', sortOrder: 1 },
  { name: '赤松', category: '松柏類', type: 'post', sortOrder: 2 },
  { name: '五葉松', category: '松柏類', type: 'post', sortOrder: 3 },
  { name: '真柏', category: '松柏類', type: 'post', sortOrder: 4 },
  { name: '杜松', category: '松柏類', type: 'post', sortOrder: 5 },
  { name: '檜', category: '松柏類', type: 'post', sortOrder: 6 },
  { name: '椹', category: '松柏類', type: 'post', sortOrder: 7 },
  { name: '檜葉/翌檜', category: '松柏類', type: 'post', sortOrder: 8 },
  { name: '杉', category: '松柏類', type: 'post', sortOrder: 9 },
  { name: '一位', category: '松柏類', type: 'post', sortOrder: 10 },
  { name: 'キャラボク', category: '松柏類', type: 'post', sortOrder: 11 },
  { name: '蝦夷松', category: '松柏類', type: 'post', sortOrder: 12 },
  { name: '落葉松', category: '松柏類', type: 'post', sortOrder: 13 },
  { name: '米栂', category: '松柏類', type: 'post', sortOrder: 14 },
  { name: '樅木', category: '松柏類', type: 'post', sortOrder: 15 },
  { name: '榧', category: '松柏類', type: 'post', sortOrder: 16 },
  { name: '槙', category: '松柏類', type: 'post', sortOrder: 17 },
  { name: 'その他松柏類', category: '松柏類', type: 'post', sortOrder: 99 },

  // 雑木類
  { name: '紅葉', category: '雑木類', type: 'post', sortOrder: 1 },
  { name: '楓', category: '雑木類', type: 'post', sortOrder: 2 },
  { name: '匂楓', category: '雑木類', type: 'post', sortOrder: 3 },
  { name: '銀杏', category: '雑木類', type: 'post', sortOrder: 4 },
  { name: '欅', category: '雑木類', type: 'post', sortOrder: 5 },
  { name: '楡欅', category: '雑木類', type: 'post', sortOrder: 6 },
  { name: '梅', category: '雑木類', type: 'post', sortOrder: 7 },
  { name: '長寿梅/木瓜', category: '雑木類', type: 'post', sortOrder: 8 },
  { name: '梅擬', category: '雑木類', type: 'post', sortOrder: 9 },
  { name: '蔓梅擬/岩梅蔓', category: '雑木類', type: 'post', sortOrder: 10 },
  { name: '縮緬蔓', category: '雑木類', type: 'post', sortOrder: 11 },
  { name: '金豆', category: '雑木類', type: 'post', sortOrder: 12 },
  { name: 'ピラカンサ', category: '雑木類', type: 'post', sortOrder: 13 },
  { name: '花梨', category: '雑木類', type: 'post', sortOrder: 14 },
  { name: '台湾黄楊', category: '雑木類', type: 'post', sortOrder: 15 },
  { name: 'イボタ', category: '雑木類', type: 'post', sortOrder: 16 },
  { name: '群雀', category: '雑木類', type: 'post', sortOrder: 17 },
  { name: '香丁木/白丁木', category: '雑木類', type: 'post', sortOrder: 18 },
  { name: '真弓', category: '雑木類', type: 'post', sortOrder: 19 },
  { name: '小真弓', category: '雑木類', type: 'post', sortOrder: 20 },
  { name: 'ブナ', category: '雑木類', type: 'post', sortOrder: 21 },
  { name: '梔子', category: '雑木類', type: 'post', sortOrder: 22 },
  { name: 'グミ', category: '雑木類', type: 'post', sortOrder: 23 },
  { name: '桜', category: '雑木類', type: 'post', sortOrder: 24 },
  { name: '皐月', category: '雑木類', type: 'post', sortOrder: 25 },
  { name: '椿', category: '雑木類', type: 'post', sortOrder: 26 },
  { name: '山茶花', category: '雑木類', type: 'post', sortOrder: 27 },
  { name: '柿', category: '雑木類', type: 'post', sortOrder: 28 },
  { name: '柘榴', category: '雑木類', type: 'post', sortOrder: 29 },
  { name: '百日紅', category: '雑木類', type: 'post', sortOrder: 30 },
  { name: '姫林檎/海棠', category: '雑木類', type: 'post', sortOrder: 31 },
  { name: '柊', category: '雑木類', type: 'post', sortOrder: 32 },
  { name: '針蔓柾', category: '雑木類', type: 'post', sortOrder: 33 },
  { name: '蔦', category: '雑木類', type: 'post', sortOrder: 34 },
  { name: 'イヌビワ', category: '雑木類', type: 'post', sortOrder: 35 },
  { name: '紫式部', category: '雑木類', type: 'post', sortOrder: 36 },
  { name: 'レンギョウ', category: '雑木類', type: 'post', sortOrder: 37 },
  { name: 'その他雑木類', category: '雑木類', type: 'post', sortOrder: 99 },

  // 草もの
  { name: '山野草', category: '草もの', type: 'post', sortOrder: 1 },
  { name: '苔', category: '草もの', type: 'post', sortOrder: 2 },

  // 用品・道具
  { name: '道具', category: '用品・道具', type: 'post', sortOrder: 1 },
  { name: '薬剤・肥料', category: '用品・道具', type: 'post', sortOrder: 2 },
  { name: '鉢', category: '用品・道具', type: 'post', sortOrder: 3 },
  { name: '用土', category: '用品・道具', type: 'post', sortOrder: 4 },
  { name: 'その他用品', category: '用品・道具', type: 'post', sortOrder: 99 },

  // 施設・イベント
  { name: '盆栽園', category: '施設・イベント', type: 'post', sortOrder: 1 },
  { name: '展示会/イベント', category: '施設・イベント', type: 'post', sortOrder: 2 },

  // その他
  { name: '管理方法', category: 'その他', type: 'post', sortOrder: 1 },
  { name: 'その他', category: 'その他', type: 'post', sortOrder: 99 },
]

// 盆栽園用ジャンル
export const SHOP_GENRES: GenreData[] = [
  // サイズ
  { name: 'ミニ盆栽', category: 'サイズ', type: 'shop', sortOrder: 1 },
  { name: '小品盆栽', category: 'サイズ', type: 'shop', sortOrder: 2 },
  { name: '貴風盆栽', category: 'サイズ', type: 'shop', sortOrder: 3 },
  { name: '大品盆栽', category: 'サイズ', type: 'shop', sortOrder: 4 },
  // 用品
  { name: '道具', category: '用品', type: 'shop', sortOrder: 1 },
  { name: '鉢', category: '用品', type: 'shop', sortOrder: 2 },
  { name: '展示用具', category: '用品', type: 'shop', sortOrder: 3 },
  { name: '肥料・用土・薬剤', category: '用品', type: 'shop', sortOrder: 4 },
  { name: '書籍', category: '用品', type: 'shop', sortOrder: 5 },
]
