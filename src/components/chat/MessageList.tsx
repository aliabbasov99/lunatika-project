// src/components/chat/MessageList.tsx
import React from 'react'
import type { Message } from '../../types/chat'
import { MessageItem } from './MessageItem'

interface MessageListProps {
  messages: Message[]
  errorId: string | null
  onRetry: (id: string) => void
}

const MessageList = React.forwardRef<HTMLDivElement, MessageListProps>(
  ({ messages, errorId, onRetry }, ref) => {
    if (messages.length === 0) {
      return (
        <div ref={ref} className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="flex h-full flex-col items-center justify-center text-zinc-500 text-sm">
            No messages yet.
          </div>
        </div>
      )
    }

    return (
      <div ref={ref} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6">
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
)

MessageList.displayName = 'MessageList'

export { MessageList }
