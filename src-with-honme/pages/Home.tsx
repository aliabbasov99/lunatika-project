import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { StarfieldBackground } from '../components/StarfieldBackground'
import { GravityFlame } from '../components/GravityFlame'
import { EXPERIMENTS } from '../data/experiments'
import type { DomainCluster } from '../types/chat'
import './Home.css'

/* ---------- static content ---------- */

const GRAVITY_PRESETS = [
  { id: 'iss', label: 'ISS', value: 0, note: 'microgravity' },
  { id: 'moon', label: 'Moon', value: 0.166, note: '0.17 g' },
  { id: 'mars', label: 'Mars', value: 0.38, note: '0.38 g' },
  { id: 'earth', label: 'Earth', value: 1, note: '1 g' },
]

const CLUSTERS: Record<DomainCluster, { label: string; blurb: string; hue: string }> = {
  Solid_Polymer_Flame_Spread: {
    label: 'Solid flame spread',
    blurb: 'How flames creep across fabrics, plastics and cabin panels.',
    hue: '#ff8a3d',
  },
  Liquid_Droplet_Combustion: {
    label: 'Droplet combustion',
    blurb: 'Fuel droplets burning as spheres, including the "cool flames" FLEX discovered.',
    hue: '#ffd48a',
  },
  Electrical_Wire_Overload: {
    label: 'Wire & electrical',
    blurb: 'Overheated insulation: the most likely way a fire starts on board.',
    hue: '#8fa9ff',
  },
  Material_Toxicity_Offgassing: {
    label: 'Smoke & toxicity',
    blurb: 'What smoke looks like without convection, and how detectors see it.',
    hue: '#c98bd6',
  },
  Microgravity_Gas_Ignition: {
    label: 'Gas-jet flames',
    blurb: 'Gaseous fuel jets, soot formation and burning-rate limits.',
    hue: '#6dd6e5',
  },
}

const FACTS = [
  {
    k: '01',
    title: 'No up, no plume',
    body: 'On Earth, hot gas rises and pulls in fresh air. In orbit there is no buoyancy, so a flame closes into a sphere around its fuel.',
  },
  {
    k: '02',
    title: 'Oxygen arrives slowly',
    body: 'Without convection, oxygen only reaches the flame by diffusion. Flames burn cooler, dimmer and bluer, and can linger where you would not expect.',
  },
  {
    k: '03',
    title: 'Airflow decides everything',
    body: 'Cabin ventilation becomes the wind. A gentle breeze can keep a fire alive that would go out in still air, which changes how a crew should respond.',
  },
]

