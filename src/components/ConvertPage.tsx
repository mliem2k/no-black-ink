import { useState, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Upload, FileImage, FileText, Download, X, Palette, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordPrompt } from '../App'
import PasswordModal from './PasswordModal'

type ColorMode = 'blue-auto' | 'blue-grayscale' | 'blue-all'
  | 'brown-auto' | 'brown-grayscale' | 'brown-all'
  | 'green-auto' | 'green-grayscale' | 'green-all'
  | 'purple-auto' | 'purple-grayscale' | 'purple-all'
  | 'red-auto' | 'red-grayscale' | 'red-all'

type ColorFamily = 'blue' | 'brown' | 'green' | 'purple' | 'red'

interface ConvertedFile {
  originalName: string
  blob: Blob
  previewUrl: string
  type: 'image' | 'pdf'
}

function ConvertPage() {
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [colorMode, setColorMode] = useState<ColorMode>('blue-auto')
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPrompt>({
    show: false,
    fileName: '',
    onSubmit: () => {},
    onCancel: () => {}
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getColorFamily = (mode: ColorMode): ColorFamily => {
    return mode.split('-')[0] as ColorFamily
  }

  const getModeType = (mode: ColorMode): 'auto' | 'grayscale' | 'all' => {
    return mode.split('-')[1] as 'auto' | 'grayscale' | 'all'
  }

  const getFileSuffix = (mode: ColorMode): string => {
    const family = getColorFamily(mode)
    const type = getModeType(mode)
    if (type === 'all') {
      return `_${family}full`
    }
    return `_${family}`
  }

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

    const colorFamily = getColorFamily(colorMode)
    const modeType = getModeType(colorMode)

    // Color mappings for each family: [rMult, gMult, bMult, rBase, gBase, bBase]
    const colorMaps: Record<ColorFamily, { all: [number, number, number, number, number, number]; auto: [number, number, number, number, number, number] }> = {
      blue: {
        all: [0.4, 0.6, 0.4, 0, 30, 180],
        auto: [0.3, 0.5, 0.3, 0, 40, 200]
      },
      brown: {
        all: [0.7, 0.5, 0.3, 60, 40, 10],
        auto: [0.6, 0.4, 0.2, 80, 50, 20]
      },
      green: {
        all: [0.3, 0.7, 0.4, 0, 120, 30],
        auto: [0.2, 0.6, 0.3, 0, 160, 40]
      },
      purple: {
        all: [0.6, 0.3, 0.6, 60, 0, 100],
        auto: [0.5, 0.2, 0.5, 80, 0, 140]
      },
      red: {
        all: [0.8, 0.2, 0.2, 120, 0, 0],
        auto: [0.7, 0.1, 0.1, 160, 0, 0]
      }
    }

    const [rMult, gMult, bMult, rBase, gBase, bBase] = colorMaps[colorFamily][modeType === 'all' ? 'all' : 'auto']

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

      if (modeType === 'grayscale') {
        shouldConvert = pixelIsGrayscale && isDark
      } else if (modeType === 'all') {
        shouldConvert = true
      } else {
        shouldConvert = pixelIsGrayscale && isDark
      }

      if (shouldConvert) {
        const darkness = modeType === 'all'
          ? 1 - (luminance / 255)
          : 1 - (luminance / 180)

        data[i] = Math.floor(r * rMult + rBase + darkness * rBase * 0.5)
        data[i + 1] = Math.floor(g * gMult + gBase + darkness * gBase * 0.3)
        data[i + 2] = Math.floor(b * bMult + bBase + darkness * bBase * 0.3)
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
            const suffix = getFileSuffix(colorMode)
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
        const suffix = getFileSuffix(colorMode)

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

  // Color mode definitions organized by family
  const colorFamilies: { family: ColorFamily; name: string; description: string; bgClass: string }[] = [
    { family: 'blue', name: 'Blue', description: 'Use when you have blue ink', bgClass: 'bg-blue-500' },
    { family: 'brown', name: 'Brown', description: 'Use when you have red + green ink', bgClass: 'bg-amber-700' },
    { family: 'green', name: 'Green', description: 'Use when you have green ink', bgClass: 'bg-green-600' },
    { family: 'purple', name: 'Purple', description: 'Use when you have red + blue ink', bgClass: 'bg-purple-600' },
    { family: 'red', name: 'Red', description: 'Use when you have red ink', bgClass: 'bg-red-600' }
  ]

  const modeTypes: { type: 'auto' | 'grayscale' | 'all'; name: string; description: string; icon: React.ReactNode }[] = [
    { type: 'auto', name: 'Smart', description: 'Auto-detects black text', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { type: 'grayscale', name: 'Grayscale', description: 'Only converts B&W', icon: <FileImage className="h-3.5 w-3.5" /> },
    { type: 'all', name: 'Full Tint', description: 'Converts everything', icon: <Palette className="h-3.5 w-3.5" /> }
  ]

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {/* Hero */}
        <div className="text-center space-y-1.5 sm:space-y-2">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">No Black Ink</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Print documents using only one color ink. Choose based on what ink cartridges you have available.
          </p>
        </div>

        {/* Color Mode Selector */}
        <Card>
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base">Choose Your Ink Color</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Select the color based on available ink cartridges</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 space-y-4">
            {colorFamilies.map(({ family, name, description, bgClass }) => {
              const currentFamily = getColorFamily(colorMode)
              const currentMode = getModeType(colorMode)
              const isSelectedFamily = currentFamily === family

              return (
                <div key={family} className={`rounded-lg border-2 transition-all ${isSelectedFamily ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <button
                    onClick={() => setColorMode(`${family}-auto` as ColorMode)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <div className={`h-8 w-8 rounded-md ${bgClass} shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{name} Ink</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    {isSelectedFamily && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                  {isSelectedFamily && (
                    <div className="px-3 pb-3">
                      <div className="flex gap-2">
                        {modeTypes.map(({ type, name, description, icon }) => (
                          <button
                            key={type}
                            onClick={() => setColorMode(`${family}-${type}` as ColorMode)}
                            className={`
                              flex-1 flex flex-col items-center gap-1.5 p-2 rounded-md border text-center transition-all
                              ${currentMode === type
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50 hover:bg-accent'
                              }
                            `}
                          >
                            {icon}
                            <span className="text-xs font-medium">{name}</span>
                            <span className="text-[10px] text-muted-foreground hidden sm:block">{description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
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
