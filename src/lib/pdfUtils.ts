import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Configure worker once at module load — no CDN dependency
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

type PasswordPrompter = (fileName: string) => Promise<string | null>

export async function loadPdfWithPassword(
  file: File,
  arrayBuffer: ArrayBuffer,
  promptPassword: PasswordPrompter,
  cachedPassword?: string,
  onNewPassword?: (password: string) => void
): Promise<pdfjsLib.PDFDocumentProxy | null> {
  let password: string | undefined = cachedPassword
  let pdf: pdfjsLib.PDFDocumentProxy | null = null

  while (!pdf) {
    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password }).promise
    } catch (error: any) {
      if (error?.name === 'PasswordException' || error?.message?.includes('password')) {
        const entered = await promptPassword(file.name)
        if (entered === null) return null
        password = entered
        onNewPassword?.(entered)
      } else {
        throw error
      }
    }
  }

  return pdf
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))),
      'image/jpeg',
      quality
    )
  })
}

export async function renderPdfPages(
  pdf: pdfjsLib.PDFDocumentProxy,
  applyFilter?: (canvas: HTMLCanvasElement) => void
): Promise<{ pages: string[]; thumbnailUrl: string; outputBlob: Blob } | null> {
  const pageCanvases: HTMLCanvasElement[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
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
    applyFilter?.(canvas)
    pageCanvases.push(canvas)
  }

  if (pageCanvases.length === 0) return null

  // Blob URLs keep image data in browser-managed memory rather than the JS heap
  const pageBlobs = await Promise.all(pageCanvases.map(c => canvasToBlob(c, 0.92)))
  const pages = pageBlobs.map(blob => URL.createObjectURL(blob))

  // Thumbnail is tiny, data URL is fine
  const thumbCanvas = document.createElement('canvas')
  const scale = Math.min(300 / pageCanvases[0].width, 300 / pageCanvases[0].height, 1)
  thumbCanvas.width = pageCanvases[0].width * scale
  thumbCanvas.height = pageCanvases[0].height * scale
  thumbCanvas.getContext('2d')?.drawImage(pageCanvases[0], 0, 0, thumbCanvas.width, thumbCanvas.height)
  const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.7)

  const { jsPDF } = await import('jspdf')
  const first = pageCanvases[0]
  const pdfDoc = new jsPDF({
    orientation: first.width > first.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [first.width, first.height]
  })

  pageCanvases.forEach((canvas, i) => {
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    if (i === 0) {
      pdfDoc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
    } else {
      pdfDoc.addPage(
        [canvas.width, canvas.height],
        canvas.width > canvas.height ? 'landscape' : 'portrait'
      )
      pdfDoc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
    }
  })

  return { pages, thumbnailUrl, outputBlob: pdfDoc.output('blob') }
}

export function revokeFileUrls(file: { previewUrl: string; pages?: string[] }): void {
  URL.revokeObjectURL(file.previewUrl)
  file.pages?.forEach(url => URL.revokeObjectURL(url))
}
