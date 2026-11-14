export type MessageRole = 'user' | 'bot'

export type MessageStatus = 'sending' | 'sent' | 'streaming' | 'error'

export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  status: MessageStatus
}

export interface ChatError {
  message: string
  botMessageId: string | null
}
