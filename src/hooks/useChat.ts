// src/hooks/useChat.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatError, Message, MessageRole } from '../types/chat'
import { sendMessage } from '../services/chatService'

const AUTO_SCROLL_THRESHOLD = 80

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export function useChat() {
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

  // Track whether the user has scrolled up to read older messages.
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

  // Auto-scroll to the newest message when the list changes.
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
                m.id === botId ? { ...m, content: event.text, status: 'streaming' } : m
              )
            )
          }
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, status: 'sent' } : m))
        )
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Reply could not be received.'
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, status: 'error' } : m))
        )
        setError({
          message,
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
        role: 'user' as MessageRole,
        content: text,
        createdAt: Date.now(),
        status: 'sent',
      }
      setMessages((prev) => [...prev, userMessage])
      setInput('')
      const botId = uid()
      setMessages((prev) => [
        ...prev,
        { id: botId, role: 'bot', content: '', createdAt: Date.now(), status: 'streaming' },
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

  const reset = useCallback(() => {
    setMessages([])
    setInput('')
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    listRef,
    send,
    retry,
    reset,
    scrollToBottom,
  }
}
