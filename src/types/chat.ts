// Domain clusters for query routing
export type DomainCluster =
  | 'Solid_Polymer_Flame_Spread'
  | 'Liquid_Droplet_Combustion'
  | 'Electrical_Wire_Overload'
  | 'Material_Toxicity_Offgassing'
  | 'Microgravity_Gas_Ignition'

export interface DomainClusterDef {
  id: DomainCluster
  label: string
  keywords: string[]
}

export const DOMAIN_CLUSTERS: DomainClusterDef[] = [
  {
    id: 'Solid_Polymer_Flame_Spread',
    label: 'Solid Polymer Flame Spread',
    keywords: [
      'polymer', 'pmma', 'sib al', 'sibal', 'nomex', 'cotton', 'fabric', 'rib',
      'ribbed', 'flat', 'sample', 'thickness', 'spread', 'surface', 'panel',
      'wall', 'material', 'flammability', 'solid', 'habitat', 'module',
    ],
  },
  {
    id: 'Liquid_Droplet_Combustion',
    label: 'Liquid Droplet Combustion',
    keywords: [
      'droplet', 'liquid', 'fuel', 'heptane', 'methanol', 'ethanol', 'decane',
      'extinction', 'evaporation', 'cool flame', 'diameter', 'spray', 'diesel',
    ],
  },
  {
    id: 'Electrical_Wire_Overload',
    label: 'Electrical Wire Overload / Insulation',
    keywords: [
      'wire', 'cable', 'insulation', 'overload', 'electrical', 'arc', 'short',
      'circuit', 'polyethylene', 'teflon', 'kapton', 'current', 'joule',
    ],
  },
  {
    id: 'Material_Toxicity_Offgassing',
    label: 'Material Toxicity & Offgassing',
    keywords: [
      'toxicity', 'offgassing', 'off-gassing', ' combustion product', 'smoke',
      'particulate', 'aerosol', 'detection', 'sensor', 'co', 'hcn', 'health',
    ],
  },
  {
    id: 'Microgravity_Gas_Ignition',
    label: 'Microgravity Gas Ignition & Flames',
    keywords: [
      'ignition', 'gas', 'premixed', 'diffusion', 'flame', 'burner', 'jet',
      'methane', 'propane', 'ethylene', 'microgravity', 'buoyancy', 'gravity',
      'lunar', 'mars', 'partial gravity', '1/6 g', 'partial-g',
    ],
  },
]

// ---- Scoring rubric (40/25/20/15) ----
export interface ScoreBreakdown {
  relevance: number        // 0-100, weight 0.40
  conditions_similarity: number // 0-100, weight 0.25
  safety_significance: number   // 0-100, weight 0.20
  data_completeness: number     // 0-100, weight 0.15
}

export type EvidenceBadge = 'High' | 'Medium' | 'Low'

export interface ExperimentRecord {
  id: string                    // 'BASS-II'
  full_name: string
  domain_cluster: DomainCluster
  mission: string               // 'ISS Expedition 33/34'
  year: number
  facility: string
  description: string
  materials: string[]
  safety_takeaway: string
  methodology: string
  // Cluster-specific extracted parameters (nested, dynamic schema)
  parameters: Record<string, unknown>
  // Named parameter groups used to drive dynamic charts
  parameter_chart?: ParameterChartSpec[]
  evidence_files?: string[]
  evidence_quality: EvidenceBadge
  // Precalculated coordinates for in-memory cosine similarity
  embedding: number[]
}

export interface ParameterChartSpec {
  title: string
  // Each series: label + numbers, rendered as bar/line chart
  series: Array<{
    name: string
    values: Array<{ label: string; value: number }>
  }>
  unit?: string
}

// Ranked card payload returned from the scoring engine
export interface RankedExperiment {
  experiment: ExperimentRecord
  breakdown: ScoreBreakdown
  total_score: number
  evidence_badge: EvidenceBadge
  rationale: string
}

export interface RecommendationPayload {
  answer_summary: string
  intent: string
  clusters: DomainCluster[]
  specificity: 'broad' | 'specific'
  top_k: number
  ranked: RankedExperiment[]
}

export interface ArticleRecord {
  id: string
  title: string
  url?: string | null
  objective?: string | null
  method?: string | null
  project?: string | null
  source_files: string[]
  materials: string[]
  parameters: ArticleParameter[]
  parameter_chart?: ParameterChartSpec[]
  evidence_quality: EvidenceBadge
  evidence_note: string
  date?: string
  evidence_quality_score?: number
  evidence_quality_source?: string
  topics?: string[]
  key_findings?: string[]
  limitations?: string[]
  recommendation?: string
}

export interface ArticleParameter {
  name: string
  value: unknown
  unit?: string | null
  weight: number
  reason: string
  source: string
  verified?: boolean
}

export interface RankedArticle {
  article: ArticleRecord
  breakdown: ScoreBreakdown
  total_score: number
  rationale: string
  score_notes?: Partial<Record<keyof ScoreBreakdown, string>>
}

export interface ArticleRecommendationPayload {
  answer_summary: string
  why_relevant?: string
  routing?: {
    language?: string
    topics?: string[]
    topic_names?: string[]
    materials?: string[]
    keywords?: string[]
    breadth?: 'narrow' | 'broad'
    top_k?: number
    reason?: string
  }
  weights?: Partial<Record<keyof ScoreBreakdown, number>>
  ranked: RankedArticle[]
}

export type MessageRole = 'user' | 'bot'

export type MessageStatus = 'sending' | 'sent' | 'streaming' | 'error'

export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  status: MessageStatus
  ranking?: RecommendationPayload
  article_ranking?: ArticleRecommendationPayload
  /** User-visible, concise audit trail; not hidden chain-of-thought. */
  thinking_steps?: string[]
  /** Original user prompt that produced this bot reply (used by dashboard) */
  user_query?: string
}

export interface ChatError {
  message: string
  botMessageId: string | null
}
