import fs from 'node:fs/promises'
import path from 'node:path'

function csvRows(text) {
  const lines = text.replace(/^\ufeff/, '').trim().split(/\r?\n/)
  const parse = (line) => {
    const out = []; let value = ''; let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (char === '"' && line[i + 1] === '"') { value += '"'; i += 1 }
      else if (char === '"') quoted = !quoted
      else if (char === ',' && !quoted) { out.push(value); value = '' }
      else value += char
    }
    out.push(value); return out
  }
  const headers = parse(lines.shift())
  return lines.map((line) => Object.fromEntries(parse(line).map((value, i) => [headers[i], value])))
}

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') return response.status(204).end()
  try {
    const root = process.cwd()
    const dir = path.join(root, 'artifacts/lunatika_skeleton/website_data')
    const [overview, findingsCsv] = await Promise.all([
      fs.readFile(path.join(dir, 'overview.json'), 'utf8').then(JSON.parse),
      fs.readFile(path.join(dir, 'findings.csv'), 'utf8'),
    ])
    const investigations = overview.investigations || []
    const byId = Object.fromEntries(investigations.map((item) => [item.investigation_id, item]))
    const findings = csvRows(findingsCsv).filter((item) => item.statement).map((item) => ({
      ...item,
      acronym: byId[item.investigation_id]?.acronym,
      investigation_title: byId[item.investigation_id]?.title,
      psi_url: byId[item.investigation_id]?.psi_url,
    }))
    return response.status(200).setHeader('Cache-Control', 'no-store').json({
      investigations, findings, counts: overview.totals || {}, source: 'artifacts/lunatika_skeleton/website_data',
    })
  } catch (error) {
    return response.status(503).json({ error: error.message })
  }
}
