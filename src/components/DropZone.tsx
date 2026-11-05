import { useState } from 'react'
import { FileText, Image as ImageIcon, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropZoneProps {
  accept: string
  multiple?: boolean
  isProcessing: boolean
  processingLabel?: string
  hint: string
  tone?: { name: string; hex: string }
  formats?: string[]
  onFiles: (files: FileList) => void
}

export function DropZone({
  accept,
  multiple = true,
  isProcessing,
  processingLabel = 'Processing…',
  hint,
  tone,
  formats = ['PDF', 'PNG', 'JPG'],
  onFiles
}: DropZoneProps) {
  const [dragActive, setDragActive] = useState(false)

  return (
    <label
      htmlFor="file-input"
      className={cn(
        'group relative flex min-h-[19rem] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed px-6 py-14 text-center transition-[border-color,background-color] duration-150 focus-within:ring-2 focus-within:ring-ring/60 focus-within:ring-offset-2 focus-within:ring-offset-background sm:min-h-[23rem]',
        isProcessing
          ? 'cursor-wait border-border bg-elevated/30'
          : dragActive
            ? 'border-ring bg-ring/[0.06]'
            : 'border-line-strong bg-elevated/20 hover:border-foreground/30 hover:bg-elevated/40'
      )}
      onDragOver={(e) => {
        e.preventDefault()
        if (!isProcessing) setDragActive(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragActive(false)
        if (!isProcessing && e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
      }}
    >
      <input
        id="file-input"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files?.length) {
            onFiles(e.target.files)
            e.target.value = ''
          }
        }}
        className="sr-only"
        disabled={isProcessing}
      />

      {isProcessing ? (
        <div className="flex flex-col items-center gap-4" aria-live="polite">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border border-border" />
            <div className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-foreground" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-foreground">{processingLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">Working in your browser</p>
          </div>
        </div>
      ) : (
        <>
          <div
            className={cn(
              'mb-5 flex h-11 w-11 items-center justify-center rounded-lg border bg-elevated text-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.06)] transition-colors duration-150',
              dragActive ? 'border-ring/60' : 'border-border group-hover:border-line-strong'
            )}
          >
            <Upload className="h-[18px] w-[18px]" aria-hidden="true" />
          </div>

          <p className="text-sm font-medium text-foreground">
            {dragActive ? 'Drop to convert' : 'Drop files here, or browse'}
          </p>
          <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">{hint}</p>

          <div className="mt-6 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-dim">
            {formats.map((format) => (
              <span
                key={format}
                className="flex items-center gap-1 rounded border border-border px-1.5 py-1"
              >
                {format === 'PDF' ? (
                  <FileText className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ImageIcon className="h-3 w-3" aria-hidden="true" />
                )}
                {format}
              </span>
            ))}
          </div>

          {tone && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-dim">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: tone.hex }}
                aria-hidden="true"
              />
              Output ink
              <span className="font-medium text-muted-foreground">{tone.name}</span>
            </p>
          )}
        </>
      )}
    </label>
  )
}
