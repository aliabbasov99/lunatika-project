// Stage 2: Query routing + transparent weighted scoring engine (40/25/20/15)
import {
  DOMAIN_CLUSTERS,
  type DomainCluster,
  type ExperimentRecord,
  type RankedExperiment,
  type RecommendationPayload,
  type ScoreBreakdown,
} from '../types/chat'
import { EXPERIMENTS } from '../data/experiments'

const WEIGHTS = {
  relevance: 0.4,
  conditions: 0.25,
  safety: 0.2,
  data: 0.15,
} as const

// ---- 1. Domain routing: keyword matching to cluster definitions ----
export function routeQuery(query: string): { clusters: DomainCluster[]; specificity: 'broad' | 'specific'; topK: number } {
  const normalized = query.toLowerCase().replace(/ı/g, 'i').replace(/ə/g, 'e')
  const tokens = new Set(normalized.split(/[^a-z0-9.\/%]+/).filter((t) => t.length > 2))
  const scores = new Map<DomainCluster, number>()
  for (const cluster of DOMAIN_CLUSTERS) {
    let score = 0
    for (const kw of cluster.keywords) {
      const k = kw.trim()
      if (!k) continue
      if (normalized.includes(k)) score += k.includes(' ') ? 3 : 2
      if (tokens.has(k)) score += 2
    }
    if (score > 0) scores.set(cluster.id, score)
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const clusters: DomainCluster[] = ranked.length ? ranked.slice(0, 2).map(([id]) => id) : DOMAIN_CLUSTERS.map((c) => c.id)
  const uniqueTokens = tokens.size
  const specificity: 'broad' | 'specific' =
    uniqueTokens >= 6 || /\b(pmma|droplet|wire|rib|o2|oxygen|pressure|habitat|lunar|methane|heptane)\b/i.test(normalized)
      ? 'specific'
      : 'broad'
  const topK = specificity === 'specific' ? 5 : 10
  return { clusters, specificity, topK }
}

// ---- 2. Hybrid search: cosine similarity + keyword overlap ----
function cosine(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot // vectors already normalized
}

function keywordOverlap(query: string, exp: ExperimentRecord): number {
  const qTokens = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2))
  const text = [exp.id, exp.full_name, exp.description, exp.safety_takeaway, ...exp.materials].join(' ').toLowerCase()
  let hits = 0
  for (const tok of qTokens) if (text.includes(tok)) hits++
  return qTokens.size ? hits / qTokens.size : 0
}

function conditionsMatch(query: string, exp: ExperimentRecord): number {
  const q = query.toLowerCase()
  let score = 50 // baseline neutral
  const gravityTerms: Array<[RegExp, string]> = [
    [/lunar|moon|1\/6\s*g|partial.?g/, 'lunar'],
    [/mars|3\/8\s*g/, 'mars'],
    [/microgravity|micro.?gravity|zero.?g|iss|space station/, 'microgravity'],
  ]
  for (const [re, tag] of gravityTerms) {
    if (re.test(q)) {
      const p = JSON.stringify(exp.parameters).toLowerCase()
      if (p.includes(tag)) score += 35
      if (tag === 'lunar' && /o2|oxygen/.test(q) && /4[05]|3[456789]/.test(q)) score += 10
    }
  }
  const o2Match = q.match(/(\d{2})\s*%\s*o2|o2\s*[≈:=]?\s*(\d{2})\s*%/)
  if (o2Match) {
    const target = parseInt(o2Match[1] ?? o2Match[2] ?? '21', 10)
    const params = JSON.stringify(exp.parameters)
    const found = [...params.matchAll(/(\d{2,3})/g)].map((m) => parseInt(m[1], 10)).filter((n) => n >= 10 && n <= 60)
    if (found.some((n) => Math.abs(n - target) <= 3)) score += 20
  }
  const pressureMatch = q.match(/(\d{2,3})\s*kpa/)
  if (pressureMatch) {
    const target = parseInt(pressureMatch[1], 10)
    const params = JSON.stringify(exp.parameters)
    const found = [...params.matchAll(/(\d{2,3})/g)].map((m) => parseInt(m[1], 10)).filter((n) => n >= 30 && n <= 200)
    if (found.some((n) => Math.abs(n - target) <= 15)) score += 10
  }
  return Math.min(score, 100)
}

