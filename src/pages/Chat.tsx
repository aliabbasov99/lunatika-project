import { StarfieldBackground } from '../components/StarfieldBackground'
import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Copy, Edit3, Menu, PanelLeft, Search, ThumbsDown, ThumbsUp } from 'lucide-react'
import { ExperimentDashboard } from '../components/dashboard/ExperimentDashboard'
import type { ArticleRecommendationPayload, Message, RankedExperiment } from '../types/chat'

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

async function answer(messages: Message[]) {
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: messages.map(m => ({ role: m.role === 'bot' ? 'assistant' : m.role, content: m.content })) }) })
    const body = await response.text()
    let data: { content?: string; article_ranking?: ArticleRecommendationPayload; error?: string } = {}
    if (body.trim()) {
      try { data = JSON.parse(body) as typeof data } catch { throw new Error('The research service returned invalid JSON.') }
    }
    if (!response.ok) throw new Error(data.error || 'Research request failed.')
    if (data.content) return { content: data.content, ranking: data.article_ranking }
    throw new Error('The research service returned an empty response.')
  } catch (error) {
    return { content: error instanceof Error ? error.message : 'Research request failed.', ranking: undefined }
  }
}

export function Chat() {
  const [sidebar, setSidebar] = useState(true)
  const [active, setActive] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  const newChat = () => { setActive(null); setMessages([]); setInput('') }
  const send = async () => {
    const text = input.trim(); if (!text || loading) return
    const user: Message = { id: makeId(), role: 'user', content: text, createdAt: Date.now(), status: 'sent' }
    const bot: Message = { id: makeId(), role: 'bot', content: '', createdAt: Date.now(), status: 'streaming' }
    const conversation = [...messages, user]; setMessages([...conversation, bot]); setInput(''); setLoading(true)
    if (!active) setActive(makeId())
    try {
      const result = await answer(conversation)
      const full = result.content
      for (let i = 2; i <= full.length; i += Math.max(3, Math.ceil(full.length / 45))) {
        setMessages(prev => prev.map(m => m.id === bot.id ? { ...m, content: full.slice(0, i) } : m)); await new Promise(r => setTimeout(r, 14))
      }
      setMessages(prev => prev.map(m => m.id === bot.id ? { ...m, content: full, article_ranking: result.ranking, user_query: text, status: 'sent' } : m))
    } finally { setLoading(false) }
  }
  const copy = (message: Message) => { void navigator.clipboard?.writeText(message.content); setCopied(message.id); setTimeout(() => setCopied(null), 1400) }

  return (
    <div className="relative w-full h-full min-h-0 bg-black overflow-hidden flex justify-center">
      {/* Background Starfield */}
      <StarfieldBackground />

      {/* Main Container Wrapper with Left & Right Max-width limits */}
      <div className="relative z-10 w-full max-w-[940px] h-[calc(100%_-_48px)] my-4 rounded-3xl overflow-hidden flex shadow-[0_20px_70px_rgba(0,0,0,0.9)] border border-white/[0.12] backdrop-blur-2xl">
        <div className="gemini-page w-full !bg-white/[0.03] backdrop-blur-2xl !text-white">
    <aside className={`gemini-sidebar animate-stagger-1 ${sidebar ? '' : 'closed'}`}>
      <div className="gemini-side-head"><div /><div><button onClick={() => setShowSearch(!showSearch)} aria-label="Search"><Search size={18} /></button><button onClick={() => setSidebar(false)} aria-label="Close panel"><PanelLeft size={18} /></button></div></div>
      {showSearch && <input className="gemini-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..." />}
      <div className="gemini-nav">
        <button onClick={newChat}><Edit3 />New chat</button>
      </div>
    </aside>
    <main className="gemini-main">
      <header className="gemini-top">{!sidebar && <button onClick={() => setSidebar(true)}><Menu size={20} /></button>}</header>
      {messages.length === 0 ? <div className="gemini-empty"><h1 className="animate-stagger-1">Where should we start?</h1><div className="animate-stagger-2 w-full flex justify-center"><Composer input={input} setInput={setInput} send={send} loading={loading} /></div></div> : <div className="gemini-conversation"><div className="gemini-messages">{messages.map(m => <div className={`gemini-message ${m.role === 'user' ? 'from-user' : ''}`} key={m.id}><div className="message-body"><div className="message-text">{m.content || <span className="thinking">Searching Recall.md, PostgreSQL materials and NASA research...</span>}</div>{m.role === 'bot' && m.status === 'sent' && <>{m.article_ranking && <ResearchResults ranking={m.article_ranking} userQuery={m.user_query || ''} />}<div className="message-actions"><button onClick={() => copy(m)}>{copied === m.id ? <Check size={15} /> : <Copy size={15} />}</button><button><ThumbsUp size={15} /></button><button><ThumbsDown size={15} /></button></div></>}</div></div>)}<div ref={endRef} /></div><div className="gemini-bottom"><div className="animate-stagger-2 w-full flex justify-center"><Composer input={input} setInput={setInput} send={send} loading={loading} /></div><p>AI can provide inaccurate information, so check responses carefully.</p></div></div>}
    </main>
        </div>
      </div>
    </div>
  )
}

