// src/components/chat/ChatView.tsx
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { useChat } from '../../hooks/useChat'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface SavedChat {
  id: string
  title: string
  updatedAt: number
}

const SAVED_CHATS_KEY = 'lunatika-chat-list'

export function ChatView() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    listRef,
    send,
    retry,
    reset,
  } = useChat()
  const [savedChats, setSavedChats] = useState<SavedChat[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_CHATS_KEY) ?? '[]') as SavedChat[]
    } catch {
      return []
    }
  })

  const currentTitle = useMemo(() => {
    const firstUserMessage = messages.find((message) => message.role === 'user')
    return firstUserMessage?.content.slice(0, 36) || 'Yeni söhbət'
  }, [messages])

  useEffect(() => {
    localStorage.setItem(SAVED_CHATS_KEY, JSON.stringify(savedChats))
  }, [savedChats])

  const handleSend = useCallback((text: string) => {
    if (!text.trim()) return
    const current: SavedChat = { id: 'current', title: text.trim().slice(0, 36), updatedAt: Date.now() }
    setSavedChats((previous) => [current, ...previous.filter((chat) => chat.id !== 'current')].slice(0, 20))
    void send(text)
  }, [send])

  const startNewChat = () => {
    reset()
    setSavedChats((previous) => previous.filter((chat) => chat.id !== 'current'))
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-zinc-950">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Chats</span>
          <button
            type="button"
            onClick={startNewChat}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {savedChats.length === 0 ? (
            <p className="px-2 py-3 text-xs text-zinc-600">Your conversations will appear here.</p>
          ) : (
            savedChats.map((chat) => (
              <div
                key={chat.id}
                className={`mb-1 truncate rounded-md px-3 py-2 text-sm ${chat.id === 'current' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'}`}
                title={chat.title}
              >
                {chat.title}
              </div>
            ))
          )}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 md:hidden">
          <span className="text-sm font-medium text-zinc-300">{currentTitle}</span>
          <button type="button" onClick={startNewChat} className="text-xs text-zinc-400">+ New chat</button>
        </div>
        <MessageList
          ref={listRef}
          messages={messages}
          errorId={error?.botMessageId ?? null}
          onRetry={retry}
        />
        {error ? <p className="px-4 pb-2 text-xs text-red-400">{error.message}</p> : null}
        <Composer input={input} setInput={setInput} isLoading={isLoading} onSend={handleSend} />
      </main>
    </div>
  )
}
