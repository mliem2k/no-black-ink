import type { ReactNode } from 'react'
import { ProcessedFile } from '../types'
import { Button } from '@/components/ui/button'
import { FileText, Plus, X } from 'lucide-react'

interface FileListSidebarProps {
  files: ProcessedFile[]
  selectedIndex: number
  isProcessing?: boolean
  className?: string
  onSelect: (index: number) => void
  onRemove: (index: number) => void
  onAdd?: () => void
  onDownloadAll: () => void
  onClearAll: () => void
  renderMeta?: (file: ProcessedFile) => ReactNode
}

export function FileListSidebar({
  files,
  selectedIndex,
  isProcessing,
  className,
  onSelect,
  onRemove,
  onAdd,
  onDownloadAll,
  onClearAll,
  renderMeta
}: FileListSidebarProps) {
  return (
    <aside className={className}>
      <div className="overflow-hidden rounded-xl border border-border bg-card/50 lg:sticky lg:top-[5.5rem]">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <h2 className="flex items-center gap-1.5 px-1 text-[12px] font-medium text-foreground">
            Files
            <span className="font-mono text-[10px] tabular-nums text-dim">{files.length}</span>
          </h2>
          {onAdd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              disabled={isProcessing}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          )}
        </div>

        <div className="max-h-[52vh] space-y-0.5 overflow-y-auto p-1.5">
          {files.map((file, index) => (
            <div
              key={file.id}
              className={`group flex items-center gap-1.5 rounded-md p-1.5 transition-colors duration-150 ${
                selectedIndex === index ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={selectedIndex === index ? 'true' : undefined}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-background">
                  {file.thumbnailUrl || file.type === 'image' ? (
                    <img
                      src={file.thumbnailUrl ?? file.previewUrl}
                      alt=""
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-dim" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-medium text-foreground">
                    {file.originalName}
                  </span>
                  {renderMeta?.(file)}
                </span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${file.originalName}`}
                className="h-6 w-6 shrink-0 opacity-100 hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                onClick={() => onRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border p-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadAll}
            disabled={isProcessing}
            className="h-8 flex-1 text-[11.5px]"
          >
            Download all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            disabled={isProcessing}
            className="h-8 px-2.5 text-[11.5px]"
          >
            Clear
          </Button>
        </div>
      </div>
    </aside>
  )
}
