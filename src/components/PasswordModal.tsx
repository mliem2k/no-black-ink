import { useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PasswordModalProps {
  show: boolean
  fileName: string
  onSubmit: (password: string) => void
  onCancel: () => void
}

function PasswordModal({ show, fileName, onSubmit, onCancel }: PasswordModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (show && inputRef.current) {
      inputRef.current.focus()
    }
  }, [show])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    const password = formData.get('password') as string
    if (password) {
      onSubmit(password)
    }
  }

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md w-[95vw] mx-auto">
        <DialogHeader className="space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-base sm:text-lg">Password Required</DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            <span className="font-medium text-foreground block truncate">{fileName}</span>
            <span className="mt-1 block">Enter the password to unlock this PDF.</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Input
                ref={inputRef}
                id="password"
                name="password"
                type="password"
                placeholder="Enter password"
                autoComplete="current-password"
                className="h-11"
                required
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-3 flex-col-reverse sm:flex-row">
            <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              Unlock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default PasswordModal
