// src/pages/Chat.tsx
// Single-file chat page: types, mocked service, hook, and UI components together.
// Matches the existing navbar design language (zinc palette, Geist font, rounded-lg, subtle borders).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type MessageRole = 'user' | 'bot'
type MessageStatus = 'sending' | 'sent' | 'streaming' | 'error'

interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  status: MessageStatus
}

interface ChatError {
  message: string
  botMessageId: string | null
}

/* ------------------------------------------------------------------ */
/* Service (mocked, streamed)                                         */
/* ------------------------------------------------------------------ */

type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

const MOCK_REPLIES = [
  'Salam! Mene mesajinizi gordum. Sana nasil yardimci ola bilerem?',
  'Bu bir test cavabidir. Gercek API endpoint-ini baglamak icin yukardaki TODO-yu duzenleyin.',
  'Chat isletmesi dusunulmus siradaki addim gercek API-nin integrelenmesidir.',
  'Mesajinizi aldim. Dogru yolda gedirik. Neye odaklanmaq isteyirsen?',
]

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// TODO: Replace this mocked implementation with the real API endpoint.
// The real endpoint should accept the conversation and stream the assistant's reply.
async function* sendMessage(
  messages: ReadonlyArray<Message>,
): AsyncGenerator<StreamEvent> {
  await delay(400)

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const userText = (lastUser?.content ?? '').toLowerCase()

  let reply: string
  if (
    userText.includes('salam') ||
    userText.includes('merhaba') ||
    userText.includes('hello')
  ) {
    reply = 'Salam! Sana nasil yardimci ola bilerem?'
  } else if (userText.includes('ne var') || userText.includes('nasil')) {
    reply = 'Hele deyil, hersey iyidir. Sen ne istersen?'
  } else if (userText.includes('api') || userText.includes('endpoint')) {
    reply =
      'Gercek API-nin bu yere baglanilmasi lazim. Bu dosyadaki TODO-isaretlenen yeri duzenle.'
  } else {
    reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)]
  }

  let accumulated = ''
  const words = reply.split(/\s+/)
  for (const word of words) {
    accumulated = accumulated ? `${accumulated} ${word}` : word
    yield { type: 'text', text: accumulated }
    await delay(20 + Math.random() * 60)
  }

  yield { type: 'done' }
}

/* ------------------------------------------------------------------ */
/* Hook                                                               */
/* ------------------------------------------------------------------ */

const AUTO_SCROLL_THRESHOLD = 80

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ChatError | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const isUserScrolledUpRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const atBottom =
      list.scrollTop + list.clientHeight >= list.scrollHeight - AUTO_SCROLL_THRESHOLD
    if (atBottom || !isUserScrolledUpRef.current) {
      list.scrollTop = list.scrollHeight
    }
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const onScroll = () => {
      isUserScrolledUpRef.current =
        list.scrollTop + list.clientHeight < list.scrollHeight - AUTO_SCROLL_THRESHOLD
    }
    list.addEventListener('scroll', onScroll, { passive: true })
    return () => list.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const streamBot = useCallback(
    async (botId: string, conversation: ReadonlyArray<Message>) => {
      setIsLoading(true)
      setError(null)
      try {
        for await (const event of sendMessage(conversation)) {
          if (event.type === 'text') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botId
                  ? { ...m, content: event.text, status: 'streaming' }
                  : m
              )
            )
          }
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, status: 'sent' } : m))
        )
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, status: 'error' } : m))
        )
        setError({
          message: 'Reply could not be received. Try again.',
          botMessageId: botId,
        })
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return
      const userMessage: Message = {
        id: uid(),
        role: 'user',
        content: text,
        createdAt: Date.now(),
        status: 'sent',
      }
      setMessages((prev) => [...prev, userMessage])
      setInput('')
      const botId = uid()
      setMessages((prev) => [
        ...prev,
        {
          id: botId,
          role: 'bot',
          content: '',
          createdAt: Date.now(),
          status: 'streaming',
        },
      ])
      void streamBot(botId, [...messages, userMessage])
    },
    [isLoading, messages, streamBot]
  )

  const retry = useCallback(
    (botMessageId: string) => {
      setError(null)
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === botMessageId)
        if (idx === -1) return prev
        const before = prev.slice(0, idx)
        const lastUser = [...before].reverse().find((m) => m.role === 'user')
        setMessages(before)
        if (lastUser) {
          const newBotId = uid()
          setMessages((p) => [
            ...p,
            {
              id: newBotId,
              role: 'bot',
              content: '',
              createdAt: Date.now(),
              status: 'streaming',
            },
          ])
          void streamBot(newBotId, before)
        }
        return before
      })
    },
    [streamBot]
  )

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    listRef,
    send,
    retry,
  }
}

/* ------------------------------------------------------------------ */
/* Components                                                         */
/* ------------------------------------------------------------------ */

function renderInline(text: string): Array<string | ReactElement> {
  const nodes: Array<string | ReactElement> = []
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
          nodes.push(
            <strong key={`b-${i}-${j}`} className="font-semibold">
              {seg.slice(2, -2)}
            </strong>
          )
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

function renderMarkdown(text: string): ReactElement[] {
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

type MessageItemProps = {
  message: Message
  errorId: string | null
  onRetry: (id: string) => void
}

function MessageItem({ message, errorId, onRetry }: MessageItemProps) {
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

type MessageListProps = {
  messages: Message[]
  errorId: string | null
  onRetry: (id: string) => void
}

const MAX_HEIGHT = 150

function Composer({
  input,
  setInput,
  isLoading,
  onSend,
}: {
  input: string
  setInput: (value: string) => void
  isLoading: boolean
  onSend: (text: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputDisabled = isLoading
  const sendDisabled = inputDisabled || !input.trim()

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [setInput])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !sendDisabled) {
        e.preventDefault()
        onSend(input)
      }
    },
    [input, sendDisabled, onSend]
  )

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
        disabled={inputDisabled}
        aria-label="Message input"
        spellCheck={false}
      />
      <button
        onClick={() => onSend(input)}
        disabled={sendDisabled}
        className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          !sendDisabled
            ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
            : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed opacity-50'
        }`}
        aria-label="Send message"
      >
        Send
      </button>
    </div>
  )
}

function MessageList({ messages, errorId, onRetry }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6">
        <div className="flex h-full flex-col items-center justify-center text-zinc-500 text-sm">
          No messages yet.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6">
      <div className="flex flex-col gap-4">
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            errorId={errorId}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function Chat() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    send,
    retry,
  } = useChat()

  return (
    <div className="flex flex-col h-full min-h-0 overflow-x-hidden">
      <MessageList
        messages={messages}
        errorId={error?.botMessageId ?? null}
        onRetry={retry}
      />
      <Composer
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        onSend={send}
      />
    </div>
  )
}
