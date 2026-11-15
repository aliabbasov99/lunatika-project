import { useEffect, useMemo, useState } from 'react'
import './Data.css'
import '../nasa-simulation/styles/tokens.css'
import { StarfieldBackground } from '../components/StarfieldBackground'

type RecordValue = string | number | null
type Investigation = Record<string, RecordValue> & { investigation_id: string; acronym: string; title: string; test_count: number; document_count: number }
type Test = Record<string, RecordValue> & { test_id: string; investigation_id: string }
type Document = Record<string, RecordValue> & { document_id: string; investigation_id: string; title: string }
type Dataset = { investigations: Investigation[]; tests: Test[]; documents: Document[]; findings: Test[] }

const numericFields = new Set(['tier', 'n_tests', 'n_rows', 'n_publications', 'n_document_files', 'downloaded_files', 'n_findings', 'n_key_findings', 'n_earth_applications'])

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1 } else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell); cell = ''
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
    } else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const headers = rows.shift() ?? []
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

function parseValue(key: string, value: string): RecordValue {
  if (value === '') return null
  if (numericFields.has(key) || /(_mm|_pct|_psi|_cm_s|_time_s|_rate_mm_s)$/.test(key)) {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return value
}

const empty: Dataset = { investigations: [], tests: [], documents: [], findings: [] }
const fmt = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value)
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
const labelize = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const ignoreFields = new Set(['investigation_id', 'test_id', 'finding_id', 'document_id', 'document_files', 'raw', 'related', 'categories', 'challenge_note', 'objective', 'hypothesis', 'approach', 'research_impacts', 'authors', 'file_path'])
const excludedTestFields = new Set(['source_table', 'source_line', 'row_kind', 'label', 'test_date', 'observation_source', 'qc_flags', 'document_id', 'implication_source', 'equipment_source', 'earth_application_source', 'source_quote'])
const lowerIsBetter = /soot|smoke|emission|pollut|flammab|tox|hazard|burn_time|spread_rate|temperature|heat_release/i
const higherIsBetter = /margin|efficien|stability|extinction_limit|ignition_limit/i

