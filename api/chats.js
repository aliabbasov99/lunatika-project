export default function handler(request, response) {
  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method === 'GET') return response.status(200).json([])
  if (request.method === 'POST') return response.status(200).json({ ok: true })
  return response.status(405).json({ error: 'Method not allowed' })
}