function Composer({ input, setInput, send, loading }: { input: string; setInput: (s: string) => void; send: () => void; loading: boolean }) {
  return <div className="gemini-composer"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }} placeholder="Ask anything" disabled={loading} />{input.trim() && <button className="send" onClick={send} aria-label="Send"><ArrowUp size={18} /></button>}</div>
}

function ResearchResults({ ranking, userQuery }: { ranking: ArticleRecommendationPayload; userQuery: string }) {
  const [selected, setSelected] = useState<RankedExperiment | null>(null)
  const rows = ranking.ranked || []
  return <section className="research-results">
    <h3>Relevant NASA research · weighted match</h3>
    <p className="research-summary">{ranking.answer_summary}</p>
    {ranking.routing && <div className="routing-summary"><span><b>Selected cohort</b>{(ranking.routing.topic_names || ranking.routing.topics || []).join(' · ') || 'Research groups from the local PSI catalog'}</span><span><b>Search scope</b>{ranking.routing.breadth === 'narrow' ? 'Focused · top 5' : 'Broad · top 10'}</span><span><b>Why these groups</b>{ranking.routing.reason || 'Matched from the question intent.'}</span></div>}
    {rows.length ? <div className="research-list">{rows.map((row, index) => <button key={`${row.article.id}-${index}`} onClick={() => setSelected({
       experiment: {
         id: row.article.id, full_name: row.article.title, domain_cluster: 'Liquid_Droplet_Combustion', mission: row.article.project || 'NASA PSI', year: row.article.date && /^\d{4}/.test(row.article.date) ? Number(row.article.date.slice(0, 4)) : 0, facility: 'NASA research facility',
         description: row.article.objective || row.rationale, materials: row.article.materials || [], safety_takeaway: row.article.evidence_note || 'Review the source record for safety implications.',
         methodology: row.article.method || 'See linked source files.', parameters: Object.fromEntries((row.article.parameters || []).map(p => [p.name, p.unit ? `${String(p.value)} ${p.unit}` : p.value])), parameter_chart: row.article.parameter_chart || [], evidence_files: row.article.source_files || [], evidence_quality: row.article.evidence_quality || 'Low', embedding: [],
       }, breakdown: row.breakdown, total_score: row.total_score, evidence_badge: row.article.evidence_quality || 'Low', rationale: row.rationale,
    })}>
      <span className="research-rank">{index + 1}</span><span className="research-name"><b>{row.article.title}</b><small>{row.article.id}{row.article.project ? ` · ${row.article.project}` : ''}</small></span><strong>{row.total_score}<small>/100</small></strong>
    </button>)}</div> : <p className="no-research">No sufficiently relevant, source-supported research records were found in the local corpus.</p>}
     {ranking.why_relevant && <p className="research-why"><b>Why these results matter:</b> {ranking.why_relevant}</p>}
     {rows.length > 0 && <p className="scoring-caption">Relevance 40% · Experimental conditions 25% · Safety significance 20% · Data completeness 15%</p>}
    {selected && <ExperimentDashboard ranked={selected} userQuery={userQuery} onClose={() => setSelected(null)} />}
  </section>
}
