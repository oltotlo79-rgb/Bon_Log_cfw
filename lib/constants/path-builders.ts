/**
 * 動的パスビルダー
 *
 * ID / slug / クエリパラメータを含む URL を型安全に生成する。
 * `/users/${id}` のような直書きを避け、定義箇所を一元化する。
 *
 * @module lib/constants/path-builders
 */

export const buildUserPath = (id: string) => `/users/${id}`
export const buildUserPostsPath = (id: string) => `/users/${id}/posts`
export const buildUserFollowingPath = (id: string) => `/users/${id}/following`
export const buildUserFollowersPath = (id: string) => `/users/${id}/followers`
export const buildUserLikesPath = (id: string) => `/users/${id}/likes`

export const buildPostPath = (id: string) => `/posts/${id}`
export const buildPostEditPath = (id: string) => `/posts/${id}/edit`
export const buildScheduledPostEditPath = (id: string) => `/posts/scheduled/${id}/edit`

export const buildBonsaiPath = (id: string) => `/bonsai/${id}`
export const buildBonsaiEditPath = (id: string) => `/bonsai/${id}/edit`

export const buildDraftEditPath = (id: string) => `/drafts/${id}/edit`

export const buildShopPath = (id: string) => `/shops/${id}`
export const buildShopEditPath = (id: string) => `/shops/${id}/edit`

export const buildEventPath = (id: string) => `/events/${id}`
export const buildEventEditPath = (id: string) => `/events/${id}/edit`

export const buildMessageConversationPath = (id: string) => `/messages/${id}`

export const buildDictionaryPath = (slug: string) => `/dictionary/${slug}`
export const buildDictionaryFilterPath = (category: string) =>
  `/dictionary?category=${encodeURIComponent(category)}`

export const buildPesticideProductPath = (slug: string) => `/pesticides/products/${slug}`
export const buildPesticideIngredientPath = (slug: string) => `/pesticides/ingredients/${slug}`
export const buildPesticideColumnPath = (slug: string) => `/pesticides/columns/${slug}`
export const buildPesticideSpreaderPath = (slug: string) => `/pesticides/spreaders/${slug}`
export const buildPesticideDiseasePestPath = (slug: string) => `/pesticides/diseases-pests/${slug}`
export const buildPesticideFormulationsPath = (code: string) =>
  `/pesticides/formulations?formulation=${encodeURIComponent(code)}`
export const buildPesticideSpreaderFilterPath = (slug: string) =>
  `/pesticides/spreaders?type=${encodeURIComponent(slug)}`
export const buildPesticideFilterPath = (diseasePestId: string) =>
  `/pesticides?diseasePest=${diseasePestId}`

export const buildFertilizerNutrientPath = (slug: string) => `/fertilizers/nutrients/${slug}`
export const buildFertilizerSchedulePath = (slug: string) => `/fertilizers/schedules/${slug}`
export const buildFertilizerColumnPath = (slug: string) => `/fertilizers/columns/${slug}`

export const buildHormonePath = (slug: string) => `/hormones/${slug}`
export const buildHormoneColumnPath = (slug: string) => `/hormones/columns/${slug}`

export const buildSearchPath = (query: string) =>
  `/search?q=${encodeURIComponent(query)}`
export const buildSearchByGenrePath = (id: string) => `/search?genre=${id}`

export const buildAdminUserPath = (id: string) => `/admin/users/${id}`
export const buildAdminUserActivityPath = (id: string) => `/admin/users/${id}/activity`
export const buildAdminPesticideDataPath = (id: string) => `/admin/pesticide-data/${id}`
export const buildAdminContactPath = (id: string) => `/admin/contact/${id}`
export const buildAdminContentManagementPath = (slug: string) =>
  `/admin/content-management/${slug}`