function summarizeValues(values: RecordValue[]) {
  const present = values.filter((value) => value !== null && value !== '')
  if (!present.length) return { display: '—', numeric: null as number | null }
  const numbers = present.filter((value): value is number => typeof value === 'number')
  if (numbers.length === present.length) {
    const min = Math.min(...numbers)
    const max = Math.max(...numbers)
    const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length
    const display = min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`
    return { display, numeric: mean }
  }
   const unique = [...new Map(present.map((value) => [normalize(value), String(value)])).values()]
   const preview = unique.slice(0, 2).map((value) => value.length > 72 ? `${value.slice(0, 69)}...` : value)
   const remaining = unique.length - preview.length
   return {
     display: `${preview.join(', ')}${remaining > 0 ? `, +${remaining} more` : ''}`,
     numeric: null as number | null,
   }
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function InvestigationBlock({ item, title }: { item?: Investigation; title: string }) {
  return <div className="compare-column"><h3>{title}</h3>{item ? <><h4>{item.investigation_id} · {item.acronym}</h4><p className="compare-title">{item.title}</p></> : <p className="data-empty">Choose an investigation.</p>}</div>
}

export function Data() {
  const [dataset, setDataset] = useState<Dataset>(empty)
  const [view, setView] = useState<'table' | 'compare'>('table')
  const [query, setQuery] = useState('')
  const [fuel, setFuel] = useState('all')
  const [gravity, setGravity] = useState('all')
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiAnswerState, setAiAnswerState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  useEffect(() => {
    const base = `${import.meta.env.BASE_URL}data/website_data/data/`
    Promise.all([
      fetch(`${base}overview.json`).then((response) => response.json()),
      fetch(`${base}tests.csv`).then((response) => response.text()),
      fetch(`${base}findings.csv`).then((response) => response.text()),
    ]).then(([overview, testsCsv, findingsCsv]) => {
      const investigations = (overview.investigations ?? []).map((item: Record<string, unknown>) => {
        const result: Record<string, RecordValue> = {}
        Object.entries(item).forEach(([key, value]) => {
          if (Array.isArray(value) || (value && typeof value === 'object')) result[key] = JSON.stringify(value)
          else result[key] = parseValue(key, String(value ?? ''))
        })
        return { ...result, investigation_id: String(item.investigation_id), acronym: String(item.acronym ?? ''), title: String(item.title ?? ''), test_count: Number(item.n_tests || item.n_rows || 0), document_count: Number(item.n_document_files || 0) } as Investigation
      })
      const tests = parseCsv(testsCsv).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, parseValue(key, value)]))) as Test[]
      const findings = parseCsv(findingsCsv).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, parseValue(key, value)]))) as Test[]
      setDataset({ investigations, tests, documents: [], findings })
    }).catch(() => setDataset(empty))
  }, [])

  const filtered = useMemo(() => dataset.investigations.filter((item) => {
    const haystack = `${item.investigation_id} ${item.acronym} ${item.title} ${item.sub_area}`.toLowerCase()
    return (!query || haystack.includes(query.toLowerCase())) && (fuel === 'all' || item.fuel_state === fuel) && (gravity === 'all' || item.gravity === gravity)
  }), [dataset, fuel, gravity, query])
  const selectedA = dataset.investigations.find((item) => item.investigation_id === first)
  const selectedB = dataset.investigations.find((item) => item.investigation_id === second)
  const metadataFields = useMemo(() => [...new Set([selectedA, selectedB].flatMap((item) => item ? Object.keys(item) : []))]
    .filter((key) => !ignoreFields.has(key) && !['test_count', 'document_count', 'acronym', 'title'].includes(key))
    .filter((key) => selectedA?.[key] !== null && selectedA?.[key] !== '' || selectedB?.[key] !== null && selectedB?.[key] !== ''), [selectedA, selectedB])
  const testsA = dataset.tests.filter((item) => item.investigation_id === first)
  const testsB = dataset.tests.filter((item) => item.investigation_id === second)
  const findingsA = dataset.findings.filter((item) => item.investigation_id === first)
  const findingsB = dataset.findings.filter((item) => item.investigation_id === second)
  const comparableIds = useMemo(() => {
    const recordsA = [...testsA, ...findingsA]
    if (!first || !recordsA.length) return new Set<string>()
    const firstKeys = new Set(recordsA.flatMap((row) => Object.entries(row)
      .filter(([key, value]) => !ignoreFields.has(key) && !excludedTestFields.has(key) && value !== null && value !== '')
      .map(([key]) => key)))
    return new Set(dataset.investigations.filter((item) => {
      if (item.investigation_id === first) return false
      const records = [...dataset.tests, ...dataset.findings].filter((record) => record.investigation_id === item.investigation_id)
      return records.some((record) => Object.entries(record).some(([key, value]) => firstKeys.has(key) && value !== null && value !== ''))
    }).map((item) => item.investigation_id))
  }, [dataset, first, testsA, findingsA])
  const docsA = dataset.documents.filter((item) => item.investigation_id === first)
  const docsB = dataset.documents.filter((item) => item.investigation_id === second)
  const comparisonFields = useMemo(() => {
    const keys = [...new Set([...testsA, ...testsB, ...findingsA, ...findingsB].flatMap((row) => Object.keys(row)))]
      .filter((key) => !ignoreFields.has(key) && !excludedTestFields.has(key))
    return keys.map((key) => {
      const valuesA = [...testsA, ...findingsA].map((row) => row[key] ?? null)
      const valuesB = [...testsB, ...findingsB].map((row) => row[key] ?? null)
      const summaryA = summarizeValues(valuesA)
      const summaryB = summarizeValues(valuesB)
      const presentA = valuesA.filter((value) => value !== null && value !== '').length
      const presentB = valuesB.filter((value) => value !== null && value !== '').length
      const shared = valuesA.some((a) => a !== null && a !== '' && valuesB.some((b) => b !== null && b !== '' && normalize(a) === normalize(b)))
      const different = summaryA.display !== summaryB.display
      let direction: 'a-better' | 'b-better' | 'neutral' = 'neutral'
      let directionLabel = 'Different'
      if (summaryA.numeric !== null && summaryB.numeric !== null && summaryA.numeric !== summaryB.numeric) {
        const preferLower = lowerIsBetter.test(key)
        const preferHigher = higherIsBetter.test(key)
        if (preferLower || preferHigher) {
          const aPreferred = preferLower ? summaryA.numeric < summaryB.numeric : summaryA.numeric > summaryB.numeric
          direction = aPreferred ? 'a-better' : 'b-better'
          directionLabel = `${aPreferred ? 'A' : 'B'} ${preferLower ? 'lower' : 'higher'} / preferred`
        }
      }
      if (shared) directionLabel = 'Shared'
      return {
        key,
        a: summaryA.display,
        b: summaryB.display,
        presentA,
        presentB,
        shared,
        different,
        direction,
        directionLabel,
        coverage: `${presentA}/${testsA.length + findingsA.length} · ${presentB}/${testsB.length + findingsB.length}`,
      }
    }).filter((row) => row.presentA > 0 || row.presentB > 0)
  }, [testsA, testsB, findingsA, findingsB])
  const sharedDocuments = docsA.filter((doc) => docsB.some((other) => normalize(doc.title) === normalize(other.title) || (doc.doi && doc.doi === other.doi)))
  const sharedParameters = comparisonFields.filter((row) => row.shared)
  const differentParameters = comparisonFields.filter((row) => row.different)
  const commonPrompt = sharedParameters.map((row) => `${labelize(row.key)}: ${row.a}`).join('; ')
  const differencesPrompt = differentParameters.map((row) => `${labelize(row.key)} (A: ${row.a}; B: ${row.b})`).join('; ')
  useEffect(() => {
    if (!selectedA || !selectedB) {
      setAiAnswer('')
      setAiAnswerState('idle')
      return
    }

    const controller = new AbortController()
    setAiAnswer('')
    setAiAnswerState('loading')
    const findingText = (records: Test[]) => records.slice(0, 12).map((record) => String(record.statement ?? record.safety_implication ?? '')).filter(Boolean).join(' | ')
    const prompt = `Compare these two NASA PSI investigations for an engineering researcher. Investigation A: ${selectedA.investigation_id} ${selectedA.title}. Investigation B: ${selectedB.investigation_id} ${selectedB.title}. Common parameters: ${commonPrompt || 'none'}. Different parameters: ${differencesPrompt || 'none'}. Findings A: ${findingText(findingsA) || 'none'}. Findings B: ${findingText(findingsB) || 'none'}. Write a concise comparison answer explaining the most important similarities, differences, missing data, and practical interpretation. Do not repeat a separate Common aspects/Differences list. Return plain text only.`

    void fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
    })
      .then(async (response) => {
        const data = await response.json() as { content?: string }
        if (!response.ok || !data.content) throw new Error('AI comparison unavailable')
        setAiAnswer(data.content)
        setAiAnswerState('ready')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setAiAnswerState('error')
      })

    return () => controller.abort()
  }, [selectedA, selectedB, commonPrompt, differencesPrompt, findingsA, findingsB])
  const exportDifferences = () => {
    const rows = [
      ['Parameter', 'Investigation A', 'A value', 'Investigation B', 'B value', 'Coverage'],
      ...differentParameters.map((row) => [labelize(row.key), selectedA?.investigation_id ?? '', row.a, selectedB?.investigation_id ?? '', row.b, row.coverage]),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map((value) => csvCell(value)).join(',')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${first}-${second}-differences.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  const fuels = [...new Set(dataset.investigations.map((item) => String(item.fuel_state ?? '')).filter(Boolean))]
  const gravities = [...new Set(dataset.investigations.map((item) => String(item.gravity ?? '')).filter(Boolean))]

  return <main className="data-page"><StarfieldBackground /><div className="data-shell">
     <header className="data-header"><div><div className="eyebrow">NASA Space Apps · Flame in Freefall</div><h1>Experimental <span className="data-gradient-text">data</span></h1><p>Browse imported research records, inspect the source tables and compare every shared experimental field.</p></div><span className="data-badge">{dataset.investigations.length} investigations · {dataset.tests.length} tests · {dataset.findings.length} findings</span></header>
    <nav className="simulation-tabs data-tabs" aria-label="Data views"><button type="button" aria-selected={view === 'table'} onClick={() => setView('table')}>Table</button><button type="button" aria-selected={view === 'compare'} onClick={() => setView('compare')}>Compare</button></nav>
     {view === 'table' ? <><section className="data-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search investigations..." aria-label="Search investigations" /><select value={fuel} onChange={(event) => setFuel(event.target.value)}><option value="all">All fuel states</option>{fuels.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={gravity} onChange={(event) => setGravity(event.target.value)}><option value="all">All gravity cases</option>{gravities.map((item) => <option key={item} value={item}>{item}</option>)}</select></section><section className="data-card data-table-wrap"><table className="data-table"><thead><tr><th>ID</th><th>Investigation</th><th>Fuel</th><th>Gravity</th><th>Platform</th><th>Tests</th><th>Documents</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.investigation_id}><td><a className="investigation-id-link" href={typeof item.psi_url === 'string' ? item.psi_url : undefined} target="_blank" rel="noreferrer">{item.investigation_id}</a></td><td><strong>{item.acronym}</strong><small>{item.title}</small></td><td>{fmt(item.fuel_state)}</td><td>{fmt(item.gravity)}</td><td>{fmt(item.platform)}</td><td>{item.test_count}</td><td>{item.document_count}</td></tr>)}</tbody></table>{!filtered.length && <p className="data-empty">No records match these filters.</p>}</section></> : <section className="compare-view">
       <div className="data-card compare-pickers"><label>First investigation<select value={first} onChange={(event) => { const next = event.target.value; setFirst(next); if (second !== next) setSecond('') }}><option value="">Choose a record</option>{dataset.investigations.map((item) => <option key={item.investigation_id} value={item.investigation_id}>{item.investigation_id} · {item.acronym}</option>)}</select></label><button type="button" onClick={() => { setFirst(second); setSecond(first) }} disabled={!first || !second}>⇄</button><label>Second investigation<select value={second} onChange={(event) => setSecond(event.target.value)} disabled={!first}><option value="">{first ? 'Choose a compatible record' : 'Choose first record first'}</option>{dataset.investigations.map((item) => <option key={item.investigation_id} value={item.investigation_id} disabled={item.investigation_id === first || !comparableIds.has(item.investigation_id)}>{item.investigation_id} · {item.acronym}{first && !comparableIds.has(item.investigation_id) ? ' · no shared test fields' : ''}</option>)}</select></label></div>
        <section className="data-card comparison"><div className="comparison-head"><InvestigationBlock item={selectedA} title="Investigation A"/><InvestigationBlock item={selectedB} title="Investigation B"/></div>{(selectedA || selectedB) && <div className="metadata-grid"><div className="metadata-row metadata-labels"><b>Property</b><b>Investigation A</b><b>Investigation B</b></div>{metadataFields.map((key) => <div className="metadata-row" key={key}><b>{labelize(key)}</b><span>{fmt(selectedA?.[key])}</span><span>{fmt(selectedB?.[key])}</span></div>)}</div>}{selectedA && selectedB && <><div className="compare-stat-strip"><span><b>{testsA.length}</b> tests A</span><span><b>{testsB.length}</b> tests B</span><span><b>{sharedParameters.length}</b> shared values</span><span><b>{differentParameters.length}</b> differing parameters</span><span><b>{sharedDocuments.length}</b> shared documents</span><button type="button" className="export-differences" onClick={exportDifferences} disabled={!differentParameters.length}>Export Excel-compatible (.csv)</button></div><h3 className="comparison-section-title">Test parameter comparison</h3><div className="comparison-grid"><div className="comparison-row comparison-labels"><b>Investigation A</b><b>Parameter</b><b>Investigation B</b><b>Direction</b></div>{comparisonFields.map((row) => <div className={`comparison-row ${row.shared ? 'is-shared' : ''}`} key={row.key}><span className={row.direction === 'a-better' ? 'value-better' : ''}>{row.a}</span><b className="parameter-name">{labelize(row.key)}</b><span className={row.direction === 'b-better' ? 'value-better' : ''}>{row.b}</span><small>{row.directionLabel}</small></div>)}</div><h3 className="comparison-section-title">AI comparison</h3><section className={`comparison-summary ai-comparison-answer ${aiAnswerState}`} aria-live="polite"><div><p>{aiAnswerState === 'loading' ? <span className="ai-waiting-dots" aria-label="AI answer waiting"><i>.</i><i>.</i><i>.</i></span> : aiAnswerState === 'error' ? 'AI answer could not be loaded.' : aiAnswer}</p></div></section><h3 className="comparison-section-title">Source records</h3><div className="comparison-docs"><div><b>Documents A</b>{docsA.slice(0, 8).map((doc) => <small key={doc.document_id}>{doc.title}</small>)}</div><div><b>Documents B</b>{docsB.slice(0, 8).map((doc) => <small key={doc.document_id}>{doc.title}</small>)}</div></div></>}</section>
      {!selectedA || !selectedB ? <div className="data-card data-empty">Choose two investigations to inspect all common metadata, test fields, values, coverage and source records.</div> : null}
    </section>}
  </div></main>
}

export default Data
