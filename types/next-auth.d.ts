import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      isAdmin?: boolean
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    // NextAuth の User 型が email?: string | null であるため、
    // 代入可能性を保つために null も許容する。
    email?: string | null
    isAdmin?: boolean
  }
}
