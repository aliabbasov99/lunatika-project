// Persistent multi-chat storage backed by localStorage.
// Stores full message history per chat; embeddings are stripped to save space.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message } from '../types/chat'

export interface StoredChat {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'lunatika-chats-v1'
const MAX_CHATS = 30
const CURRENT_ID_KEY = 'lunatika-current-chat-id'

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

function stripHeavyPayload(message: Message): Message {
  // Embedding vectors are only needed for live scoring, not for display.
  const ranking = message.ranking
    ? {
        ...message.ranking,
        ranked: message.ranking.ranked.map((item) => ({
          ...item,
          experiment: { ...item.experiment, embedding: [] },
        })),
      }
    : undefined
  return { ...message, ranking }
}

function loadAll(): StoredChat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages))
  } catch {
    return []
  }
}

function persist(chats: StoredChat[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_CHATS)))
  } catch {
    // Quota exceeded — drop the oldest chats and retry once.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 5)))
    } catch {
      /* give up silently */
    }
  }
}

export function useChatStorage(activeMessages: Message[], isActiveLoading: boolean, requestedId?: string) {
  const [chats, setChats] = useState<StoredChat[]>(loadAll)
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CURRENT_ID_KEY)
    } catch {
      return null
    }
  })
  // Tracks whether the active conversation is already reflected in `chats`
  // (skips persisting while a fresh load is in progress).
  const loadingRef = useRef(false)

  useEffect(() => {
    void fetch('/api/chats')
      .then((response) => response.ok ? response.json() as Promise<{ chats?: StoredChat[] }> : null)
      .then((payload) => {
        if (!payload?.chats?.length) return
        setChats(payload.chats)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.chats)) } catch { /* offline cache */ }
      })
      .catch(() => { /* localStorage remains the fallback */ })
  }, [])

  // A deep link is authoritative when the user opens /chat/:id.
  useEffect(() => {
    if (requestedId && requestedId !== activeId && chats.some((chat) => chat.id === requestedId)) {
      setActiveId(requestedId)
    }
  }, [requestedId, activeId, chats])

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(CURRENT_ID_KEY, activeId)
      else localStorage.removeItem(CURRENT_ID_KEY)
    } catch {
      /* ignore */
    }
  }, [activeId])

  // Auto-save the active conversation whenever its messages settle.
  useEffect(() => {
    if (loadingRef.current) return
    if (!activeId || isActiveLoading) return
    if (activeMessages.length === 0) return
    const firstUser = activeMessages.find((m) => m.role === 'user')
    const title = firstUser?.content.slice(0, 40) || 'Yeni söhbət'
    const entry: StoredChat = {
      id: activeId,
      title,
      messages: activeMessages.map(stripHeavyPayload),
      createdAt: activeMessages[0]?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    setChats((previous) => {
      const next = [entry, ...previous.filter((c) => c.id !== activeId)].slice(0, MAX_CHATS)
      persist(next)
      void fetch('/api/chats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }).catch(() => undefined)
      return next
    })
  }, [activeId, activeMessages, isActiveLoading])

  const createChat = useCallback((): string => {
    const id = uid()
    loadingRef.current = false
    setActiveId(id)
    const now = Date.now()
    const entry: StoredChat = {
      id,
      title: 'New chat',
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    setChats((previous) => {
      const next = [entry, ...previous.filter((chat) => chat.id !== id)].slice(0, MAX_CHATS)
      persist(next)
      void fetch('/api/chats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }).catch(() => undefined)
      return next
    })
    return id
  }, [])

  const openChat = useCallback((id: string): Message[] | null => {
    const chat = chats.find((c) => c.id === id)
    if (!chat) return null
    loadingRef.current = true
    setActiveId(id)
    // Allow the loader effect to skip one save cycle for the freshly loaded chat.
    setTimeout(() => { loadingRef.current = false }, 50)
    return chat.messages
  }, [chats])

  const deleteChat = useCallback((id: string) => {
    setChats((previous) => {
      const next = previous.filter((c) => c.id !== id)
      persist(next)
      return next
    })
    if (activeId === id) setActiveId(null)
  }, [activeId])

  const renameChat = useCallback((id: string, title: string) => {
    setChats((previous) => {
      const next = previous.map((c) => (c.id === id ? { ...c, title: title.slice(0, 60) } : c))
      persist(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setChats([])
    persist([])
    setActiveId(null)
  }, [])

  return { chats, activeId, createChat, openChat, deleteChat, renameChat, clearAll }
}
