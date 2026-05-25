import { ProcessedFile } from '../types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Plus, Minus, Download } from 'lucide-react'

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
  heightClass = 'h-[calc(100vh-14rem)]',
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
    <Card>
      <CardHeader className="pb-3 px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{file.originalName}</CardTitle>
            <CardDescription className="text-xs">
              {file.type === 'pdf'
                ? `Page ${currentPage + 1} of ${pageCount}`
                : 'Image preview'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {file.type === 'pdf' && pageCount > 1 && (
              <>
                <Button
                  size="icon" variant="outline" className="h-7 w-7"
                  onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon" variant="outline" className="h-7 w-7"
                  onClick={() => onPageChange(Math.min(pageCount - 1, currentPage + 1))}
                  disabled={currentPage >= pageCount - 1}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button
              size="icon" variant="outline" className="h-7 w-7"
              onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
              disabled={zoom <= 0.25}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-xs font-medium w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button
              size="icon" variant="outline" className="h-7 w-7"
              onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
              disabled={zoom >= 3}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button size="sm" onClick={onDownload} disabled={isProcessing}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        <div className={`bg-muted rounded-lg overflow-auto ${heightClass}`}>
          <div className="min-h-full flex items-center justify-center p-4">
            <img
              src={src}
              alt={file.originalName}
              className="max-h-full object-contain transition-transform duration-200 origin-center"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
