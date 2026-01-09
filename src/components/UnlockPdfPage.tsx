import { useState, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Lock, Upload, FileText, Download, X, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordPrompt } from '../App'
import PasswordModal from './PasswordModal'

interface UnlockedFile {
  originalName: string
  blob: Blob
  pageCount: number
}

function UnlockPdfPage() {
  const [unlockedFiles, setUnlockedFiles] = useState<UnlockedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
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
          pageCount: numPages
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
    setIsProcessing(false)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [processPdf])

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
      return newFiles
    })
  }

  const clearAll = () => {
    setUnlockedFiles([])
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {/* Hero */}
        <div className="text-center space-y-1.5 sm:space-y-2">
          <div className="flex justify-center">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Remove PDF Password</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto px-4">
            Upload password-protected PDFs. All processing happens locally.
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
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
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
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Unlocking PDF...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Tap to upload PDF</p>
                  <p className="text-xs text-muted-foreground">We'll prompt for password if needed</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {unlockedFiles.length > 0 && (
          <Card>
            <CardHeader className="pb-3 px-4 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm sm:text-base">Unlocked Files</CardTitle>
                  <CardDescription className="text-xs">{unlockedFiles.length} ready</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={clearAll} className="shrink-0">
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-2">
                {unlockedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border bg-card">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium truncate">{file.originalName}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{file.pageCount} pages</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <Button size="sm" onClick={() => downloadFile(file)} className="gap-1 h-8 px-2 sm:px-3 text-xs">
                        <Download className="h-3 w-3" />
                        <span className="hidden xs:inline">Download</span>
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeFile(index)} className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* How it works */}
        {unlockedFiles.length === 0 && (
          <>
            <Card>
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-sm sm:text-base text-center">How it works</CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="grid grid-cols-3 gap-3 sm:gap-6">
                  <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">1</div>
                    <p className="text-[11px] sm:text-sm text-muted-foreground">Upload PDF</p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">2</div>
                    <p className="text-[11px] sm:text-sm text-muted-foreground">Enter password</p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">3</div>
                    <p className="text-[11px] sm:text-sm text-muted-foreground">Download</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-start gap-3 p-3 sm:p-4">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">100% Private</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Files and passwords are processed locally in your browser. Nothing is uploaded.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
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
