import { ProcessedFile } from '../types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'

interface FileListSidebarProps {
  files: ProcessedFile[]
  selectedIndex: number
  isProcessing?: boolean
  onSelect: (index: number) => void
  onRemove: (index: number) => void
  onDownloadAll: () => void
  onClearAll: () => void
  renderMeta?: (file: ProcessedFile) => React.ReactNode
}

export function FileListSidebar({
  files,
  selectedIndex,
  isProcessing,
  onSelect,
  onRemove,
  onDownloadAll,
  onClearAll,
  renderMeta
}: FileListSidebarProps) {
  return (
    <aside className="w-full lg:w-56 shrink-0">
      <Card className="lg:sticky lg:top-20">
        <CardHeader className="pb-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Files</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="sm"
                onClick={onDownloadAll}
                disabled={isProcessing}
                className="h-7 px-2 text-xs"
              >
                All
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={onClearAll}
                disabled={isProcessing}
                className="h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 space-y-1 max-h-[70vh] overflow-y-auto">
          {files.map((file, index) => (
            <div
              key={file.id}
              className={`
                group flex items-center gap-2 p-2 rounded transition-all
                ${selectedIndex === index
                  ? 'bg-accent border border-primary/30'
                  : 'hover:bg-accent/50'}
              `}
            >
              <button
                onClick={() => onSelect(index)}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <div className="h-10 w-10 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
                  {(file.thumbnailUrl || file.type === 'image') && (
                    <img
                      src={file.thumbnailUrl ?? file.previewUrl}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{file.originalName}</p>
                  {renderMeta?.(file)}
                </div>
              </button>
              <Button
                size="icon" variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  )
}
