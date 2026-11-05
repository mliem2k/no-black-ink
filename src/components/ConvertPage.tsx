import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Check,
  Contrast,
  Files,
  PaintBucket,
  Palette,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import { ProcessedFile } from '../types'
import { usePasswordPrompt } from '../hooks/usePasswordPrompt'
import { loadPdfWithPassword, renderPdfPages, revokeFileUrls } from '../lib/pdfUtils'
import { DropZone } from './DropZone'
import { PreviewPanel } from './PreviewPanel'
import { FileListSidebar } from './FileListSidebar'
import PasswordModal from './PasswordModal'
import { cn } from '@/lib/utils'

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

const COLOR_FAMILIES: { family: ColorFamily; name: string; hex: string }[] = [
  { family: 'blue',   name: 'Blue',   hex: '#3b82f6' },
  { family: 'brown',  name: 'Brown',  hex: '#a16207' },
  { family: 'green',  name: 'Green',  hex: '#16a34a' },
  { family: 'purple', name: 'Purple', hex: '#8b5cf6' },
  { family: 'red',    name: 'Red',    hex: '#ef4444' }
]

const MODE_TYPES = [
  {
    type: 'auto' as const,
    name: 'Smart',
    description: 'Converts black and near-black pixels only. Photos and existing color stay untouched.',
    icon: Sparkles
  },
  {
    type: 'grayscale' as const,
    name: 'Grayscale',
    description: 'Converts grayscale pixels only. Existing color in the document is preserved.',
    icon: Contrast
  },
  {
    type: 'all' as const,
    name: 'Full tint',
    description: 'Applies the ink color to the whole page, including photos and graphics.',
    icon: PaintBucket
  }
]

const FEATURES = [
  { icon: Palette, title: '5 ink colors', body: 'Blue, brown, green, purple, red.' },
  { icon: Sparkles, title: '3 modes', body: 'Smart, grayscale and full tint.' },
  { icon: Files, title: 'PDF & images', body: 'Multi-page PDFs, PNG and JPG.' },
  { icon: ShieldCheck, title: 'Stays local', body: 'Nothing is uploaded.' }
]

