import type { Message } from '../types/chat'

type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export async function* sendMessage(
  messages: ReadonlyArray<Message>,
): AsyncGenerator<StreamEvent> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({
        role: role === 'bot' ? 'assistant' : role,
        content,
      })),
    }),
  })
  const data = await response.json() as { content?: string; error?: string }
  if (!response.ok) throw new Error(data.error || 'API cavabı alınmadı')
  if (!data.content) throw new Error('API boş cavab qaytardı')
  yield { type: 'text', text: data.content }
  yield { type: 'done' }
}
