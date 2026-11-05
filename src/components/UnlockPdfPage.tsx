import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, FileCheck2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { ProcessedFile } from '../types'
import { usePasswordPrompt } from '../hooks/usePasswordPrompt'
import { loadPdfWithPassword, renderPdfPages, revokeFileUrls } from '../lib/pdfUtils'
import { DropZone } from './DropZone'
import { PreviewPanel } from './PreviewPanel'
import { FileListSidebar } from './FileListSidebar'
import PasswordModal from './PasswordModal'
import { cn } from '@/lib/utils'

const STEPS = [
  { icon: LockKeyhole, title: 'Upload the PDF', body: 'Choose a password-protected file from your device.' },
  { icon: ShieldCheck, title: 'Enter the password', body: 'It is used in memory and never stored or sent.' },
  { icon: Download, title: 'Download the copy', body: 'Save a new PDF that opens without a password.' }
]

const FEATURES = [
  { title: 'No sign-up', body: 'Open the page and start.' },
  { title: 'Multi-page', body: 'Every page is kept in order.' },
  { title: 'Original intact', body: 'Your source file is never changed.' }
]

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

  const hasFiles = unlockedFiles.length > 0

  return (
    <>
      <div
        className={cn(
          'grid items-start gap-6 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8',
          hasFiles && 'xl:grid-cols-[232px_minmax(0,1fr)_232px]'
        )}
      >
        <aside className="order-2 lg:order-1 lg:sticky lg:top-[5.5rem]">
          <div className="overflow-hidden rounded-xl border border-border bg-card/50">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-[12px] font-medium text-foreground">How it works</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-dim">3 steps</span>
            </div>
            <ol className="p-4">
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < STEPS.length - 1 && (
                    <span
                      className="absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px bg-border"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-elevated text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[12px] font-medium text-foreground">{title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-dim">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex gap-2 border-t border-border px-4 py-3.5">
              <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dim" aria-hidden="true" />
              <p className="text-[11px] leading-relaxed text-dim">
                Files never leave this device. There is no upload step.
              </p>
            </div>
          </div>
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
          {hasFiles ? (
            <PreviewPanel
              file={unlockedFiles[selectedIndex]}
              currentPage={currentPage}
              zoom={zoom}
              isProcessing={isProcessing}
              onPageChange={setCurrentPage}
              onZoomChange={setZoom}
              onDownload={() => downloadFile(unlockedFiles[selectedIndex])}
            />
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-[27px] font-medium leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[32px]">
                  Remove a PDF password.
                </h1>
                <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
                  Enter the password once and download a copy that opens without one.
                  Decryption happens on your device.
                </p>
              </div>

              <DropZone
                accept=".pdf"
                isProcessing={isProcessing}
                processingLabel="Unlocking…"
                hint="Password-protected PDF files. The password is used in memory only."
                formats={['PDF']}
                onFiles={handleFiles}
              />

              <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
                {FEATURES.map(({ title, body }) => (
                  <div key={title} className="bg-background p-4">
                    <p className="text-[12px] font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-dim">{body}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {hasFiles && (
          <div className="order-3 lg:col-span-2 xl:col-span-1">
            <FileListSidebar
              files={unlockedFiles}
              selectedIndex={selectedIndex}
              isProcessing={isProcessing}
              onSelect={setSelectedIndex}
              onRemove={removeFile}
              onDownloadAll={() => unlockedFiles.forEach(downloadFile)}
              onClearAll={clearAll}
              renderMeta={(file) =>
                file.pageCount
                  ? <p className="font-mono text-[10px] text-dim">{file.pageCount} pages</p>
                  : null
              }
            />
          </div>
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
