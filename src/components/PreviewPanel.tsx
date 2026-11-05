import { ProcessedFile } from '../types'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Download, Minus, Plus } from 'lucide-react'

interface PreviewPanelProps {
  file: ProcessedFile
  currentPage: number
  zoom: number
  isProcessing?: boolean
  heightClass?: string
  onPageChange: (page: number) => void
  onZoomChange: (zoom: number) => void
  onDownload: () => void
}

export function PreviewPanel({
  file,
  currentPage,
  zoom,
  isProcessing,
  heightClass = 'h-[calc(100dvh-16.5rem)] min-h-[26rem]',
  onPageChange,
  onZoomChange,
  onDownload
}: PreviewPanelProps) {
  const pageCount = file.pages?.length ?? 1
  const src =
    file.type === 'pdf' && file.pages
      ? file.pages[currentPage]
      : file.previewUrl

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40" aria-busy={isProcessing}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-foreground">{file.originalName}</p>
          <p className="mt-0.5 font-mono text-[10px] text-dim">
            {file.type === 'pdf'
              ? `PDF · page ${currentPage + 1} of ${pageCount}`
              : 'Image · PNG'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {file.type === 'pdf' && pageCount > 1 && (
            <>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                aria-label="Previous page"
                onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                aria-label="Next page"
                onClick={() => onPageChange(Math.min(pageCount - 1, currentPage + 1))}
                disabled={currentPage >= pageCount - 1}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            </>
          )}

          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            aria-label="Zoom out"
            onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
            disabled={zoom <= 0.25}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-10 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            aria-label="Zoom in"
            onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
            disabled={zoom >= 3}
          >
            <Plus className="h-3 w-3" />
          </Button>

          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

          <Button size="sm" onClick={onDownload} disabled={isProcessing} className="h-8">
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      </div>

      <div className="relative">
        {isProcessing && (
          <div
            className="processing-bar absolute inset-x-0 top-0 z-10 h-px overflow-hidden bg-border"
            role="status"
            aria-label="Processing files"
          />
        )}

        <div className={`canvas-grid overflow-auto ${heightClass}`}>
          <div className="flex min-h-full items-center justify-center p-5 sm:p-8">
            <img
              src={src}
              alt={file.originalName}
              className="h-auto max-w-none rounded-[2px] bg-white shadow-[0_24px_70px_-24px_oklch(0_0_0/0.9)] ring-1 ring-white/10 transition-opacity duration-200"
              style={{ width: `${zoom * 100}%`, opacity: isProcessing ? 0.55 : 1 }}
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
