export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const key = process.env.GOOGLE_API_KEY
  if (!key || key === 'SET_YOUR_GOOGLE_API_KEY_HERE') return response.status(503).json({ error: 'GOOGLE_API_KEY is not configured' })
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body || {}
    const messages = body.messages || []
    const contents = messages.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(message.content || '') }] }))
    const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { temperature: 0.2 } }),
    })
    const data = await result.json()
    if (!result.ok) return response.status(result.status).json({ error: data.error?.message || 'Google API error' })
    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || ''
    return response.status(200).json({ content, article_ranking: { ranked: [] } })
  } catch (error) {
    return response.status(500).json({ error: error.message })
  }
}
