import { useState, useRef, useCallback, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Upload, FileImage, Download, X, Palette, Sparkles, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react'
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
  thumbnailUrl?: string
  type: 'image' | 'pdf'
  pages?: string[]  // Full-res page images for PDFs
}

function ConvertPage() {
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([])
  const [sourceFiles, setSourceFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [colorMode, setColorMode] = useState<ColorMode>('blue-auto')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pdfPasswords, setPdfPasswords] = useState<Record<string, string>>({})
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
    let password: string | undefined = pdfPasswords[file.name]
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
          setPdfPasswords(prev => ({ ...prev, [file.name]: inputPassword }))
        } else {
          throw error
        }
      }
    }

    return pdf
  }, [promptPassword, pdfPasswords])

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
        const suffix = getFileSuffix(colorMode)

        return {
          originalName: file.name.replace('.pdf', `${suffix}.pdf`),
          blob: pdfBlob,
          previewUrl: URL.createObjectURL(pdfBlob),
          thumbnailUrl: thumbnailCanvas.toDataURL('image/jpeg', 0.7),
          type: 'pdf',
          pages: pageImages
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
    const newSourceFiles: File[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        const result = await processImage(file)
        if (result) {
          results.push(result)
          newSourceFiles.push(file)
        }
      } else if (file.type === 'application/pdf') {
        const result = await processPdf(file)
        if (result) {
          results.push(result)
          newSourceFiles.push(file)
        }
      }
    }

    setConvertedFiles(prev => [...prev, ...results])
    setSourceFiles(prev => [...prev, ...newSourceFiles])
    if (results.length > 0 && convertedFiles.length === 0) {
      setSelectedIndex(0)
      setCurrentPage(0)
      setZoom(1)
    }
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
      if (selectedIndex >= newFiles.length && newFiles.length > 0) {
        setSelectedIndex(newFiles.length - 1)
      }
      return newFiles
    })
    setSourceFiles(prev => {
      const newFiles = [...prev]
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const clearAll = () => {
    convertedFiles.forEach(f => URL.revokeObjectURL(f.previewUrl))
    setConvertedFiles([])
    setSourceFiles([])
    setPdfPasswords({})
    setSelectedIndex(0)
  }

  const reconvertAll = useCallback(async () => {
    if (sourceFiles.length === 0) return

    setIsProcessing(true)
    const results: ConvertedFile[] = []

    for (const file of sourceFiles) {
      if (file.type.startsWith('image/')) {
        const result = await processImage(file)
        if (result) results.push(result)
      } else if (file.type === 'application/pdf') {
        const result = await processPdf(file)
        if (result) results.push(result)
      }
    }

    // Revoke old URLs
    convertedFiles.forEach(f => URL.revokeObjectURL(f.previewUrl))
    setConvertedFiles(results)
    setIsProcessing(false)
  }, [sourceFiles, processImage, processPdf, convertedFiles])

  // Reconvert when color mode changes and there are source files
  useEffect(() => {
    if (sourceFiles.length > 0) {
      reconvertAll()
    }
    // Only run when colorMode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorMode])

  // Reset page and zoom when switching files
  useEffect(() => {
    setCurrentPage(0)
    setZoom(1)
  }, [selectedIndex])

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
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Left Sidebar - Color Selector */}
        <aside className="w-full lg:w-56 shrink-0">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="pb-3 px-4">
              <CardTitle className="text-sm">Ink Color</CardTitle>
            </CardHeader>
            <CardContent className="px-4 space-y-3">
              {/* Color Family Selection */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Color</p>
                <div className="grid grid-cols-5 gap-1">
                  {colorFamilies.map(({ family, bgClass }) => {
                    const currentFamily = getColorFamily(colorMode)
                    const isSelected = currentFamily === family
                    return (
                      <button
                        key={family}
                        onClick={() => setColorMode(`${family}-${getModeType(colorMode)}` as ColorMode)}
                        className={`
                          aspect-square rounded flex items-center justify-center transition-all
                          ${isSelected ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-105'}
                        `}
                      >
                        <div className={`h-5 w-5 rounded ${bgClass}`} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Mode</p>
                <div className="flex flex-col gap-1">
                  {modeTypes.map(({ type, name, icon }) => {
                    const currentMode = getModeType(colorMode)
                    const isSelected = currentMode === type
                    return (
                      <button
                        key={type}
                        onClick={() => setColorMode(`${getColorFamily(colorMode)}-${type}` as ColorMode)}
                        className={`
                          flex items-center gap-2 p-2 rounded text-left text-xs transition-all
                          ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}
                        `}
                      >
                        {icon}
                        <span className="font-medium">{name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Center - Main Preview or Drop Zone */}
        <div className="flex-1 min-w-0">
          {convertedFiles.length > 0 ? (
            <Card>
              <CardHeader className="pb-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{convertedFiles[selectedIndex]?.originalName}</CardTitle>
                    <CardDescription className="text-xs">
                      {convertedFiles[selectedIndex]?.type === 'pdf' && convertedFiles[selectedIndex].pages
                        ? `Page ${currentPage + 1} of ${convertedFiles[selectedIndex].pages.length}`
                        : 'Image preview'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Page navigation for PDFs */}
                    {convertedFiles[selectedIndex]?.type === 'pdf' && (convertedFiles[selectedIndex].pages?.length || 0) > 1 && (
                      <>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCurrentPage(p => Math.min((convertedFiles[selectedIndex].pages?.length || 1) - 1, p + 1))} disabled={currentPage >= (convertedFiles[selectedIndex].pages?.length || 1) - 1}>
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
                    <Button size="sm" onClick={() => downloadFile(convertedFiles[selectedIndex])} disabled={isProcessing}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4">
                <div className="bg-muted rounded-lg overflow-auto h-[calc(100vh-14rem)]">
                  <div className="min-h-full flex items-center justify-center p-4">
                    <img
                      src={
                        convertedFiles[selectedIndex]?.type === 'pdf' && convertedFiles[selectedIndex].pages
                          ? convertedFiles[selectedIndex].pages[currentPage] || convertedFiles[selectedIndex].thumbnailUrl
                          : convertedFiles[selectedIndex]?.previewUrl
                      }
                      alt={convertedFiles[selectedIndex]?.originalName}
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
                <h2 className="text-2xl font-semibold tracking-tight">No Black Ink</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Print documents using only one color ink
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
                    accept="image/*,.pdf"
                    multiple
                    onChange={(e) => handleFiles(e.target.files)}
                    className="hidden"
                    disabled={isProcessing}
                  />
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      <p className="text-sm text-muted-foreground">Processing...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-medium">Drop files here or click to upload</p>
                        <p className="text-sm text-muted-foreground mt-1">Images (PNG, JPG) and PDF files</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* How it works */}
              <div className="hidden sm:grid grid-cols-3 gap-6 py-8">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">1</div>
                  <p className="text-xs text-muted-foreground">Select ink color</p>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">2</div>
                  <p className="text-xs text-muted-foreground">Upload documents</p>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">3</div>
                  <p className="text-xs text-muted-foreground">Download & print</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar - File List */}
        {convertedFiles.length > 0 && (
          <aside className="w-full lg:w-56 shrink-0">
            <Card className="lg:sticky lg:top-20">
              <CardHeader className="pb-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Files</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => convertedFiles.forEach(downloadFile)} disabled={isProcessing} className="h-7 px-2 text-xs">
                      All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearAll} disabled={isProcessing} className="h-7 w-7 p-0">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 space-y-1 max-h-[70vh] overflow-y-auto">
                {convertedFiles.map((file, index) => (
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
                          src={file.type === 'pdf' ? file.thumbnailUrl : file.previewUrl}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-xs font-medium truncate">{file.originalName}</span>
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

export default ConvertPage
