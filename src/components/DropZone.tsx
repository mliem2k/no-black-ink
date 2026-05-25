import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface DropZoneProps {
  accept: string
  multiple?: boolean
  isProcessing: boolean
  processingLabel?: string
  hint: string
  onFiles: (files: FileList) => void
}

export function DropZone({
  accept,
  multiple = true,
  isProcessing,
  processingLabel = 'Processing...',
  hint,
  onFiles
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Card
      className={`border-2 border-dashed transition-all cursor-pointer
        ${isProcessing
          ? 'border-muted bg-muted/50 cursor-not-allowed'
          : 'border-border hover:border-primary/50 hover:bg-accent/50'}
      `}
      onDrop={(e) => {
        e.preventDefault()
        if (!isProcessing && e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
      }}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => !isProcessing && inputRef.current?.click()}
    >
      <CardContent className="flex flex-col items-center justify-center py-16 px-4">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            if (e.target.files?.length) {
              onFiles(e.target.files)
              e.target.value = ''
            }
          }}
          className="hidden"
          disabled={isProcessing}
        />
        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">{processingLabel}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium">Drop files here or click to upload</p>
              <p className="text-sm text-muted-foreground mt-1">{hint}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
