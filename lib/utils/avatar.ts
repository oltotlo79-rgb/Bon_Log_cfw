/**
 * ユーザーIDから円相アバターのパスを決定する
 * IDのハッシュ値を使って5種類のアバターから1つを選択
 */
export function getDefaultAvatarPath(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  const index = (Math.abs(hash) % 5) + 1
  return `/images/generated/avatars/enso-avatar-${index}.webp`
}
