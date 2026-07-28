import type { LegalDocument } from '@/lib/constants/legal'

/**
 * @module components/legal/AndroidLegalDocumentView
 * Android 専用 public ページ（利用規約・プライバシーポリシー）の本文描画。
 * `lib/constants/legal` の `ANDROID_LEGAL_DOCUMENTS` を正本として表示するだけの
 * 純粋な表示コンポーネント（Server Component、インタラクションなし）。
 */

type AndroidLegalDocumentViewProps = {
  doc: LegalDocument
}

export function AndroidLegalDocumentView({ doc }: AndroidLegalDocumentViewProps) {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>{doc.title}</h1>
      <p className="text-muted-foreground">最終更新日: {doc.updatedAt}</p>

      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <p className="whitespace-pre-line">{section.body}</p>
        </section>
      ))}
    </article>
  )
}