const PATHS = [
  {
    to: '/chat',
    title: 'Ask the AI',
    body: 'Ask questions about any experiment. Every answer cites a NASA source.',
    tag: 'Chatbot',
    icon: 'M7 8.5h10M7 12h6m-1.5 7.5L7 16H5.5A2.5 2.5 0 0 1 3 13.5v-7A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v7a2.5 2.5 0 0 1-2.5 2.5H13z',
  },
  {
    to: '/simulation',
    title: 'Run the simulator',
    body: 'Change fuel, oxygen and pressure, then watch a droplet burn.',
    tag: 'Simulation',
    icon: 'M12 3c1.5 3 4.5 4.6 4.5 9a4.5 4.5 0 1 1-9 0c0-2.2 1-3.4 2-4.5.3 1.6 1 2.5 2 3 0-2.7.2-5 .5-7.5z',
  },
  {
    to: '/data',
    title: 'Browse the data',
    body: 'Tables and charts from the original experiment reports.',
    tag: 'Data',
    icon: 'M4 19V9m6 10V5m6 14v-7m4 7H3',
  },
  {
    to: '/mission-explorer',
    title: 'Explore missions',
    body: 'An atlas of every campaign, mapped by domain and year.',
    tag: 'Mission Explorer',
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0 0c2.5-2.5 3.5-5.5 3.5-9S14.5 5.5 12 3m0 18c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3M3.5 9h17M3.5 15h17',
  },
  {
    to: '/applications',
    title: 'See applications',
    body: 'How the findings turn into rules for spacecraft design.',
    tag: 'Applications',
    icon: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  },
  {
    to: '/how-it-works',
    title: 'How it works',
    body: 'From NASA PDFs to answers: how the pipeline is built.',
    tag: 'Method',
    icon: 'M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  },
]

/* ---------- helpers ---------- */

function describeFlame(g: number) {
  if (g < 0.05) return { shape: 'Spherical', color: 'Blue, nearly soot-free', flow: 'Diffusion only' }
  if (g < 0.3) return { shape: 'Slightly stretched', color: 'Blue core, faint yellow', flow: 'Weak buoyancy' }
  if (g < 0.7) return { shape: 'Elongated', color: 'Yellow tip appears', flow: 'Moderate buoyancy' }
  return { shape: 'Teardrop', color: 'Bright yellow, sooty', flow: 'Strong convection' }
}

/** Adds .is-visible once an element scrolls into view. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const targets = root.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15 },
    )
    targets.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return ref
}

/* ---------- page ---------- */

export const Home: React.FC = () => {
  const [gravity, setGravity] = useState(0)
  const rootRef = useReveal<HTMLDivElement>()
  const flame = describeFlame(gravity)

  const stats = useMemo(() => {
    const years = EXPERIMENTS.map((e) => e.year)
    const clusters = new Set(EXPERIMENTS.map((e) => e.domain_cluster))
    return {
      experiments: EXPERIMENTS.length,
      clusters: clusters.size,
      from: Math.min(...years),
      to: Math.max(...years),
    }
  }, [])

  const byCluster = useMemo(() => {
    const map = new Map<DomainCluster, string[]>()
    EXPERIMENTS.forEach((e) => {
      const list = map.get(e.domain_cluster) ?? []
      list.push(e.id)
      map.set(e.domain_cluster, list)
    })
    return map
  }, [])

  const timeline = useMemo(() => [...EXPERIMENTS].sort((a, b) => a.year - b.year), [])

  return (
    <div ref={rootRef} className="home">
      <div className="home-sky" aria-hidden="true">
        <StarfieldBackground />
      </div>

      {/* ================= HERO ================= */}
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="home-eyebrow animate-stagger-1">NASA PSI · ISS combustion archive</p>
          <h1 className="home-title animate-stagger-1">
            How fire burns <span className="home-gradient-text">without gravity</span>
          </h1>
          <p className="home-lede animate-stagger-2">
            Three decades of combustion experiments on the International Space Station, compiled,
            measured and explained. Every figure links back to a NASA table or document, so you can
            check how to protect a crew from fire.
          </p>
          <div className="home-cta animate-stagger-3">
            <Link to="/chat" className="home-btn home-btn--primary">
              Ask the AI
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
            </Link>
            <Link to="/simulation" className="home-btn home-btn--ghost">
              Open simulator
            </Link>
          </div>

          <dl className="home-stats animate-stagger-3">
            <div><dt>Experiments</dt><dd>{stats.experiments}</dd></div>
            <div><dt>Research domains</dt><dd>{stats.clusters}</dd></div>
            <div><dt>Years covered</dt><dd>{stats.from}–{stats.to}</dd></div>
          </dl>
        </div>

        {/* Interactive porthole */}
        <figure className="home-porthole-card animate-stagger-2">
          <div className="home-viewport">
            <div className="home-viewport__ring" />
            <GravityFlame gravity={gravity} />
            <span className="home-viewport__tag home-viewport__tag--tl">g = {gravity.toFixed(2)}</span>
            <span className="home-viewport__tag home-viewport__tag--br">heptane · 21% O₂</span>
          </div>

          <div className="home-gravity">
            <div className="home-gravity__head">
              <label htmlFor="gravity-range">Drag to change gravity</label>
              <output htmlFor="gravity-range">{(gravity * 9.81).toFixed(1)} m/s²</output>
            </div>
            <input
              id="gravity-range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={gravity}
              onChange={(e) => setGravity(Number(e.target.value))}
              style={{ ['--fill' as string]: `${gravity * 100}%` }}
            />
            <div className="home-gravity__presets" role="group" aria-label="Gravity presets">
              {GRAVITY_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={Math.abs(gravity - p.value) < 0.01 ? 'is-active' : ''}
                  onClick={() => setGravity(p.value)}
                >
                  <b>{p.label}</b>
                  <span>{p.note}</span>
                </button>
              ))}
            </div>
          </div>

          <figcaption className="home-readout">
            <div><span>Shape</span><b>{flame.shape}</b></div>
            <div><span>Color</span><b>{flame.color}</b></div>
            <div><span>Oxygen supply</span><b>{flame.flow}</b></div>
          </figcaption>
        </figure>

        <a href="#home-why" className="home-scroll-cue" aria-label="Scroll to learn more">
          <span />
        </a>
      </section>

      {/* ================= WHY ================= */}
      <section id="home-why" className="home-section">
        <header className="home-section__head" data-reveal>
          <p className="home-eyebrow">Why it matters</p>
          <h2>Fire in orbit follows different rules</h2>
        </header>
        <div className="home-facts">
          {FACTS.map((f, i) => (
            <article key={f.k} className="home-fact" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="home-fact__k">{f.k}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ================= DOMAINS ================= */}
      <section className="home-section">
        <header className="home-section__head home-section__head--split" data-reveal>
          <div>
            <p className="home-eyebrow">Research domains</p>
            <h2>{stats.clusters} ways a spacecraft fire can start</h2>
          </div>
          <Link to="/mission-explorer" className="home-link">
            Open Mission Explorer
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
          </Link>
        </header>
        <div className="home-domains">
          {(Object.keys(CLUSTERS) as DomainCluster[]).map((id, i) => {
            const c = CLUSTERS[id]
            const ids = byCluster.get(id) ?? []
            return (
              <article
                key={id}
                className="home-domain"
                data-reveal
                style={{ ['--hue' as string]: c.hue, transitionDelay: `${i * 70}ms` }}
              >
                <div className="home-domain__top">
                  <span className="home-domain__dot" />
                  <span className="home-domain__count">{ids.length} {ids.length === 1 ? 'experiment' : 'experiments'}</span>
                </div>
                <h3>{c.label}</h3>
                <p>{c.blurb}</p>
                <ul>
                  {ids.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </article>
            )
          })}
        </div>
      </section>

      {/* ================= TIMELINE ================= */}
      <section className="home-section">
        <header className="home-section__head" data-reveal>
          <p className="home-eyebrow">Timeline</p>
          <h2>From FLEX to today</h2>
        </header>
        <ol className="home-timeline" data-reveal>
          {timeline.map((e) => (
            <li key={e.id} style={{ ['--hue' as string]: CLUSTERS[e.domain_cluster].hue }}>
              <span className="home-timeline__year">{e.year}</span>
              <span className="home-timeline__node" />
              <div className="home-timeline__card">
                <b>{e.id}</b>
                <span className="home-timeline__name">{e.full_name}</span>
                <span className="home-timeline__mission">{e.mission}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ================= PATHS ================= */}
      <section className="home-section">
        <header className="home-section__head" data-reveal>
          <p className="home-eyebrow">Start exploring</p>
          <h2>Choose where to begin</h2>
        </header>
        <div className="home-paths">
          {PATHS.map((p, i) => (
            <Link key={p.to} to={p.to} className="home-path" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
              <span className="home-path__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={p.icon} /></svg>
              </span>
              <span className="home-path__tag">{p.tag}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <svg className="home-path__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
            </Link>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <span className="home-footer__brand">Lunatika</span>
        <span>Data from public NASA Physical Sciences Informatics records.</span>
      </footer>
    </div>
  )
}

export default Home
