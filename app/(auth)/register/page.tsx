import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { ROUTE_REGISTER } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '新規登録',
  description: 'BON-LOGのアカウントを作成して、盆栽の成長記録や情報共有を始めましょう。',
  alternates: { canonical: pageCanonical(ROUTE_REGISTER) },
  robots: { index: false, follow: false },
}

export default function RegisterPage() {
  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-serif text-3xl font-bold text-center text-sumi dark:text-washi mb-10 tracking-widest">新規登録</h1>
      <RegisterForm />
    </div>
  )
}
