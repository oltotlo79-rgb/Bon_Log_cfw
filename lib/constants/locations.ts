/**
 * 居住地域の選択肢定義
 *
 * @module lib/constants/locations
 */

/**
 * 居住地域の選択肢（グループ化）
 *
 * ## データ構造
 * ```typescript
 * {
 *   label: 'グループ名',    // セレクトボックスのグループラベル
 *   options: [
 *     { value: '値', label: '表示ラベル' },
 *     ...
 *   ]
 * }
 * ```
 *
 * ## グループ一覧
 * 1. **日本の地方**: 広域的な地方区分（北海道、東北、関東など）
 * 2. **都道府県**: 47都道府県の詳細選択
 * 3. **国・地域**: 海外の主要国
 * 4. **大陸・地域**: より広域な地理区分
 * 5. **その他**: 海外、非公開など
 *
 * ## 使用例（React Select）
 * ```tsx
 * import { LOCATION_GROUPS } from '@/lib/constants/locations'
 *
 * <Select>
 *   {LOCATION_GROUPS.map(group => (
 *     <optgroup key={group.label} label={group.label}>
 *       {group.options.map(option => (
 *         <option key={option.value} value={option.value}>
 *           {option.label}
 *         </option>
 *       ))}
 *     </optgroup>
 *   ))}
 * </Select>
 * ```
 *
 * ## 使用例（shadcn/ui Select）
 * ```tsx
 * <Select>
 *   <SelectTrigger>
 *     <SelectValue placeholder="地域を選択" />
 *   </SelectTrigger>
 *   <SelectContent>
 *     {LOCATION_GROUPS.map(group => (
 *       <SelectGroup key={group.label}>
 *         <SelectLabel>{group.label}</SelectLabel>
 *         {group.options.map(option => (
 *           <SelectItem key={option.value} value={option.value}>
 *             {option.label}
 *           </SelectItem>
 *         ))}
 *       </SelectGroup>
 *     ))}
 *   </SelectContent>
 * </Select>
 * ```
 */
