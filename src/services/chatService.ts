import type { ArticleRecommendationPayload, Message } from '../types/chat'

type StreamEvent =
  | { type: 'thinking'; step: string }
  | { type: 'text'; text: string; articleRanking?: ArticleRecommendationPayload }
  | { type: 'done' }
  | { type: 'error'; message: string }

export async function* sendMessage(
  messages: ReadonlyArray<Message>,
): AsyncGenerator<StreamEvent> {
  try {
    yield { type: 'thinking', step: 'Reading the question and identifying the research intent…' }
    yield { type: 'thinking', step: 'Routing the query to relevant NASA fire-safety topics…' }
    yield { type: 'thinking', step: 'Searching article metadata, abstracts, and source files…' }
    yield { type: 'thinking', step: 'Checking available PDF text and extracted tables for evidence…' }
    yield { type: 'thinking', step: 'Selecting parameters that matter for this question…' }
    yield { type: 'thinking', step: 'Applying the 40/25/20/15 weighted relevance rubric…' }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 180_000)
    let response: Response
    try {
      response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({
          role: role === 'bot' ? 'assistant' : role,
          content,
        })),
      }),
      })
    } finally {
      window.clearTimeout(timeout)
    }
    const body = await response.text()
    let data: { content?: string; error?: string; article_ranking?: ArticleRecommendationPayload } = {}
    if (body.trim()) {
      try {
        data = JSON.parse(body) as typeof data
      } catch {
        throw new Error('The research service returned invalid JSON.')
      }
    }
    if (!response.ok) throw new Error(data.error || 'API cavabı alınmadı')
    if (!data.content) throw new Error('API boş cavab qaytardı')
    yield { type: 'thinking', step: 'Preparing the comparison table and article explanations…' }
    yield { type: 'text', text: data.content, articleRanking: data.article_ranking }
    yield { type: 'done' }
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'The research search took too long and was stopped. Please try again.'
      : error instanceof Error ? error.message : 'Scoring engine failed'
    yield { type: 'error', message }
  }
}
