// Stage 3: Dynamic Experiment Intelligence Dashboard — adaptive to domain cluster
import { useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  X, FlaskConical, Target, ShieldCheck, Database, Award, FileText,
  Gauge, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { RankedExperiment, ParameterChartSpec } from '../../types/chat'

interface Props {
  ranked: RankedExperiment
  userQuery: string
  onClose: () => void
}

const CLUSTER_COLORS: Record<string, string> = {
  Solid_Polymer_Flame_Spread: '#22d3ee',
  Liquid_Droplet_Combustion: '#a78bfa',
  Electrical_Wire_Overload: '#fbbf24',
  Material_Toxicity_Offgassing: '#34d399',
  Microgravity_Gas_Ignition: '#f472b6',
}

const SERIES_COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#f472b6']

function ScoreBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const contribution = (score * weight).toFixed(1)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-40 shrink-0 text-zinc-400">{label} <span className="text-zinc-600">({Math.round(weight * 100)}%)</span></span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
        <div className="h-full rounded bg-cyan-500" style={{ width: `${score}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right font-mono text-zinc-300">{score}/100 → {contribution} pts</span>
    </div>
  )
}

function ChartCard({ spec }: { spec: ParameterChartSpec }) {
  const isLine = spec.series.length === 1 && spec.series[0].values.length > 3
  const data = spec.series[0].values.map((v, i) => {
    const row: Record<string, number | string> = { label: v.label }
    spec.series.forEach((s) => { row[s.name] = s.values[i]?.value ?? 0 })
    return row
  })
  return (
    <div className="border border-zinc-800 bg-zinc-900/60 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <Gauge size={14} className="text-cyan-400" /> {spec.title}
        {spec.unit ? <span className="font-mono text-[10px] normal-case text-zinc-600">[{spec.unit}]</span> : null}
      </h4>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          {isLine ? (
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {spec.series.map((s, i) => (
                <Line key={s.name} type="monotone" dataKey={s.name} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {spec.series.map((s, i) => (
                <Bar key={s.name} dataKey={s.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function renderParameterValue(value: unknown): string {
  if (value == null) return '—'
  if (Array.isArray(value)) return value.map((v) => renderParameterValue(v)).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${renderParameterValue(v)}`)
      .join(' · ')
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
  }
  return String(value)
}

function ParameterGrid({ parameters }: { parameters: Record<string, unknown> }) {
  const entries = Object.entries(parameters).filter(([key, value]) => {
    // Never render empty/null fields — adaptive grid rule
    if (key === 'embedding') return false
    const text = renderParameterValue(value)
    return text !== '' && text !== '—' && text !== 'null' && text !== 'undefined'
  })
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            {key.replace(/_/g, ' ')}
          </p>
          <p className="mt-1 break-words font-mono text-xs text-zinc-200">
            {renderParameterValue(value)}
          </p>
        </div>
      ))}
    </div>
  )
}

