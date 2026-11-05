import { useEffect, useRef } from 'react'
import { LockKeyhole } from 'lucide-react'
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-elevated">
            <LockKeyhole className="h-4 w-4 text-foreground" aria-hidden="true" />
          </div>
          <DialogTitle>Password required</DialogTitle>
          <DialogDescription>
            <span className="block truncate font-medium text-foreground">{fileName}</span>
            Enter the password to unlock this PDF. It stays in memory and is never sent anywhere.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="py-1">
            <Label htmlFor="password" className="mb-2 block text-[12px]">
              Password
            </Label>
            <Input
              ref={inputRef}
              id="password"
              name="password"
              type="password"
              placeholder="Enter password"
              autoComplete="current-password"
              className="h-10"
              required
            />
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Unlock</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default PasswordModal
