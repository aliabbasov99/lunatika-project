// src/components/chat/Composer.tsx
import React, { useCallback, useEffect, useRef } from 'react'

interface ComposerProps {
  input: string
  setInput: (value: string) => void
  isLoading: boolean
  onSend: (text: string) => void
}

const MAX_HEIGHT = 150 // ~6 lines

export function Composer({ input, setInput, isLoading, onSend }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const disabled = isLoading

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [setInput])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !disabled) {
        e.preventDefault()
        onSend(input)
      }
    },
    [input, disabled, onSend]
  )

  // Auto-grow textarea up to ~6 lines, then allow internal scrolling.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`
  }, [input])

  return (
    <div className="flex items-end gap-2 p-4 border-t border-zinc-800 bg-zinc-950">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        className="flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
        rows={1}
        disabled={disabled}
        aria-label="Message input"
        spellCheck={false}
      />
      <button
        onClick={() => onSend(input)}
        disabled={disabled}
        className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${!disabled
          ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
          : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed opacity-50'}`}
        aria-label="Send message"
      >
        Send
      </button>
    </div>
  )
}