export const LOCATION_GROUPS = [
  /**
   * 日本の地方ブロック
   *
   * 広域的な地方区分。
   * 詳細な都道府県を選びたくないユーザー向け。
   */
  {
    label: '日本の地方',
    options: [
      { value: '北海道', label: '北海道' },
      { value: '東北', label: '東北' },
      { value: '関東', label: '関東' },
      { value: '北陸', label: '北陸' },
      { value: '甲信越', label: '甲信越' },
      { value: '東海', label: '東海' },
      { value: '近畿', label: '近畿' },
      { value: '中国地方', label: '中国地方' },
      { value: '四国', label: '四国' },
      { value: '九州', label: '九州' },
      { value: '沖縄', label: '沖縄' },
    ],
  },

  /**
   * 47都道府県
   *
   * 詳細な居住地を設定したいユーザー向け。
   * 北から南への順序で配置。
   */
  {
    label: '都道府県',
    options: [
      // === 北海道 ===
      { value: '北海道', label: '北海道' },

      // === 東北地方 ===
      { value: '青森県', label: '青森県' },
      { value: '岩手県', label: '岩手県' },
      { value: '宮城県', label: '宮城県' },
      { value: '秋田県', label: '秋田県' },
      { value: '山形県', label: '山形県' },
      { value: '福島県', label: '福島県' },

      // === 関東地方 ===
      { value: '茨城県', label: '茨城県' },
      { value: '栃木県', label: '栃木県' },
      { value: '群馬県', label: '群馬県' },
      { value: '埼玉県', label: '埼玉県' },
      { value: '千葉県', label: '千葉県' },
      { value: '東京都', label: '東京都' },
      { value: '神奈川県', label: '神奈川県' },

      // === 甲信越地方 ===
      { value: '新潟県', label: '新潟県' },
      { value: '山梨県', label: '山梨県' },
      { value: '長野県', label: '長野県' },

      // === 北陸地方 ===
      { value: '富山県', label: '富山県' },
      { value: '石川県', label: '石川県' },
      { value: '福井県', label: '福井県' },

      // === 東海地方 ===
      { value: '岐阜県', label: '岐阜県' },
      { value: '静岡県', label: '静岡県' },
      { value: '愛知県', label: '愛知県' },
      { value: '三重県', label: '三重県' },

      // === 近畿地方 ===
      { value: '滋賀県', label: '滋賀県' },
      { value: '京都府', label: '京都府' },
      { value: '大阪府', label: '大阪府' },
      { value: '兵庫県', label: '兵庫県' },
      { value: '奈良県', label: '奈良県' },
      { value: '和歌山県', label: '和歌山県' },

      // === 中国地方 ===
      { value: '鳥取県', label: '鳥取県' },
      { value: '島根県', label: '島根県' },
      { value: '岡山県', label: '岡山県' },
      { value: '広島県', label: '広島県' },
      { value: '山口県', label: '山口県' },

      // === 四国地方 ===
      { value: '徳島県', label: '徳島県' },
      { value: '香川県', label: '香川県' },
      { value: '愛媛県', label: '愛媛県' },
      { value: '高知県', label: '高知県' },

      // === 九州地方 ===
      { value: '福岡県', label: '福岡県' },
      { value: '佐賀県', label: '佐賀県' },
      { value: '長崎県', label: '長崎県' },
      { value: '熊本県', label: '熊本県' },
      { value: '大分県', label: '大分県' },
      { value: '宮崎県', label: '宮崎県' },
      { value: '鹿児島県', label: '鹿児島県' },

      // === 沖縄 ===
      { value: '沖縄県', label: '沖縄県' },
    ],
  },

  /**
   * 国・地域
   *
   * 海外在住ユーザー向けの選択肢。
   * 盆栽愛好家が多い国を中心にリストアップ。
   *
   * ## 盆栽の国際的人気
   * 盆栽は「Bonsai」として世界的に知られており、
   * 特にアジア、ヨーロッパ、北米で人気があります。
   */
  {
    label: '国・地域',
    options: [
      // === アジア ===
      { value: '日本', label: '日本' },
      { value: '台湾', label: '台湾' },
      { value: '韓国', label: '韓国' },
      { value: '中国', label: '中国' },
      { value: '香港', label: '香港' },
      { value: 'シンガポール', label: 'シンガポール' },
      { value: 'タイ', label: 'タイ' },
      { value: 'ベトナム', label: 'ベトナム' },
      { value: 'インドネシア', label: 'インドネシア' },
      { value: 'フィリピン', label: 'フィリピン' },
      { value: 'マレーシア', label: 'マレーシア' },
      { value: 'インド', label: 'インド' },

      // === オセアニア ===
      { value: 'オーストラリア', label: 'オーストラリア' },
      { value: 'ニュージーランド', label: 'ニュージーランド' },

      // === 北米・中南米 ===
      { value: 'アメリカ', label: 'アメリカ' },
      { value: 'カナダ', label: 'カナダ' },
      { value: 'メキシコ', label: 'メキシコ' },
      { value: 'ブラジル', label: 'ブラジル' },

      // === ヨーロッパ ===
      { value: 'イギリス', label: 'イギリス' },
      { value: 'フランス', label: 'フランス' },
      { value: 'ドイツ', label: 'ドイツ' },
      { value: 'イタリア', label: 'イタリア' },
      { value: 'スペイン', label: 'スペイン' },
      { value: 'オランダ', label: 'オランダ' },
      { value: 'ベルギー', label: 'ベルギー' },
      { value: 'スイス', label: 'スイス' },
    ],
  },

  /**
   * 大陸・地域
   *
   * 特定の国を選びたくない場合や、
   * 複数の国にまたがって活動している場合向け。
   */
  {
    label: '大陸・地域',
    options: [
      { value: 'アジア', label: 'アジア' },
      { value: '東南アジア', label: '東南アジア' },
      { value: 'ヨーロッパ', label: 'ヨーロッパ' },
      { value: '北アメリカ', label: '北アメリカ' },
      { value: '南アメリカ', label: '南アメリカ' },
      { value: 'オセアニア', label: 'オセアニア' },
      { value: 'アフリカ', label: 'アフリカ' },
      { value: '中東', label: '中東' },
    ],
  },

  /**
   * その他
   *
   * 上記に当てはまらない場合や、
   * プライバシーを重視するユーザー向け。
   */
  {
    label: 'その他',
    options: [
      { value: '海外', label: '海外' },
      { value: '非公開', label: '非公開' },
    ],
  },
]

/**
 * 全ての地域オプション（フラット配列）
 *
 * ## 機能概要
 * グループ化された LOCATION_GROUPS を1次元配列に展開します。
 *
 * ## flatMap() の解説
 * ```typescript
 * // 元の構造
 * [
 *   { label: 'グループ1', options: [opt1, opt2] },
 *   { label: 'グループ2', options: [opt3, opt4] },
 * ]
 *
 * // flatMap 後
 * [opt1, opt2, opt3, opt4]
 * ```
 *
 * ## 用途
 * - 地域名のバリデーション
 * - 地域名から value を検索
 * - 全地域の一覧表示（グループ不要な場合）
 *
 * ## 使用例
 * ```typescript
 * // 入力値のバリデーション
 * const isValidLocation = ALL_LOCATIONS.some(
 *   loc => loc.value === userInput
 * )
 *
 * // 地域名から label を取得
 * const locationLabel = ALL_LOCATIONS.find(
 *   loc => loc.value === user.location
 * )?.label
 * ```
 */
export const ALL_LOCATIONS = LOCATION_GROUPS.flatMap((group) => group.options)
