import { useState, useCallback, useEffect, useRef } from 'react'
import { FileImage, Palette, Sparkles, FileText, Image as ImageIcon, Lock, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProcessedFile } from '../types'
import { usePasswordPrompt } from '../hooks/usePasswordPrompt'
import { loadPdfWithPassword, renderPdfPages, revokeFileUrls } from '../lib/pdfUtils'
import { DropZone } from './DropZone'
import { PreviewPanel } from './PreviewPanel'
import { FileListSidebar } from './FileListSidebar'
import PasswordModal from './PasswordModal'

type ColorMode =
  | 'blue-auto' | 'blue-grayscale' | 'blue-all'
  | 'brown-auto' | 'brown-grayscale' | 'brown-all'
  | 'green-auto' | 'green-grayscale' | 'green-all'
  | 'purple-auto' | 'purple-grayscale' | 'purple-all'
  | 'red-auto' | 'red-grayscale' | 'red-all'

type ColorFamily = 'blue' | 'brown' | 'green' | 'purple' | 'red'

function getColorFamily(mode: ColorMode): ColorFamily {
  return mode.split('-')[0] as ColorFamily
}

function getModeType(mode: ColorMode): 'auto' | 'grayscale' | 'all' {
  return mode.split('-')[1] as 'auto' | 'grayscale' | 'all'
}

function getFileSuffix(mode: ColorMode): string {
  const family = getColorFamily(mode)
  return getModeType(mode) === 'all' ? `_${family}full` : `_${family}`
}

const COLOR_MAPS: Record<
  ColorFamily,
  { all: [number, number, number, number, number, number]; auto: [number, number, number, number, number, number] }
> = {
  blue:   { all: [0.4, 0.6, 0.4, 0, 30, 180],   auto: [0.3, 0.5, 0.3, 0, 40, 200] },
  brown:  { all: [0.7, 0.5, 0.3, 60, 40, 10],    auto: [0.6, 0.4, 0.2, 80, 50, 20] },
  green:  { all: [0.3, 0.7, 0.4, 0, 120, 30],    auto: [0.2, 0.6, 0.3, 0, 160, 40] },
  purple: { all: [0.6, 0.3, 0.6, 60, 0, 100],    auto: [0.5, 0.2, 0.5, 80, 0, 140] },
  red:    { all: [0.8, 0.2, 0.2, 120, 0, 0],     auto: [0.7, 0.1, 0.1, 160, 0, 0] }
}

const COLOR_FAMILIES: { family: ColorFamily; name: string; bgClass: string; hex: string }[] = [
  { family: 'blue',   name: 'Blue',   bgClass: 'bg-blue-500',   hex: '#3b82f6' },
  { family: 'brown',  name: 'Brown',  bgClass: 'bg-amber-700',  hex: '#92400e' },
  { family: 'green',  name: 'Green',  bgClass: 'bg-green-600',  hex: '#16a34a' },
  { family: 'purple', name: 'Purple', bgClass: 'bg-purple-600', hex: '#9333ea' },
  { family: 'red',    name: 'Red',    bgClass: 'bg-red-600',    hex: '#dc2626' }
]

