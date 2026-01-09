import { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, Lock } from 'lucide-react'
import ConvertPage from './components/ConvertPage'
import UnlockPdfPage from './components/UnlockPdfPage'
import './App.css'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

interface PasswordPrompt {
  show: boolean
  fileName: string
  onSubmit: (password: string) => void
  onCancel: () => void
}

function App() {
  const [currentPage, setCurrentPage] = useState<'convert' | 'unlock'>('convert')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-2xl mx-auto">
          <div className="flex items-center justify-between py-3 px-4 sm:px-6">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                {currentPage === 'convert' ? <Upload className="h-4 w-4 sm:h-5 sm:w-5" /> : <Lock className="h-4 w-4 sm:h-5 sm:w-5" />}
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-semibold truncate">No Black Ink</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden xs:block">
                  {currentPage === 'convert' ? 'Convert to blue ink' : 'Remove PDF passwords'}
                </p>
              </div>
            </div>

            <Tabs value={currentPage} onValueChange={(v) => setCurrentPage(v as 'convert' | 'unlock')}>
              <TabsList className="gap-1">
                <TabsTrigger value="convert" className="gap-1 text-xs sm:text-sm px-2.5 py-1.5">
                  <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Convert</span>
                </TabsTrigger>
                <TabsTrigger value="unlock" className="gap-1 text-xs sm:text-sm px-2.5 py-1.5">
                  <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Unlock</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-2xl mx-auto py-4 sm:py-6 px-4 sm:px-6">
        {currentPage === 'convert' && <ConvertPage />}
        {currentPage === 'unlock' && <UnlockPdfPage />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4 mt-8">
        <div className="container max-w-2xl mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            All processing happens locally in your browser. Your files never leave your device.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
export type { PasswordPrompt }
