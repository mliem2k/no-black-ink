import { useState, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Upload, FileImage, FileText, Download, X, Palette, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordPrompt } from '../App'
import PasswordModal from './PasswordModal'

type ColorMode = 'auto' | 'grayscale-only' | 'all-blue'

interface ConvertedFile {
  originalName: string
  blob: Blob
  previewUrl: string
  type: 'image' | 'pdf'
}

function ConvertPage() {
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [colorMode, setColorMode] = useState<ColorMode>('auto')
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

  const isGrayscale = (r: number, g: number, b: number): boolean => {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    return max - min < 30
  }

  const applyFilter = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]

      if (a === 0) continue

      const luminance = 0.299 * r + 0.587 * g + 0.114 * b
      const pixelIsGrayscale = isGrayscale(r, g, b)
      const isDark = luminance < 180

      let shouldConvert = false

      switch (colorMode) {
        case 'grayscale-only':
          shouldConvert = pixelIsGrayscale && isDark
          break
        case 'all-blue':
          shouldConvert = true
          break
        case 'auto':
        default:
          shouldConvert = pixelIsGrayscale && isDark
          break
      }

      if (shouldConvert) {
        const darkness = colorMode === 'all-blue'
          ? 1 - (luminance / 255)
          : 1 - (luminance / 180)

        if (colorMode === 'all-blue') {
          data[i] = Math.floor(r * 0.4)
          data[i + 1] = Math.floor(g * 0.6)
          data[i + 2] = Math.floor(150 + b * 0.4 + darkness * 105)
        } else {
          data[i] = Math.floor(r * 0.3)
          data[i + 1] = Math.floor(g * 0.5)
          data[i + 2] = Math.floor(180 + b * 0.3 + darkness * 75)
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }

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

  const processImage = useCallback(async (file: File): Promise<ConvertedFile | null> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }

        ctx.drawImage(img, 0, 0)
        applyFilter(canvas)

        canvas.toBlob((blob) => {
          if (blob) {
            const suffix = colorMode === 'all-blue' ? '_fullblue' : '_blue'
            resolve({
              originalName: file.name.replace(/\.[^.]+$/, `${suffix}.png`),
              blob,
              previewUrl: URL.createObjectURL(blob),
              type: 'image'
            })
          } else {
            resolve(null)
          }
        }, 'image/png')
      }
      img.onerror = () => resolve(null)
      img.src = URL.createObjectURL(file)
    })
  }, [colorMode])

  const processPdf = useCallback(async (file: File): Promise<ConvertedFile | null> => {
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

        await page.render({ canvasContext: ctx, viewport }).promise
        applyFilter(canvas)
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
        const suffix = colorMode === 'all-blue' ? '_fullblue' : '_blue'

        return {
          originalName: file.name.replace('.pdf', `${suffix}.pdf`),
          blob: pdfBlob,
          previewUrl: URL.createObjectURL(pdfBlob),
          type: 'pdf'
        }
      }

      return null
    } catch (error) {
      console.error('Error processing PDF:', error)
      return null
    }
  }, [colorMode, loadPdfWithPassword])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsProcessing(true)
    const results: ConvertedFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        const result = await processImage(file)
        if (result) results.push(result)
      } else if (file.type === 'application/pdf') {
        const result = await processPdf(file)
        if (result) results.push(result)
      }
    }

    setConvertedFiles(prev => [...prev, ...results])
    setIsProcessing(false)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [processImage, processPdf])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const downloadFile = (file: ConvertedFile) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file.blob)
    a.download = file.originalName
    a.click()
  }

  const removeFile = (index: number) => {
    setConvertedFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].previewUrl)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const clearAll = () => {
    convertedFiles.forEach(f => URL.revokeObjectURL(f.previewUrl))
    setConvertedFiles([])
  }

  const colorModes: { value: ColorMode; label: string; description: string; icon: React.ReactNode }[] = [
    {
      value: 'auto',
      label: 'Auto',
      description: 'Detects and converts grayscale/black text to blue',
      icon: <Sparkles className="h-4 w-4" />
    },
    {
      value: 'grayscale-only',
      label: 'Grayscale Only',
      description: 'Only converts black & gray pixels, preserves colors',
      icon: <FileImage className="h-4 w-4" />
    },
    {
      value: 'all-blue',
      label: 'Full Blue Tint',
      description: 'Converts everything to blue tones',
      icon: <Palette className="h-4 w-4" />
    }
  ]

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {/* Hero */}
        <div className="text-center space-y-1.5 sm:space-y-2">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Convert to Blue Ink</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Print documents using only blue ink. Perfect when you're out of black.
          </p>
        </div>

        {/* Color Mode Selector */}
        <Card>
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base">Color Mode</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Choose how the blue filter is applied</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {colorModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setColorMode(mode.value)}
                  className={`
                    flex flex-col items-start gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-lg border-2 text-left transition-all
                    ${colorMode === mode.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                    }
                  `}
                >
                  <div className={`flex items-center gap-1.5 sm:gap-2 ${colorMode === mode.value ? 'text-primary' : ''}`}>
                    {mode.icon}
                    <span className="text-sm sm:text-base font-medium">{mode.label}</span>
                    {colorMode === mode.value && <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-auto" />}
                  </div>
                  <span className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2">{mode.description}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

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
              accept="image/*,.pdf"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Processing...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Tap to upload files</p>
                  <p className="text-xs text-muted-foreground">Images (PNG, JPG) and PDF files</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {convertedFiles.length > 0 && (
          <Card>
            <CardHeader className="pb-3 px-4 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm sm:text-base">Converted Files</CardTitle>
                  <CardDescription className="text-xs">{convertedFiles.length} ready</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={clearAll} className="shrink-0">
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-2">
                {convertedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border bg-card">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {file.type === 'pdf' ? <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /> : <FileImage className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
                    </div>
                    <span className="flex-1 min-w-0 text-xs sm:text-sm font-medium truncate">{file.originalName}</span>
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
        {convertedFiles.length === 0 && (
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-sm sm:text-base text-center">How it works</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="grid grid-cols-3 gap-3 sm:gap-6">
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">1</div>
                  <p className="text-[11px] sm:text-sm text-muted-foreground">Choose mode</p>
                </div>
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">2</div>
                  <p className="text-[11px] sm:text-sm text-muted-foreground">Upload file</p>
                </div>
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">3</div>
                  <p className="text-[11px] sm:text-sm text-muted-foreground">Download</p>
                </div>
              </div>
            </CardContent>
          </Card>
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

export default ConvertPage
