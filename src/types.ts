export interface ProcessedFile {
  id: string
  originalName: string
  blob: Blob
  previewUrl: string
  thumbnailUrl?: string
  pages?: string[]
  pageCount?: number
  type: 'image' | 'pdf'
}

export interface PasswordPromptState {
  show: boolean
  fileName: string
  onSubmit: (password: string) => void
  onCancel: () => void
}