function safetyScore(exp: ExperimentRecord): number {
  const badge = exp.evidence_quality
  let score = 62
  if (/suppression|extinction|suppre|extinguish|flammability|hazard|risk|detector|screening/i.test(exp.safety_takeaway)) score += 18
  if (/standard|criteria|derating|inspection|calibration/i.test(exp.safety_takeaway)) score += 10
  if (badge === 'High') score += 8
  else if (badge === 'Medium') score += 3
  return Math.min(score, 100)
}

function dataCompleteness(exp: ExperimentRecord): number {
  const leafCount = countLeaves(exp.parameters)
  const hasCharts = exp.parameter_chart?.length ?? 0
  let score = Math.min(40 + leafCount * 3 + hasCharts * 8, 95)
  if (exp.evidence_quality === 'High') score = Math.min(score + 5, 98)
  return Math.round(score)
}

function countLeaves(obj: unknown): number {
  if (Array.isArray(obj)) return obj.reduce<number>((s, v) => s + countLeaves(v), 0)
  if (obj && typeof obj === 'object') return Object.values(obj).reduce<number>((s, v) => s + countLeaves(v), 0)
  return obj == null ? 0 : 1
}

function rationaleFor(exp: ExperimentRecord, b: ScoreBreakdown, rank: number): string {
  const clusterLabel = DOMAIN_CLUSTERS.find((c) => c.id === exp.domain_cluster)?.label ?? exp.domain_cluster
  return `Rank #${rank}: ${exp.id} (${clusterLabel}). Semantic alignment with the query's materials/environment scored ${b.relevance}/100; ` +
    `experimental conditions match ${b.conditions_similarity}/100; safety impact of findings ${b.safety_significance}/100; ` +
    `quantitative parameter completeness ${b.data_completeness}/100.`
}

export function scoreQuery(query: string): RecommendationPayload {
  const { clusters, specificity, topK } = routeQuery(query)
  const candidates = EXPERIMENTS.filter((exp) => clusters.includes(exp.domain_cluster))
  const pool = candidates.length ? candidates : EXPERIMENTS

  const ranked: RankedExperiment[] = pool
    .map((exp): RankedExperiment => {
      const sem = cosine(queryVector(query), exp.embedding) // ~0..1
      const kw = keywordOverlap(query, exp)
      const relevance = Math.round(Math.min(100, sem * 70 + kw * 55))
      const conditions_similarity = Math.round(conditionsMatch(query, exp))
      const safety_significance = safetyScore(exp)
      const data_completeness = dataCompleteness(exp)
      const breakdown: ScoreBreakdown = { relevance, conditions_similarity, safety_significance, data_completeness }
      const total = Math.round(
        relevance * WEIGHTS.relevance +
        conditions_similarity * WEIGHTS.conditions +
        safety_significance * WEIGHTS.safety +
        data_completeness * WEIGHTS.data,
      )
      return {
        experiment: exp,
        breakdown,
        total_score: total,
        evidence_badge: exp.evidence_quality,
        rationale: '',
      }
    })
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, topK)
    .map((item, index) => ({ ...item, rationale: rationaleFor(item.experiment, item.breakdown, index + 1) }))

  const top = ranked[0]
  const answer_summary = top
    ? `Query routed to ${clusters.join(', ')}. Top match: ${top.experiment.id} (${top.total_score}%) — ${top.experiment.safety_takeaway}`
    : 'No matching experiments found in the curated dataset.'

  return {
    answer_summary,
    intent: specificity === 'specific' ? 'specific engineering question' : 'broad exploration',
    clusters,
    specificity,
    top_k: topK,
    ranked,
  }
}

// ---- embedding of the live query uses the same scheme as the dataset ----
const EMBED_DIM = 48
function queryVector(text: string): number[] {
  const vec = new Array(EMBED_DIM).fill(0)
  const tokens = text.toLowerCase().split(/[^a-z0-9.\/]+/).filter(Boolean)
  tokens.forEach((tok) => {
    let h = 0
    for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) | 0
    vec[Math.abs(h) % EMBED_DIM] += 1
  })
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}