const MODE_TYPES: { type: 'auto' | 'grayscale' | 'all'; name: string; description: string; icon: React.ReactNode }[] = [
  { type: 'auto',      name: 'Smart',      description: 'Auto-detects black text', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { type: 'grayscale', name: 'Grayscale',  description: 'Only converts B&W',       icon: <FileImage className="h-3.5 w-3.5" /> },
  { type: 'all',       name: 'Full Tint',  description: 'Converts everything',      icon: <Palette className="h-3.5 w-3.5" /> }
]

function applyColorFilter(canvas: HTMLCanvasElement, mode: ColorMode): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const family = getColorFamily(mode)
  const modeType = getModeType(mode)
  const [rM, gM, bM, rB, gB, bB] = COLOR_MAPS[family][modeType === 'all' ? 'all' : 'auto']

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a === 0) continue
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const isGray = Math.max(r, g, b) - Math.min(r, g, b) < 30
    const shouldConvert = modeType === 'all' ? true : (isGray && lum < 180)
    if (shouldConvert) {
      const d = modeType === 'all' ? 1 - lum / 255 : 1 - lum / 180
      data[i]     = Math.floor(r * rM + rB + d * rB * 0.5)
      data[i + 1] = Math.floor(g * gM + gB + d * gB * 0.3)
      data[i + 2] = Math.floor(b * bM + bB + d * bB * 0.3)
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

function ConvertPage() {
  const [convertedFiles, setConvertedFiles] = useState<ProcessedFile[]>([])
  const [sourceFiles, setSourceFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [colorMode, setColorMode] = useState<ColorMode>('blue-auto')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pdfPasswords, setPdfPasswords] = useState<Record<string, string>>({})

  const { prompt, promptPassword } = usePasswordPrompt()

  // Refs for latest values accessible inside stable callbacks / effects
  const sourceFilesRef = useRef<File[]>([])
  const pdfPasswordsRef = useRef<Record<string, string>>({})
  const convertedFilesCountRef = useRef(0)
  sourceFilesRef.current = sourceFiles
  pdfPasswordsRef.current = pdfPasswords
  convertedFilesCountRef.current = convertedFiles.length

  // processImage takes mode as a param — no stale colorMode closure
  const processImage = useCallback(async (file: File, mode: ColorMode): Promise<ProcessedFile | null> => {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0)
        applyColorFilter(canvas, mode)
        canvas.toBlob((blob) => {
          if (!blob) { resolve(null); return }
          const suffix = getFileSuffix(mode)
          resolve({
            id: crypto.randomUUID(),
            originalName: file.name.replace(/\.[^.]+$/, `${suffix}.png`),
            blob,
            previewUrl: URL.createObjectURL(blob),
            type: 'image'
          })
        }, 'image/png')
      }
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null) }
      img.src = objectUrl
    })
  }, [])

  // processPdf takes mode + cachedPassword as params
  const processPdf = useCallback(async (
    file: File,
    mode: ColorMode,
    cachedPassword?: string,
    onNewPassword?: (pwd: string) => void
  ): Promise<ProcessedFile | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await loadPdfWithPassword(
        file, arrayBuffer, promptPassword, cachedPassword, onNewPassword
      )
      if (!pdf) return null

      const result = await renderPdfPages(pdf, (canvas) => applyColorFilter(canvas, mode))
      if (!result) return null

      const suffix = getFileSuffix(mode)
      return {
        id: crypto.randomUUID(),
        originalName: file.name.replace(/\.pdf$/i, `${suffix}.pdf`),
        blob: result.outputBlob,
        previewUrl: URL.createObjectURL(result.outputBlob),
        thumbnailUrl: result.thumbnailUrl,
        type: 'pdf',
        pages: result.pages,
        pageCount: result.pages.length
      }
    } catch (error) {
      console.error('Error processing PDF:', error)
      return null
    }
  }, [promptPassword])

  const handleFiles = useCallback(async (fileList: FileList) => {
    if (!fileList.length) return
    const mode = colorMode
    const passwords = pdfPasswordsRef.current
    const isFirstBatch = convertedFilesCountRef.current === 0

    setIsProcessing(true)

    const pairs = await Promise.all(
      Array.from(fileList)
        .filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
        .map(async file => {
          const result = file.type.startsWith('image/')
            ? await processImage(file, mode)
            : await processPdf(file, mode, passwords[file.name], (pwd) => {
                setPdfPasswords(prev => ({ ...prev, [file.name]: pwd }))
              })
          return { file, result }
        })
    )

    const valid = pairs.filter(p => p.result !== null) as { file: File; result: ProcessedFile }[]
    setConvertedFiles(prev => [...prev, ...valid.map(p => p.result)])
    setSourceFiles(prev => [...prev, ...valid.map(p => p.file)])

    if (valid.length > 0 && isFirstBatch) {
      setSelectedIndex(0)
      setCurrentPage(0)
      setZoom(1)
    }
    setIsProcessing(false)
  }, [colorMode, processImage, processPdf])

  // Reconvert all source files when colorMode changes.
  // Using refs for sourceFiles/passwords avoids making them deps,
  // so this only fires on colorMode change (not on every file add).
  useEffect(() => {
    if (sourceFilesRef.current.length === 0) return
    let cancelled = false

    setIsProcessing(true)
    const files = sourceFilesRef.current
    const passwords = pdfPasswordsRef.current

    Promise.all(
      files.map(file =>
        file.type.startsWith('image/')
          ? processImage(file, colorMode)
          : processPdf(file, colorMode, passwords[file.name])
      )
    ).then(results => {
      if (cancelled) return
      const valid = results.filter(Boolean) as ProcessedFile[]
      setConvertedFiles(prev => { prev.forEach(revokeFileUrls); return valid })
      setIsProcessing(false)
    }).catch(() => { if (!cancelled) setIsProcessing(false) })

    return () => { cancelled = true }
  }, [colorMode, processImage, processPdf])

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
    setConvertedFiles(prev => {
      const next = [...prev]
      revokeFileUrls(next[index])
      next.splice(index, 1)
      if (selectedIndex >= next.length && next.length > 0) setSelectedIndex(next.length - 1)
      return next
    })
    setSourceFiles(prev => { const next = [...prev]; next.splice(index, 1); return next })
  }

  const clearAll = () => {
    convertedFiles.forEach(revokeFileUrls)
    setConvertedFiles([])
    setSourceFiles([])
    setPdfPasswords({})
    setSelectedIndex(0)
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Left Sidebar — Color Selector */}
        <aside className="w-full lg:w-56 shrink-0">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="pb-3 px-4">
              <CardTitle className="text-sm">Ink Color</CardTitle>
            </CardHeader>
            <CardContent className="px-4 space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Color</p>
                <div className="grid grid-cols-5 gap-1">
                  {COLOR_FAMILIES.map(({ family, bgClass }) => {
                    const isSelected = getColorFamily(colorMode) === family
                    return (
                      <button
                        key={family}
                        onClick={() => setColorMode(`${family}-${getModeType(colorMode)}` as ColorMode)}
                        className={`aspect-square rounded flex items-center justify-center transition-all
                          ${isSelected ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-105'}`}
                      >
                        <div className={`h-5 w-5 rounded ${bgClass}`} />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Mode</p>
                <div className="flex flex-col gap-1">
                  {MODE_TYPES.map(({ type, name, icon }) => {
                    const isSelected = getModeType(colorMode) === type
                    return (
                      <button
                        key={type}
                        onClick={() => setColorMode(`${getColorFamily(colorMode)}-${type}` as ColorMode)}
                        className={`flex items-center gap-2 p-2 rounded text-left text-xs transition-all
                          ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
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

        {/* Center — Preview or Drop Zone */}
        <div className="flex-1 min-w-0">
          {convertedFiles.length > 0 ? (
            <PreviewPanel
              file={convertedFiles[selectedIndex]}
              currentPage={currentPage}
              zoom={zoom}
              isProcessing={isProcessing}
              onPageChange={setCurrentPage}
              onZoomChange={setZoom}
              onDownload={() => downloadFile(convertedFiles[selectedIndex])}
            />
          ) : (
            <>
              {/* Hero */}
              <div className="text-center py-8 sm:py-10">
                <h2 className="text-3xl font-bold tracking-tight">Print with any ink color</h2>
                <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-sm sm:text-base">
                  Out of black ink? Upload your documents and convert all text to print using only the ink you have — blue, brown, green, purple, or red.
                </p>
              </div>

              <DropZone
                accept="image/*,.pdf"
                isProcessing={isProcessing}
                processingLabel="Converting..."
                hint="Images (PNG, JPG) and PDF files"
                onFiles={handleFiles}
              />

              {/* Feature grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 py-8">
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-border/50 bg-card">
                  <div className="flex gap-1">
                    {COLOR_FAMILIES.map(({ bgClass }) => (
                      <div key={bgClass} className={`h-3 w-3 rounded-full ${bgClass}`} />
                    ))}
                  </div>
                  <p className="text-xs font-medium">5 ink colors</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">Blue, brown, green, purple, and red</p>
                </div>
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-border/50 bg-card">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-xs font-medium">3 conversion modes</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">Smart, grayscale-only, or full tint</p>
                </div>
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-border/50 bg-card">
                  <div className="flex gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    <ImageIcon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs font-medium">PDF &amp; images</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">Multi-page PDFs, PNG, and JPG</p>
                </div>
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-border/50 bg-card">
                  <Lock className="h-4 w-4 text-primary" />
                  <p className="text-xs font-medium">100% private</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">Processed locally, nothing uploaded</p>
                </div>
              </div>

              {/* Mode explanations */}
              <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversion modes</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {MODE_TYPES.map(({ type, name, icon }) => (
                    <div key={type} className="flex gap-2.5">
                      <div className="mt-0.5 text-primary shrink-0">{icon}</div>
                      <div>
                        <p className="text-xs font-medium">{name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {type === 'auto' && 'Detects black/dark text and converts only that, leaving colored content unchanged.'}
                          {type === 'grayscale' && 'Converts only pixels that are black, white, or gray — preserves any existing color.'}
                          {type === 'all' && 'Applies a full color tint to the entire document — great for photos and graphics.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="hidden sm:grid grid-cols-3 gap-6 py-8">
                {[
                  { n: 1, label: 'Pick your ink color and mode' },
                  { n: 2, label: 'Upload PDFs or images' },
                  { n: 3, label: 'Download and print' }
                ].map(({ n, label }) => (
                  <div key={n} className="flex flex-col items-center gap-2 text-center">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                      {n}
                    </div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Speed note */}
              <div className="flex items-center gap-2 justify-center pb-4">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Processing is instant — everything runs in your browser</p>
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar — File List */}
        {convertedFiles.length > 0 && (
          <FileListSidebar
            files={convertedFiles}
            selectedIndex={selectedIndex}
            isProcessing={isProcessing}
            onSelect={setSelectedIndex}
            onRemove={removeFile}
            onDownloadAll={() => convertedFiles.forEach(downloadFile)}
            onClearAll={clearAll}
            renderMeta={(file) =>
              file.type === 'pdf' && file.pageCount
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

export default ConvertPage