export function ExperimentDashboard({ ranked, userQuery, onClose }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const { experiment: exp, breakdown, total_score, evidence_badge } = ranked
  const accent = CLUSTER_COLORS[exp.domain_cluster] ?? '#22d3ee'
  const badgeColor = evidence_badge === 'High' ? 'text-emerald-400 border-emerald-800' : evidence_badge === 'Medium' ? 'text-amber-400 border-amber-800' : 'text-zinc-400 border-zinc-700'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="my-8 w-full max-w-4xl rounded-xl border bg-zinc-950 shadow-2xl"
        style={{ borderColor: `${accent}44` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header & metadata bar */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 p-5" style={{ background: `linear-gradient(135deg, ${accent}11, transparent 60%)` }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ background: `${accent}22`, color: accent }}>
                {exp.domain_cluster.replace(/_/g, ' ')}
              </span>
              <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeColor}`}>
                Evidence {evidence_badge}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">{exp.id}</h2>
            <p className="text-sm text-zinc-400">{exp.full_name}</p>
            <p className="mt-1 text-xs text-zinc-500">{exp.mission} · {exp.year} · {exp.facility}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowBreakdown((v) => !v)}
              className="group relative flex cursor-pointer flex-col items-center rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 hover:border-zinc-500"
              title="Score breakdown (40/25/20/15)"
            >
              <span className="text-2xl font-bold" style={{ color: accent }}>{total_score}%</span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                total score {showBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </button>
            <button type="button" onClick={onClose} className="cursor-pointer rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white" aria-label="Close dashboard">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Expandable score breakdown */}
        {showBreakdown ? (
          <div className="space-y-2 border-b border-zinc-800 bg-zinc-900/40 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Transparent scoring: Σ(criterion × weight)
            </p>
            <ScoreBar label="Relevance to query" score={breakdown.relevance} weight={0.4} />
            <ScoreBar label="Conditions similarity" score={breakdown.conditions_similarity} weight={0.25} />
            <ScoreBar label="Safety significance" score={breakdown.safety_significance} weight={0.2} />
            <ScoreBar label="Data completeness" score={breakdown.data_completeness} weight={0.15} />
            <p className="pt-1 text-right font-mono text-xs text-zinc-400">
              total = {total_score} / 100
            </p>
          </div>
        ) : null}

        <div className="space-y-6 p-5">
          {/* AI Executive Synthesis */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <FlaskConical size={14} /> AI Executive Synthesis
            </h3>
            <p className="text-sm leading-relaxed text-zinc-300">{exp.description}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Methodology & apparatus</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-300">{exp.methodology}</p>
              </div>
              <div className="border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Key safety takeaway</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-300">{exp.safety_takeaway}</p>
              </div>
            </div>
          </section>

          {/* Materials */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <Target size={14} /> Materials tested
            </h3>
            <div className="flex flex-wrap gap-2">
              {exp.materials.map((m) => (
                <span key={m} className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">{m}</span>
              ))}
            </div>
          </section>

          {/* Dynamic parameter charts */}
          {exp.parameter_chart?.length ? (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                <Gauge size={14} /> Dynamic parameter visualizations
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {exp.parameter_chart.map((spec, i) => (
                  <ChartCard key={`${spec.title}-${i}`} spec={spec} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Dynamic parameter grid — only non-null fields of this cluster's schema */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <Database size={14} /> Extracted parameters ({exp.domain_cluster.replace(/_/g, ' ').toLowerCase()} schema)
            </h3>
            <ParameterGrid parameters={exp.parameters} />
          </section>

          {/* Actionable recommendation */}
          <section className="rounded-lg border p-4" style={{ borderColor: `${accent}55`, background: `${accent}0d` }}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
              <ShieldCheck size={14} /> How this experiment answers your question
            </h3>
            <p className="text-xs italic text-zinc-500">Your query: “{userQuery}”</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-200">
              {ranked.rationale}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              The {exp.id} dataset provides {Object.keys(exp.parameters).length} extracted parameters directly usable for
              {' '}{exp.domain_cluster === 'Solid_Polymer_Flame_Spread' ? 'material screening and panel geometry decisions' :
                exp.domain_cluster === 'Liquid_Droplet_Combustion' ? 'liquid fuel storage and suppression analysis' :
                exp.domain_cluster === 'Electrical_Wire_Overload' ? 'wiring derating and inspection criteria' :
                exp.domain_cluster === 'Material_Toxicity_Offgassing' ? 'detector calibration and toxic product assessment' :
                'gas leak ignition risk assessment'}{' '}
              in your scenario. Evidence badge: {evidence_badge}.
            </p>
          </section>

          {/* Evidence */}
          {exp.evidence_files?.length ? (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                <Award size={14} /> Evidence files
              </h3>
              <ul className="space-y-1">
                {exp.evidence_files.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-zinc-400">
                    <FileText size={12} className="shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
