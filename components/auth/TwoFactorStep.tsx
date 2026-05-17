'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  code: string
  error: string | null
  loading: boolean
  onChange: (code: string) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

export function TwoFactorStep({ code, error, loading, onChange, onSubmit, onCancel }: Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-primary">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">2段階認証</h2>
        <p className="text-sm text-muted-foreground">
          認証アプリに表示されている6桁のコードを入力してください。
        </p>
        <p className="text-xs text-muted-foreground">
          または、バックアップコードを入力できます。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="twoFactorCode">認証コード</Label>
        <Input
          id="twoFactorCode"
          name="twoFactorCode"
          type="text"
          inputMode="text"
          placeholder="000000 または バックアップコード"
          value={code}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          required
          autoComplete="one-time-code"
          className="text-center text-lg tracking-widest"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}

      <div className="space-y-2">
        <Button type="submit" className="w-full" disabled={loading || !code}>
          {loading ? '確認中...' : '確認'}
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={onCancel} disabled={loading}>
          キャンセル
        </Button>
      </div>
    </form>
  )
}
