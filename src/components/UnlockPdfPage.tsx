import { useState, useCallback, useEffect, useRef } from 'react'
import { Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProcessedFile } from '../types'
import { usePasswordPrompt } from '../hooks/usePasswordPrompt'
import { loadPdfWithPassword, renderPdfPages, revokeFileUrls } from '../lib/pdfUtils'
import { DropZone } from './DropZone'
import { PreviewPanel } from './PreviewPanel'
import { FileListSidebar } from './FileListSidebar'
import PasswordModal from './PasswordModal'

function UnlockPdfPage() {
  const [unlockedFiles, setUnlockedFiles] = useState<ProcessedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [zoom, setZoom] = useState(1)

  const { prompt, promptPassword } = usePasswordPrompt()

  const unlockedFilesCountRef = useRef(0)
  unlockedFilesCountRef.current = unlockedFiles.length

  const processPdf = useCallback(async (file: File): Promise<ProcessedFile | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await loadPdfWithPassword(file, arrayBuffer, promptPassword)
      if (!pdf) return null

      const result = await renderPdfPages(pdf)
      if (!result) return null

      return {
        id: crypto.randomUUID(),
        originalName: file.name.replace(/\.pdf$/i, '_unlocked.pdf'),
        blob: result.outputBlob,
        previewUrl: URL.createObjectURL(result.outputBlob),
        thumbnailUrl: result.thumbnailUrl,
        type: 'pdf',
        pages: result.pages,
        pageCount: result.pages.length
      }
    } catch (error) {
      console.error('Error unlocking PDF:', error)
      return null
    }
  }, [promptPassword])

  const handleFiles = useCallback(async (fileList: FileList) => {
    if (!fileList.length) return
    const isFirstBatch = unlockedFilesCountRef.current === 0

    setIsProcessing(true)

    const results = await Promise.all(
      Array.from(fileList)
        .filter(f => f.type === 'application/pdf')
        .map(f => processPdf(f))
    )

    const valid = results.filter(Boolean) as ProcessedFile[]
    setUnlockedFiles(prev => [...prev, ...valid])

    if (valid.length > 0 && isFirstBatch) {
      setSelectedIndex(0)
      setCurrentPage(0)
      setZoom(1)
    }
    setIsProcessing(false)
  }, [processPdf])

  useEffect(() => {
    setCurrentPage(0)
    setZoom(1)
  }, [selectedIndex])

  const downloadFile = (file: ProcessedFile) => {
    const a = document.createElement('a')
    a.href = file.previewUrl
    a.download = file.originalName
    a.click()
  }

  const removeFile = (index: number) => {
    setUnlockedFiles(prev => {
      const next = [...prev]
      revokeFileUrls(next[index])
      next.splice(index, 1)
      if (selectedIndex >= next.length && next.length > 0) setSelectedIndex(next.length - 1)
      return next
    })
  }

  const clearAll = () => {
    unlockedFiles.forEach(revokeFileUrls)
    setUnlockedFiles([])
    setSelectedIndex(0)
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="flex-1 min-w-0">
          {unlockedFiles.length > 0 ? (
            <PreviewPanel
              file={unlockedFiles[selectedIndex]}
              currentPage={currentPage}
              zoom={zoom}
              heightClass="h-[calc(100vh-12rem)]"
              onPageChange={setCurrentPage}
              onZoomChange={setZoom}
              onDownload={() => downloadFile(unlockedFiles[selectedIndex])}
            />
          ) : (
            <>
              {/* Hero */}
              <div className="text-center py-8 sm:py-10">
                <h2 className="text-3xl font-bold tracking-tight">Remove PDF password</h2>
                <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm sm:text-base">
                  Upload a password-protected PDF, enter the password once, and download an unlocked copy — all locally in your browser.
                </p>
              </div>

              <DropZone
                accept=".pdf"
                isProcessing={isProcessing}
                processingLabel="Unlocking PDF..."
                hint="Password-protected PDF files"
                onFiles={handleFiles}
              />

              {/* How it works */}
              <div className="hidden sm:grid grid-cols-3 gap-6 py-8">
                {[
                  { n: 1, label: 'Upload your password-protected PDF' },
                  { n: 2, label: 'Enter the password when prompted' },
                  { n: 3, label: 'Download the unlocked PDF' }
                ].map(({ n, label }) => (
                  <div key={n} className="flex flex-col items-center gap-2 text-center">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                      {n}
                    </div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Privacy notice */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="flex items-start gap-3 p-4">
                  <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">100% Private</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Files and passwords are processed locally in your browser. Nothing is uploaded to any server.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {unlockedFiles.length > 0 && (
          <FileListSidebar
            files={unlockedFiles}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onRemove={removeFile}
            onDownloadAll={() => unlockedFiles.forEach(downloadFile)}
            onClearAll={clearAll}
            renderMeta={(file) =>
              file.pageCount
                ? <p className="text-[10px] text-muted-foreground">{file.pageCount} pages</p>
                : null
            }
          />
        )}
      </div>

      <PasswordModal
        show={prompt.show}
        fileName={prompt.fileName}
        onSubmit={prompt.onSubmit}
        onCancel={prompt.onCancel}
      />
    </>
  )
}

export default UnlockPdfPage
