import { useState, useCallback } from 'react'
import { PasswordPromptState } from '../types'

const DEFAULT: PasswordPromptState = {
  show: false,
  fileName: '',
  onSubmit: () => {},
  onCancel: () => {}
}

export function usePasswordPrompt() {
  const [prompt, setPrompt] = useState<PasswordPromptState>(DEFAULT)

  const promptPassword = useCallback((fileName: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPrompt({
        show: true,
        fileName,
        onSubmit: (password) => {
          setPrompt(prev => ({ ...prev, show: false }))
          resolve(password)
        },
        onCancel: () => {
          setPrompt(prev => ({ ...prev, show: false }))
          resolve(null)
        }
      })
    })
  }, [])

  return { prompt, promptPassword }
}