const STEPS = [
  'Pick an ink color and conversion mode.',
  'Drop a PDF, PNG or JPG into the page.',
  'Download the converted file and print.'
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

  const addInputRef = useRef<HTMLInputElement>(null)

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

  const hasFiles = convertedFiles.length > 0
  const activeMode = MODE_TYPES.find(mode => mode.type === getModeType(colorMode)) ?? MODE_TYPES[0]
  const ActiveModeIcon = activeMode.icon
  const activeColor = COLOR_FAMILIES.find(color => color.family === getColorFamily(colorMode)) ?? COLOR_FAMILIES[0]

  const selectColor = (family: ColorFamily) =>
    setColorMode(`${family}-${getModeType(colorMode)}` as ColorMode)

  const selectMode = (type: 'auto' | 'grayscale' | 'all') =>
    setColorMode(`${getColorFamily(colorMode)}-${type}` as ColorMode)

  const mobileInkControls = (
    <div className="mb-4 rounded-xl border border-border bg-card/50 p-3 lg:hidden">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] font-medium text-foreground">Ink color</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-dim">Output</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" role="group" aria-label="Ink color">
        {COLOR_FAMILIES.map(({ family, name, hex }) => {
          const isSelected = getColorFamily(colorMode) === family
          return (
            <button
              key={family}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectColor(family)}
              className={cn(
                'flex h-12 flex-col items-center justify-center gap-1.5 rounded-md border text-[10.5px] font-medium transition-colors duration-150',
                isSelected
                  ? 'border-line-strong bg-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              <span
                className="h-3.5 w-3.5 rounded-full shadow-[inset_0_0_0_1px_oklch(0_0_0/0.18)]"
                style={{ backgroundColor: hex }}
                aria-hidden="true"
              />
              {name}
            </button>
          )
        })}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Conversion mode">
        {MODE_TYPES.map(({ type, name, icon: Icon }) => {
          const isSelected = getModeType(colorMode) === type
          return (
            <button
              key={type}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectMode(type)}
              className={cn(
                'flex h-9 items-center justify-center gap-1.5 rounded-md border text-[11px] font-medium transition-colors duration-150',
                isSelected
                  ? 'border-line-strong bg-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {name}
            </button>
          )
        })}
      </div>
      <p className="mt-2 px-0.5 text-[10.5px] leading-relaxed text-dim">{activeMode.description}</p>
    </div>
  )

  return (
    <>
      <div
        className={cn(
          'grid items-start gap-6 lg:gap-8',
          hasFiles
            ? 'lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)_232px]'
            : 'lg:grid-cols-[232px_minmax(0,1fr)]'
        )}
      >
        {/* Ink controls */}
        <aside className="hidden lg:sticky lg:top-[5.5rem] lg:block">
          <div className="overflow-hidden rounded-xl border border-border bg-card/50">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-[12px] font-medium text-foreground">Ink</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-dim">5 colors</span>
            </div>

            <div className="p-1.5" role="group" aria-label="Ink color">
              {COLOR_FAMILIES.map(({ family, name, hex }) => {
                const isSelected = getColorFamily(colorMode) === family
                return (
                  <button
                    key={family}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => selectColor(family)}
                    className={cn(
                      'flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left transition-colors duration-150',
                      isSelected
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_oklch(0_0_0/0.18)]"
                      style={{ backgroundColor: hex }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-[12.5px] font-medium">{name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>

            <div className="border-t border-border p-1.5">
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-dim">
                Mode
              </p>
              {MODE_TYPES.map(({ type, name, icon: Icon }) => {
                const isSelected = getModeType(colorMode) === type
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => selectMode(type)}
                    className={cn(
                      'flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left transition-colors duration-150',
                      isSelected
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-[12.5px] font-medium">{name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>

            <div className="border-t border-border px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                <ActiveModeIcon className="h-3 w-3 text-dim" aria-hidden="true" />
                {activeMode.name}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-dim">
                {activeMode.description}
              </p>
            </div>
          </div>
        </aside>

        {/* Preview or upload */}
        <div className="order-1 min-w-0 lg:order-2">
          {hasFiles ? (
            <>
              {mobileInkControls}
              <PreviewPanel
                file={convertedFiles[selectedIndex]}
                currentPage={currentPage}
                zoom={zoom}
                isProcessing={isProcessing}
                onPageChange={setCurrentPage}
                onZoomChange={setZoom}
                onDownload={() => downloadFile(convertedFiles[selectedIndex])}
              />
            </>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-[27px] font-medium leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[32px]">
                  Print with any ink color.
                </h1>
                <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
                  Out of black ink? Convert black text and images to the color you have, then print.
                  Everything runs in your browser.
                </p>
              </div>

              {mobileInkControls}

              <DropZone
                accept="image/*,.pdf"
                isProcessing={isProcessing}
                processingLabel="Converting…"
                hint="PDF, PNG or JPG. Multiple files are converted at once."
                tone={{ name: activeColor.name, hex: activeColor.hex }}
                onFiles={handleFiles}
              />

              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
                {FEATURES.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="bg-background p-4">
                    <Icon className="h-3.5 w-3.5 text-dim" aria-hidden="true" />
                    <p className="mt-2.5 text-[12px] font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-dim">{body}</p>
                  </div>
                ))}
              </div>

              <section className="mt-8 border-t border-border pt-5">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-[12px] font-medium text-foreground">How it works</h2>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-dim">3 steps</p>
                </div>
                <ol className="mt-4 grid gap-4 sm:grid-cols-3 sm:gap-6">
                  {STEPS.map((step, index) => (
                    <li key={step} className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] text-dim">
                        {index + 1}
                      </span>
                      <span className="text-[11.5px] leading-relaxed text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>

        {/* Files */}
        {hasFiles && (
          <div className="order-3 lg:col-span-2 xl:col-span-1">
            <FileListSidebar
              files={convertedFiles}
              selectedIndex={selectedIndex}
              isProcessing={isProcessing}
              onSelect={setSelectedIndex}
              onRemove={removeFile}
              onAdd={() => addInputRef.current?.click()}
              onDownloadAll={() => convertedFiles.forEach(downloadFile)}
              onClearAll={clearAll}
              renderMeta={(file) =>
                file.type === 'pdf' && file.pageCount
                  ? <p className="font-mono text-[10px] text-dim">{file.pageCount} pages</p>
                  : null
              }
            />
          </div>
        )}
      </div>

      <input
        ref={addInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFiles(e.target.files)
            e.target.value = ''
          }
        }}
      />

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
