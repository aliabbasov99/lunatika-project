// src/components/chat/MessageItem.tsx
import React, { useCallback, useState } from 'react'
import type { Message } from '../../types/chat'

interface MessageItemProps {
  message: Message
  errorId: string | null
  onRetry: (id: string) => void
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const parts = text.split(/(`[^`]+`)/)
  parts.forEach((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      nodes.push(
        <code
          key={`code-${i}`}
          className="bg-zinc-800/50 border border-zinc-800/50 rounded px-1.5 py-0.5 text-zinc-300 text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      )
    } else {
      const bold = part.split(/(\*\*[^*\n]+\*\*)/)
      bold.forEach((seg, j) => {
        if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
          nodes.push(<strong key={`b-${i}-${j}`} className="font-semibold">{seg.slice(2, -2)}</strong>)
        } else if (seg !== '') {
          nodes.push(seg)
        }
      })
    }
  })
  return nodes
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }, [code])
  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 group-hover:block text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
      aria-label="Copy code"
      disabled={copied}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function renderMarkdown(text: string): React.ReactNode[] {
  const blocks = text.split(/\n\n+/)
  return blocks.map((block, i) => {
    const trimmed = block.trim()
    const codeMatch = trimmed.match(/^```(\w*)\n([\s\S]*?)\n```$/)
    if (codeMatch) {
      const [, , code] = codeMatch
      return (
        <div key={`block-${i}`} className="my-2 w-full">
          <div className="relative group">
            <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 overflow-x-auto">
              <code className="block whitespace-pre">{code}</code>
            </pre>
            <CopyButton code={code} />
          </div>
        </div>
      )
    }
    if (/^([-*]|\d+\.)\s/.test(trimmed)) {
      const items = trimmed.split('\n').map((line, j) => {
        const itemText = line.replace(/^([-*]|\d+\.)\s*/, '')
        return (
          <li key={`li-${i}-${j}`} className="my-1 text-zinc-100">
            {renderInline(itemText)}
          </li>
        )
      })
      const firstLine = trimmed.split('\n')[0]
      const isOrdered = /^\d+\.\s/.test(firstLine)
      return (
        <ul
          key={`block-${i}`}
          className={`my-2 ${isOrdered ? 'list-decimal' : 'list-disc'} list-inside space-y-1 text-zinc-100`}
        >
          {items}
        </ul>
      )
    }
    return (
      <p key={`block-${i}`} className="my-2 text-zinc-100 leading-relaxed">
        {renderInline(trimmed)}
      </p>
    )
  })
}

export function MessageItem({ message, errorId, onRetry }: MessageItemProps) {
  const { role, content, createdAt, status } = message
  const isUser = role === 'user'
  const isError = status === 'error'
  const isStreaming = status === 'streaming'
  const time = new Date(createdAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const showRetry = isError && message.id === errorId

  const bubbleClass = `
    rounded-lg border p-3 text-sm leading-relaxed min-w-[40%] max-w-[75%]
    ${isUser
      ? 'bg-zinc-800/60 border-zinc-800/60 text-zinc-100 ml-auto'
      : 'bg-zinc-900 border-zinc-800 text-zinc-100'}
  `.trim()

  const handleRetry = useCallback(() => onRetry(message.id), [message.id, onRetry])

  return (
    <div className={`w-full mb-4 ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
      <div className={bubbleClass}>
        {isUser ? content : renderMarkdown(content)}
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[10px] text-zinc-500">{time}</span>
          {showRetry ? (
            <button
              onClick={handleRetry}
              className="text-[10px] font-medium text-zinc-400 hover:text-zinc-200 underline underline-offset-4"
              aria-label="Retry"
            >
              Retry
            </button>
          ) : null}
          {isStreaming ? (
            <span className="text-[10px] text-zinc-500 animate-pulse">sending</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
