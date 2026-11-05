import { useState, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowUpRight, Github, Lock, Moon, ShieldCheck, Sun, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ConvertPage from './components/ConvertPage'
import UnlockPdfPage from './components/UnlockPdfPage'

function Mark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-elevated text-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.06)]">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
        <path
          d="M10 2.4c2.55 2.98 4.9 5.55 4.9 8.4a4.9 4.9 0 0 1-9.8 0c0-2.85 2.35-5.42 4.9-8.4Z"
          fill="currentColor"
        />
      </svg>
    </span>
  )
}

function App() {
  const [currentPage, setCurrentPage] = useState<'convert' | 'unlock'>('convert')
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff')
  }, [theme])

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (isDark: boolean) => {
      setTheme(isDark ? 'dark' : 'light')
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    }

    applyTheme(saved ? saved === 'dark' : systemDark.matches)

    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) applyTheme(e.matches)
    }
    systemDark.addEventListener('change', handleSystemChange)
    return () => systemDark.removeEventListener('change', handleSystemChange)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    document.documentElement.style.colorScheme = next
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <a href="/" className="flex shrink-0 items-center gap-2.5" aria-label="No Black Ink home">
            <Mark />
            <span className="inline text-[13px] font-medium tracking-tight text-foreground">
              No Black Ink
            </span>
          </a>

          <span className="ml-1 hidden h-4 w-px bg-border md:block" aria-hidden="true" />

          <Tabs
            value={currentPage}
            onValueChange={(v) => setCurrentPage(v as 'convert' | 'unlock')}
            className="ml-auto md:ml-0"
          >
            <TabsList className="h-8 gap-0.5 border border-border bg-elevated/60 p-0.5">
              <TabsTrigger value="convert" className="h-7 gap-1.5 px-2.5 text-xs sm:px-3">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Convert</span>
                <span className="sr-only xs:hidden">Convert</span>
              </TabsTrigger>
              <TabsTrigger value="unlock" className="h-7 gap-1.5 px-2.5 text-xs sm:px-3">
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Unlock PDF</span>
                <span className="sr-only xs:hidden">Unlock PDF</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <a
              href="https://github.com/mliem2k/no-black-ink"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Source code on GitHub (opens in a new tab)"
              className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        {currentPage === 'convert' ? <ConvertPage /> : <UnlockPdfPage />}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-dim sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-dim" aria-hidden="true" />
            All processing happens locally in your browser.
          </p>
          <a
            href="https://github.com/mliem2k/no-black-ink"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-dim transition-colors hover:text-foreground"
          >
            Source
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </footer>
    </div>
  )
}

export default App
