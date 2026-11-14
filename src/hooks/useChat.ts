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
  const activeChatIdRef = useRef<string | null>(null)
  const conversationsRef = useRef(new Map<string, Message[]>())

  const persistBackgroundConversation = useCallback((chatId: string, items: Message[]) => {
    try {
      const raw = localStorage.getItem('lunatika-chats-v1')
      let chats: Array<{ id: string; title: string; messages: Message[]; createdAt: number; updatedAt: number }> = []
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw)
          if (Array.isArray(parsed)) chats = parsed
        } catch {
          localStorage.removeItem('lunatika-chats-v1')
        }
      }
      const firstUser = items.find((item) => item.role === 'user')
      const existing = chats.find((chat) => chat.id === chatId)
      const entry = {
        id: chatId,
        title: firstUser?.content.slice(0, 40) || existing?.title || 'New chat',
        messages: items,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      }
      localStorage.setItem('lunatika-chats-v1', JSON.stringify([entry, ...chats.filter((chat) => chat.id !== chatId)].slice(0, 30)))
      void fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => undefined)
    } catch {
      // Keep the active conversation in memory if storage is unavailable.
    }
  }, [])

  const updateConversation = useCallback((chatId: string, update: (items: Message[]) => Message[]) => {
    const next = update(conversationsRef.current.get(chatId) ?? [])
    conversationsRef.current.set(chatId, next)
    persistBackgroundConversation(chatId, next)
    if (activeChatIdRef.current === chatId) setMessages(next)
  }, [persistBackgroundConversation])

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
    async (chatId: string, botId: string, conversation: ReadonlyArray<Message>, userText: string) => {
      if (activeChatIdRef.current === chatId) setIsLoading(true)
      if (activeChatIdRef.current === chatId) setError(null)
      try {
        for await (const event of sendMessage(conversation)) {
          if (event.type === 'thinking') {
            updateConversation(chatId, (prev) => prev.map((m) =>
              m.id === botId
                ? { ...m, thinking_steps: [...(m.thinking_steps ?? []), event.step], status: 'streaming' }
                : m,
            ))
          } else if (event.type === 'text') {
            updateConversation(chatId, (prev) =>
              prev.map((m) =>
                m.id === botId
                  ? { ...m, content: event.text, article_ranking: event.articleRanking, user_query: userText, status: 'streaming' }
                  : m
              )
            )
          } else if (event.type === 'error') {
            throw new Error(event.message)
          }
        }
        updateConversation(chatId, (prev) =>
          prev.map((m) => (m.id === botId ? { ...m, status: 'sent' } : m))
        )
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Reply could not be received.'
        updateConversation(chatId, (prev) =>
          prev.map((m) => (m.id === botId ? { ...m, status: 'error' } : m))
        )
        if (activeChatIdRef.current === chatId) setError({ message, botMessageId: botId })
      } finally {
        if (activeChatIdRef.current === chatId) setIsLoading(false)
      }
    },
    [updateConversation]
  )

  const send = useCallback(
    async (text: string, chatId: string) => {
      if (!text.trim() || isLoading) return
      const conversation = conversationsRef.current.get(chatId) ?? messages
      const userMessage: Message = {
        id: uid(),
        role: 'user' as MessageRole,
        content: text,
        createdAt: Date.now(),
        status: 'sent',
      }
      updateConversation(chatId, (prev) => [...(prev.length ? prev : conversation), userMessage])
      setInput('')
      const botId = uid()
      updateConversation(chatId, (prev) => [
        ...prev,
        { id: botId, role: 'bot', content: '', createdAt: Date.now(), status: 'streaming' },
      ])
      void streamBot(chatId, botId, [...conversation, userMessage], text)
    },
    [isLoading, messages, streamBot, updateConversation]
  )

  const retry = useCallback(
    (botMessageId: string, chatId: string) => {
      setError(null)
      updateConversation(chatId, (prev) => {
        const idx = prev.findIndex((m) => m.id === botMessageId)
        if (idx === -1) return prev
        const before = prev.slice(0, idx)
        const lastUser = [...before].reverse().find((m) => m.role === 'user')
        if (lastUser) {
          const restarted = [...before, { ...prev[idx], content: '', thinking_steps: [], status: 'streaming' as const }]
          queueMicrotask(() => void streamBot(chatId, botMessageId, before, lastUser.content))
          return restarted
        }
        return before
      })
    },
    [streamBot, updateConversation]
  )

  const reset = useCallback(() => {
    setMessages([])
    setInput('')
    setError(null)
    setIsLoading(false)
  }, [])

  /** Replace the in-memory conversation with a persisted one (chat switching). */
  const loadMessages = useCallback((restored: ReadonlyArray<Message>, chatId: string) => {
    activeChatIdRef.current = chatId
    const cached = conversationsRef.current.get(chatId)
    const next = (cached ?? restored).map((m) => ({ ...m }))
    conversationsRef.current.set(chatId, next)
    setMessages(next)
    setInput('')
    setError(null)
    setIsLoading(next.some((message) => message.status === 'streaming'))
  }, [])

  const activateChat = useCallback((chatId: string | null, restored: ReadonlyArray<Message> = []) => {
    activeChatIdRef.current = chatId
    if (!chatId) {
      setMessages([])
      setIsLoading(false)
      setError(null)
      return
    }
    loadMessages(restored, chatId)
  }, [loadMessages])

  const resumePending = useCallback((chatId: string) => {
    const items = conversationsRef.current.get(chatId) ?? []
    const pending = [...items].reverse().find((item) => item.role === 'bot' && item.status === 'streaming')
    const user = [...items].reverse().find((item) => item.role === 'user')
    if (pending && user) void streamBot(chatId, pending.id, items.slice(0, items.indexOf(pending)), user.content)
  }, [streamBot])

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
    loadMessages,
    activateChat,
    resumePending,
    scrollToBottom,
  }
}
