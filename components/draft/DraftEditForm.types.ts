/**
 * @module components/draft/DraftEditForm.types
 */

export type Genre = {
  id: string
  name: string
  category: string
}

export type DraftMedia = {
  id: string
  url: string
  type: string
}

export type DraftGenre = {
  genreId: string
  genre: {
    id: string
    name: string
  }
}

export type Draft = {
  id: string
  content: string | null
  media: DraftMedia[]
  genres: DraftGenre[]
}

export interface DraftEditFormProps {
  draft: Draft
  genres: Record<string, Genre[]>
}
