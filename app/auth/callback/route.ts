// このファイルはSupabase OAuth用でしたが、NextAuth.jsへの移行により不要になりました
// NextAuth.jsはapi/auth/[...nextauth]/route.tsで認証コールバックを処理します

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  // NextAuth.jsを使用しているため、/api/auth/signinにリダイレクト
  return NextResponse.redirect(`${origin}/login`)
}
