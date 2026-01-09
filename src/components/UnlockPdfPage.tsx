import { useState, useRef, useCallback, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Lock, Upload, Download, X, Shield, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordPrompt } from '../App'
import PasswordModal from './PasswordModal'

interface UnlockedFile {
  originalName: string
  blob: Blob
  pageCount: number
  thumbnailUrl?: string
  pages?: string[]  // Full-res page images
}

function UnlockPdfPage() {
  const [unlockedFiles, setUnlockedFiles] = useState<UnlockedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPrompt>({
    show: false,
    fileName: '',
    onSubmit: () => {},
    onCancel: () => {}
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const promptPassword = useCallback((fileName: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPasswordPrompt({
        show: true,
        fileName,
        onSubmit: (password) => {
          setPasswordPrompt(prev => ({ ...prev, show: false }))
          resolve(password)
        },
        onCancel: () => {
          setPasswordPrompt(prev => ({ ...prev, show: false }))
          resolve(null)
        }
      })
    })
  }, [])

  const loadPdfWithPassword = useCallback(async (file: File, arrayBuffer: ArrayBuffer) => {
    let password: string | undefined
    let pdf: pdfjsLib.PDFDocumentProxy | null = null

    while (!pdf) {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, password })
        pdf = await loadingTask.promise
      } catch (error: any) {
        if (error?.name === 'PasswordException' || error?.message?.includes('password')) {
          const inputPassword = await promptPassword(file.name)
          if (inputPassword === null) return null
          password = inputPassword
        } else {
          throw error
        }
      }
    }

    return pdf
  }, [promptPassword])

  const processPdf = useCallback(async (file: File): Promise<UnlockedFile | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await loadPdfWithPassword(file, arrayBuffer)
      if (!pdf) return null

      const numPages = pdf.numPages
      const pageCanvases: HTMLCanvasElement[] = []

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({ canvasContext: ctx, viewport }).promise
        pageCanvases.push(canvas)
      }

      if (pageCanvases.length > 0) {
        // Generate high-res page images for preview
        const pageImages: string[] = []
        for (const canvas of pageCanvases) {
          pageImages.push(canvas.toDataURL('image/jpeg', 0.95))
        }

        // Generate thumbnail from first page
        const thumbnailCanvas = document.createElement('canvas')
        const scale = Math.min(300 / pageCanvases[0].width, 300 / pageCanvases[0].height, 1)
        thumbnailCanvas.width = pageCanvases[0].width * scale
        thumbnailCanvas.height = pageCanvases[0].height * scale
        const thumbCtx = thumbnailCanvas.getContext('2d')
        if (thumbCtx) {
          thumbCtx.drawImage(pageCanvases[0], 0, 0, thumbnailCanvas.width, thumbnailCanvas.height)
        }

        const { jsPDF } = await import('jspdf')
        const pdfDoc = new jsPDF({
          orientation: pageCanvases[0].width > pageCanvases[0].height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [pageCanvases[0].width, pageCanvases[0].height] as [number, number]
        })

        pageCanvases.forEach((canvas, index) => {
          const imgData = canvas.toDataURL('image/jpeg', 0.95)
          if (index === 0) {
            pdfDoc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
          } else {
            pdfDoc.addPage([canvas.width, canvas.height], canvas.width > canvas.height ? 'landscape' : 'portrait')
            pdfDoc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
          }
        })

        const pdfBlob = pdfDoc.output('blob')

        return {
          originalName: file.name.replace('.pdf', '_unlocked.pdf'),
          blob: pdfBlob,
          pageCount: numPages,
          thumbnailUrl: thumbnailCanvas.toDataURL('image/jpeg', 0.7),
          pages: pageImages
        }
      }

      return null
    } catch (error) {
      console.error('Error processing PDF:', error)
      return null
    }
  }, [loadPdfWithPassword])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsProcessing(true)
    const results: UnlockedFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type === 'application/pdf') {
        const result = await processPdf(file)
        if (result) results.push(result)
      }
    }

    setUnlockedFiles(prev => [...prev, ...results])
    if (results.length > 0 && unlockedFiles.length === 0) {
      setSelectedIndex(0)
      setCurrentPage(0)
      setZoom(1)
    }
    setIsProcessing(false)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [processPdf])

  // Reset page and zoom when switching files
  useEffect(() => {
    setCurrentPage(0)
    setZoom(1)
  }, [selectedIndex])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const downloadFile = (file: UnlockedFile) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file.blob)
    a.download = file.originalName
    a.click()
  }

  const removeFile = (index: number) => {
    setUnlockedFiles(prev => {
      const newFiles = [...prev]
      newFiles.splice(index, 1)
      if (selectedIndex >= newFiles.length && newFiles.length > 0) {
        setSelectedIndex(newFiles.length - 1)
      }
      return newFiles
    })
  }

  const clearAll = () => {
    setUnlockedFiles([])
    setSelectedIndex(0)
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Center - Main Preview or Drop Zone */}
        <div className="flex-1 min-w-0">
          {unlockedFiles.length > 0 ? (
            <Card>
              <CardHeader className="pb-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{unlockedFiles[selectedIndex]?.originalName}</CardTitle>
                    <CardDescription className="text-xs">
                      Page {currentPage + 1} of {unlockedFiles[selectedIndex]?.pages?.length || unlockedFiles[selectedIndex]?.pageCount || 1}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Page navigation */}
                    {(unlockedFiles[selectedIndex]?.pages?.length || 0) > 1 && (
                      <>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCurrentPage(p => Math.min((unlockedFiles[selectedIndex]?.pages?.length || 1) - 1, p + 1))} disabled={currentPage >= (unlockedFiles[selectedIndex]?.pages?.length || 1) - 1}>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {/* Zoom controls */}
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} disabled={zoom <= 0.25}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs font-medium w-10 text-center">{Math.round(zoom * 100)}%</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setZoom(z => Math.min(3, z + 0.25))} disabled={zoom >= 3}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="sm" onClick={() => downloadFile(unlockedFiles[selectedIndex])}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4">
                <div className="bg-muted rounded-lg overflow-auto h-[calc(100vh-12rem)]">
                  <div className="min-h-full flex items-center justify-center p-4">
                    <img
                      src={unlockedFiles[selectedIndex]?.pages?.[currentPage] || unlockedFiles[selectedIndex]?.thumbnailUrl}
                      alt={unlockedFiles[selectedIndex]?.originalName}
                      className="max-h-full object-contain transition-transform duration-200 origin-center"
                      style={{ transform: `scale(${zoom})` }}
                      draggable={false}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Hero */}
              <div className="text-center py-8">
                <div className="flex justify-center mb-4">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Lock className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">Remove PDF Password</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Upload password-protected PDFs to unlock them
                </p>
              </div>

              {/* Drop Zone */}
              <Card
                className={`border-2 border-dashed transition-all cursor-pointer
                  ${isProcessing ? 'border-muted bg-muted/50 cursor-not-allowed' : 'border-border hover:border-primary/50 hover:bg-accent/50'}
                `}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center justify-center py-16 px-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => handleFiles(e.target.files)}
                    className="hidden"
                  />
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      <p className="text-sm text-muted-foreground">Unlocking PDF...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-medium">Drop PDF files here or click to upload</p>
                        <p className="text-sm text-muted-foreground mt-1">We'll prompt for password if needed</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* How it works */}
              <div className="hidden sm:grid grid-cols-3 gap-6 py-8">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">1</div>
                  <p className="text-xs text-muted-foreground">Upload PDF</p>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">2</div>
                  <p className="text-xs text-muted-foreground">Enter password</p>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">3</div>
                  <p className="text-xs text-muted-foreground">Download unlocked PDF</p>
                </div>
              </div>

              {/* Privacy Notice */}
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

        {/* Right Sidebar - File List */}
        {unlockedFiles.length > 0 && (
          <aside className="w-full lg:w-56 shrink-0">
            <Card className="lg:sticky lg:top-20">
              <CardHeader className="pb-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Files</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => unlockedFiles.forEach(downloadFile)} className="h-7 px-2 text-xs">
                      All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 w-7 p-0">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 space-y-1 max-h-[70vh] overflow-y-auto">
                {unlockedFiles.map((file, index) => (
                  <div
                    key={index}
                    className={`
                      group flex items-center gap-2 p-2 rounded transition-all
                      ${selectedIndex === index ? 'bg-accent border border-primary/30' : 'hover:bg-accent/50'}
                    `}
                  >
                    <button
                      onClick={() => setSelectedIndex(index)}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      <div className="h-10 w-10 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
                        <img
                          src={file.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{file.originalName}</p>
                        <p className="text-[10px] text-muted-foreground">{file.pageCount} pages</p>
                      </div>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        )}
      </div>

      <PasswordModal
        show={passwordPrompt.show}
        fileName={passwordPrompt.fileName}
        onSubmit={passwordPrompt.onSubmit}
        onCancel={passwordPrompt.onCancel}
      />
    </>
  )
}

export default UnlockPdfPage
